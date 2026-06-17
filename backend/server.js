import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { mockDocuments } from "./mockDocuments.js";

dotenv.config();

const detectMimeType = (base64) => {
  if (!base64) return null;
  const prefix = base64.substring(0, 10);
  if (prefix.startsWith("JVBERi")) return "application/pdf";
  if (prefix.startsWith("iVBORw")) return "image/png";
  if (prefix.startsWith("/9j/")) return "image/jpeg";
  if (prefix.startsWith("R0lGOD")) return "image/gif";
  if (prefix.startsWith("UklGR")) return "image/webp";
  return null;
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 5000;
const LLM_WRAPPER_URL = process.env.LLM_WRAPPER_URL || "https://llm-wrapper-741152993481.asia-south1.run.app";
const LLM_WRAPPER_TOKEN = process.env.LLM_WRAPPER_TOKEN || "lw_wU_g24w-2Lp7crPpatU4oD7LNDKGH3FYAIzM2y7tw38";

// In-memory session store to simulate multi-tenant user access isolation
// Key: userId (simulated token/header)
// Value: { activeDocument, extraction, underwritingResult, chatHistory }
const sessionStore = new Map();

// Helper to get or initialize user session
const getSession = (userId) => {
  if (!userId) return null;
  if (!sessionStore.has(userId)) {
    sessionStore.set(userId, {
      activeDocument: null,
      extraction: null,
      underwritingResult: null,
      chatHistory: []
    });
  }
  return sessionStore.get(userId);
};

// Middleware to simulate access control
const requireAuth = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId || userId.trim() === "") {
    return res.status(401).json({ error: "Unauthorized. Missing x-user-id header simulating authentication." });
  }
  req.userId = userId;
  req.session = getSession(userId);
  next();
};

// 1. Get List of Preloaded Mock Documents
app.get("/api/documents", (req, res) => {
  res.json(mockDocuments.map(doc => ({ id: doc.id, name: doc.name, type: doc.type })));
});

// 2. Fetch Active Session Data for Current User
app.get("/api/session/active", requireAuth, (req, res) => {
  res.json({
    userId: req.userId,
    activeDocument: req.session.activeDocument ? {
      id: req.session.activeDocument.id,
      name: req.session.activeDocument.name,
      type: req.session.activeDocument.type,
      rawText: req.session.activeDocument.rawText,
      fileType: req.session.activeDocument.fileType
    } : null,
    extraction: req.session.extraction,
    underwritingResult: req.session.underwritingResult,
    chatHistory: req.session.chatHistory
  });
});

// 3. Clear Active Session
app.post("/api/session/clear", requireAuth, (req, res) => {
  req.session.activeDocument = null;
  req.session.extraction = null;
  req.session.underwritingResult = null;
  req.session.chatHistory = [];
  res.json({ success: true, message: "Session cleared successfully." });
});

// 4. Select Mock Document or Upload Custom Text
app.post("/api/document/select", requireAuth, async (req, res) => {
  const { documentId, customText, documentName, documentType, fileBase64, fileType } = req.body;
  let selectedDoc = null;

  if (documentId) {
    selectedDoc = mockDocuments.find(d => d.id === documentId);
    if (!selectedDoc) {
      return res.status(404).json({ error: "Mock document not found." });
    }
  } else if (fileBase64) {
    const detectedType = detectMimeType(fileBase64) || fileType || "application/pdf";
    selectedDoc = {
      id: "uploaded_" + Date.now(),
      name: documentName || "Uploaded File",
      type: documentType || "Salary Slip",
      fileBase64,
      fileType: detectedType
    };
  } else if (customText) {
    selectedDoc = {
      id: "custom_" + Date.now(),
      name: documentName || "Custom Uploaded Document",
      type: documentType || "Salary Slip",
      rawText: customText
    };
  } else {
    return res.status(400).json({ error: "Missing documentId, customText, or fileBase64." });
  }

  // Update user session and wipe previous state
  req.session.activeDocument = selectedDoc;
  req.session.extraction = null;
  req.session.underwritingResult = null;
  req.session.chatHistory = [];

  res.json({
    success: true,
    message: "Document loaded into session.",
    document: {
      id: selectedDoc.id,
      name: selectedDoc.name,
      type: selectedDoc.type,
      rawText: selectedDoc.rawText,
      fileBase64: selectedDoc.fileBase64,
      fileType: selectedDoc.fileType
    }
  });
});

// 5. Parse Document using LLM Wrapper
app.post("/api/document/parse", requireAuth, async (req, res) => {
  const session = req.session;
  if (!session.activeDocument) {
    return res.status(400).json({ error: "No active document in session. Please select/upload a document first." });
  }

  const isFile = !!session.activeDocument.fileBase64;
  let prompt = "";
  let requestBody = {};

  const schemaDefinition = `Extraction Schema:
- accountHolderName: (String) Name of the account holder or employee.
- employer: (String) Name of the employer or salary-paying business. Default to "Not Found" if not mentioned.
- monthlyIncome: (Number) Net monthly paycheck amount or total monthly credit salary deposits. Set to 0 if not found.
- deductions: (Number) Total deductions from payslip. Set to 0 if not found.
- averageBankBalance: (Number) Average statement balance. Set to 0 if not present or is a Salary Slip.
- existingEMI: (Number) Total monthly existing EMIs/loan repayments. Set to 0 if not found.
- bouncedTransactions: (Number) Count of bounced cheques, NSF events, or returned checks. Set to 0 if none.
- documentType: (String) "${session.activeDocument.type}" (Salary Slip or Bank Statement)
- currency: (String) Currency symbol detected on the document, e.g., "$" or "₹" or "£" or "€". Default to "$" if not found or USD.
- confidenceScores: (Object) A score between 0.0 and 1.0 indicating extraction confidence for each of the fields above: accountHolderName, employer, monthlyIncome, averageBankBalance, existingEMI, bouncedTransactions. Low quality or blurry text should have lower confidence.
- evidence: (Object) Exact snippet of text from the document verifying each of the above fields.

Format the response strictly as a JSON object, without any markdown formatting block around it. Do not include markdown codeblocks (e.g. \`\`\`json).`;

  if (isFile) {
    prompt = `You are a professional financial document OCR & data extraction assistant.
Analyze the uploaded document and extract the required fields as a clean JSON object.

${schemaDefinition}`;

    if (session.activeDocument.fileType === "application/pdf") {
      requestBody = {
        prompt,
        pdfBase64: session.activeDocument.fileBase64
      };
    } else {
      requestBody = {
        prompt,
        imageBase64: session.activeDocument.fileBase64,
        imageMediaType: session.activeDocument.fileType
      };
    }
  } else {
    prompt = `You are a professional financial document OCR & data extraction assistant.
Analyze the document text below and extract the required fields as a clean JSON object.

${schemaDefinition}

Document Content:
${session.activeDocument.rawText}`;

    requestBody = { prompt };
  }

  try {
    const response = await axios.post(
      `${LLM_WRAPPER_URL}/llm/query`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LLM_WRAPPER_TOKEN}`
        }
      }
    );

    let rawResult = response.data;
    if (typeof rawResult === "object") {
      if (rawResult.response) {
        rawResult = rawResult.response;
      } else if (rawResult.reply) {
        rawResult = rawResult.reply;
      }
    }

    // Clean markdown codeblocks if LLM ignores prompt instructions
    let cleanedJson = rawResult.trim();
    if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/i, "").replace(/```$/, "");
    }
    
    let extraction;
    try {
      extraction = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.error("Failed to parse LLM response as JSON. Raw response:", rawResult);
      return res.status(500).json({
        error: "Failed to parse structured data from the document. The AI response was not in correct JSON format.",
        rawAIResponse: rawResult
      });
    }

    // Validate fields
    extraction.monthlyIncome = Number(extraction.monthlyIncome) || 0;
    extraction.deductions = Number(extraction.deductions) || 0;
    extraction.averageBankBalance = Number(extraction.averageBankBalance) || 0;
    extraction.existingEMI = Number(extraction.existingEMI) || 0;
    extraction.bouncedTransactions = Number(extraction.bouncedTransactions) || 0;
    extraction.currency = extraction.currency || "$";

    session.extraction = extraction;
    res.json({ success: true, extraction });
  } catch (apiErr) {
    console.error("Error calling LLM Wrapper API:", apiErr.message);
    res.status(500).json({ error: "Failed to query the LLM Parsing API. Ensure the token is valid." });
  }
});

// 6. Run Underwriting Rules
app.post("/api/document/underwrite", requireAuth, (req, res) => {
  const session = req.session;
  if (!session.extraction) {
    return res.status(400).json({ error: "Document has not been parsed yet. Please run extraction first." });
  }

  const ext = session.extraction;
  const currencySymbol = ext.currency || "$";
  
  // Underwriting Thresholds (Auto-adjust for INR)
  const MIN_INCOME = currencySymbol === "₹" ? 20000 : 2000; 
  const MAX_FOIR = 40;     // DTI Max 40%
  const MIN_BAL_MULTIPLIER = 2; // Average balance >= 2x existingEMI (if average balance is reported)
  const INCOME_MARGIN = currencySymbol === "₹" ? 5000 : 500;

  const rules = [];

  // Rule 1: Minimum Net Income
  const netIncome = ext.monthlyIncome;
  const passedIncome = netIncome >= MIN_INCOME;
  rules.push({
    name: "Minimum Net Income Check",
    description: `Requires net monthly income of at least ${currencySymbol}${MIN_INCOME}. Extracted: ${currencySymbol}${netIncome}`,
    status: passedIncome ? "PASS" : "FAIL",
    critical: true
  });

  // Rule 2: FOIR / Debt-to-Income (DTI) Ratio
  let foirVal = 0;
  let passedFOIR = true;
  if (netIncome > 0) {
    foirVal = (ext.existingEMI / netIncome) * 100;
    passedFOIR = foirVal <= MAX_FOIR;
  } else if (ext.existingEMI > 0) {
    passedFOIR = false; // EMI exists but income is 0
  }
  rules.push({
    name: "FOIR / Debt-to-Income Ratio Check",
    description: `Total EMIs (${currencySymbol}${ext.existingEMI}) must not exceed ${MAX_FOIR}% of net income (${currencySymbol}${netIncome}). Calculated FOIR: ${foirVal.toFixed(1)}%`,
    status: passedFOIR ? "PASS" : "FAIL",
    critical: true
  });

  // Rule 3: Balance Sufficiency (Only applies to Bank Statements with active EMIs)
  let balanceCheckStatus = "N/A";
  let balanceCheckDesc = "Not applicable for Salary Slips or cases with no active EMI obligations.";
  
  if (ext.documentType === "Bank Statement" && ext.existingEMI > 0) {
    const requiredMinBalance = ext.existingEMI * MIN_BAL_MULTIPLIER;
    const passedBalance = ext.averageBankBalance >= requiredMinBalance;
    balanceCheckStatus = passedBalance ? "PASS" : "FAIL";
    balanceCheckDesc = `Average bank balance (${currencySymbol}${ext.averageBankBalance}) must cover at least 2x existing EMIs (${currencySymbol}${requiredMinBalance}).`;
    
    rules.push({
      name: "Average Balance Sufficiency Check",
      description: balanceCheckDesc,
      status: balanceCheckStatus,
      critical: false
    });
  }

  // Rule 4: Repayment History (Bounced checks)
  const bouncedCount = ext.bouncedTransactions;
  const passedBounces = bouncedCount === 0;
  rules.push({
    name: "Repayment Cleanliness (Bounces)",
    description: `Applicant must have zero bounced/NSF transactions. Extracted: ${bouncedCount} bounces`,
    status: passedBounces ? "PASS" : "FAIL",
    critical: true
  });

  // Underwriting Decision Engine Logic
  let decision = "Approve";
  const reasons = [];

  // Check critical failures
  const hasCriticalFail = rules.some(r => r.critical && r.status === "FAIL");
  const hasNonCriticalFail = rules.some(r => !r.critical && r.status === "FAIL");

  // Confidence check
  const lowConfidenceFields = Object.entries(ext.confidenceScores || {})
    .filter(([field, score]) => score < 0.8)
    .map(([field]) => field);

  const isLowConfidence = lowConfidenceFields.length > 0;

  if (hasCriticalFail) {
    decision = "Reject";
    rules.forEach(r => {
      if (r.status === "FAIL" && r.critical) {
        reasons.push(`Critical Fail: ${r.name} - ${r.description}`);
      }
    });
  } else if (hasNonCriticalFail || isLowConfidence) {
    decision = "Manual Review";
    if (hasNonCriticalFail) {
      rules.forEach(r => {
        if (r.status === "FAIL" && !r.critical) {
          reasons.push(`Non-Critical Fail: ${r.name} - ${r.description}`);
        }
      });
    }
    if (isLowConfidence) {
      reasons.push(`Low OCR confidence on fields: ${lowConfidenceFields.join(", ")}`);
    }
  } else {
    // Borderline checks for Manual Review warning triggers
    // Example: FOIR between 35% and 40%
    if (foirVal > 35 && foirVal <= 40) {
      decision = "Manual Review";
      reasons.push("Borderline FOIR: Debt-to-income is high (between 35% and 40%).");
    }
    // Income close to minimum limit
    if (netIncome >= MIN_INCOME && netIncome < MIN_INCOME + INCOME_MARGIN) {
      decision = "Manual Review";
      reasons.push(`Borderline income: Monthly income (${currencySymbol}${netIncome}) is close to minimum threshold of ${currencySymbol}${MIN_INCOME}.`);
    }
  }

  if (decision === "Approve") {
    reasons.push("All underwriting rules satisfied with healthy financial margins.");
  }

  const underwritingResult = {
    decision,
    reasons,
    rules,
    analyzedAt: new Date().toISOString()
  };

  session.underwritingResult = underwritingResult;
  res.json({ success: true, underwritingResult });
});

// 7. Grounded Chatbot Q&A
app.post("/api/chat", requireAuth, async (req, res) => {
  const session = req.session;
  const { question } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ error: "Question is required." });
  }

  if (!session.activeDocument) {
    return res.status(400).json({ error: "No document loaded. Please load and parse a document before chatting." });
  }

  const isFile = !!session.activeDocument.fileBase64;
  const extractionContext = JSON.stringify(session.extraction || {}, null, 2);
  const underwritingContext = JSON.stringify(session.underwritingResult || {}, null, 2);

  // Maintain structured chat history
  const previousHistory = session.chatHistory.map(
    chat => `${chat.role === "user" ? "User" : "Assistant"}: ${chat.content}`
  ).join("\n");

  let systemPrompt = "";
  let requestBody = {};

  if (isFile) {
    systemPrompt = `You are a financial underwriting auditor chatbot. Your job is to answer questions about the current applicant's loan assessment.
You MUST base your answers strictly on the attached document, extracted profile, and underwriting rules provided below. If the answer cannot be found in the document, reply that you don't have that information. Do not make up facts.

Extracted Structured Profile:
\"\"\"
${extractionContext}
\"\"\"

Underwriting Evaluation & Decision:
\"\"\"
${underwritingContext}
\"\"\"

Previous Chat History:
${previousHistory}

New Question: ${question}

Provide a concise, clear, and audit-ready response grounded in the provided facts:`;

    if (session.activeDocument.fileType === "application/pdf") {
      requestBody = {
        prompt: systemPrompt,
        pdfBase64: session.activeDocument.fileBase64
      };
    } else {
      requestBody = {
        prompt: systemPrompt,
        imageBase64: session.activeDocument.fileBase64,
        imageMediaType: session.activeDocument.fileType
      };
    }
  } else {
    systemPrompt = `You are a financial underwriting auditor chatbot. Your job is to answer questions about the current applicant's loan assessment.
You MUST base your answers strictly on the document context, extracted profile, and underwriting rules provided below. If the answer cannot be found in the document, reply that you don't have that information. Do not make up facts.

Document Context:
\"\"\"
${session.activeDocument.rawText}
\"\"\"

Extracted Structured Profile:
\"\"\"
${extractionContext}
\"\"\"

Underwriting Evaluation & Decision:
\"\"\"
${underwritingContext}
\"\"\"

Previous Chat History:
${previousHistory}

New Question: ${question}

Provide a concise, clear, and audit-ready response grounded in the provided facts:`;

    requestBody = {
      prompt: systemPrompt
    };
  }

  try {
    const response = await axios.post(
      `${LLM_WRAPPER_URL}/llm/query`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LLM_WRAPPER_TOKEN}`
        }
      }
    );

    let reply = response.data;
    if (typeof reply === "object") {
      if (reply.response) {
        reply = reply.response;
      } else if (reply.reply) {
        reply = reply.reply;
      }
    }

    // Save to session history
    session.chatHistory.push({ role: "user", content: question });
    session.chatHistory.push({ role: "assistant", content: reply });

    res.json({ reply, chatHistory: session.chatHistory });
  } catch (apiErr) {
    console.error("Error in chat LLM request:", apiErr.message);
    res.status(500).json({ error: "Chat service encountered an error querying the LLM." });
  }
});

// Run server
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
