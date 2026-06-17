import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { mockDocuments } from "./mockDocuments.js";
import { logger } from "./utils/logger.js";
import { storageService } from "./services/storageService.js";
import { underwritingService } from "./services/underwritingService.js";
import { llmService } from "./services/llmService.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { validator } from "./middleware/validator.js";

dotenv.config();

const app = express();

// Hardened CORS policy: Allow wildcard for local development, restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or matched origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: request origin not allowed."));
    }
  }
}));

app.use(express.json({ limit: "10mb" }));

// Apply global rate limiting to protect endpoints
app.use("/api", rateLimiter);

const PORT = process.env.PORT || 5000;

// Middleware to simulate tenant access control & get user session
const requireAuth = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId || userId.trim() === "") {
    logger.warn("Unauthorized request attempt: missing x-user-id header");
    return res.status(401).json({ error: "Unauthorized. Missing x-user-id header simulating authentication." });
  }
  
  // Enforce basic alphanumeric validation on userId to prevent header manipulation
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: "Invalid credentials format." });
  }

  req.userId = userId;
  req.session = storageService.getSession(userId);
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
  storageService.clearSession(req.userId);
  res.json({ success: true, message: "Session cleared successfully." });
});

// 4. Select Mock Document or Upload Custom file/Text
app.post("/api/document/select", requireAuth, validator.validateDocumentSelection, async (req, res) => {
  const { documentId, customText, documentName, documentType, fileBase64, fileType } = req.body;
  let selectedDoc = null;

  try {
    if (documentId) {
      selectedDoc = mockDocuments.find(d => d.id === documentId);
      if (!selectedDoc) {
        return res.status(404).json({ error: "Mock document not found." });
      }
    } else if (fileBase64) {
      selectedDoc = {
        id: "uploaded_" + Date.now(),
        name: documentName || "Uploaded File",
        type: documentType || "Salary Slip",
        fileBase64,
        fileType
      };
    } else if (customText) {
      selectedDoc = {
        id: "custom_" + Date.now(),
        name: documentName || "Custom Uploaded Document",
        type: documentType || "Salary Slip",
        rawText: customText
      };
    }

    // Update session context and wipe previous states
    req.session.activeDocument = selectedDoc;
    req.session.extraction = null;
    req.session.underwritingResult = null;
    req.session.chatHistory = [];

    logger.info(`Loaded document into session context`, { userId: req.userId, docId: selectedDoc.id });

    res.json({
      success: true,
      message: "Document loaded into session.",
      document: {
        id: selectedDoc.id,
        name: selectedDoc.name,
        type: selectedDoc.type,
        rawText: selectedDoc.rawText,
        fileType: selectedDoc.fileType
      }
    });
  } catch (err) {
    logger.error(`Failed to load document into session`, { userId: req.userId, error: err.message });
    res.status(500).json({ error: "Failed to process document selection." });
  }
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
    const rawResult = await llmService.query(requestBody, req.userId);

    // Clean markdown codeblocks if LLM ignores prompt instructions
    let cleanedJson = rawResult.trim();
    if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/i, "").replace(/```$/, "");
    }
    
    let extraction;
    try {
      extraction = JSON.parse(cleanedJson);
    } catch (parseErr) {
      logger.error("Failed to parse LLM response as JSON", { userId: req.userId, rawResult });
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
    logger.error("Error calling LLM Parsing engine:", { userId: req.userId, error: apiErr.message });
    res.status(500).json({ error: apiErr.message || "Failed to query the LLM Parsing API." });
  }
});

// 6. Run Underwriting Rules
app.post("/api/document/underwrite", requireAuth, (req, res) => {
  const session = req.session;
  if (!session.extraction) {
    return res.status(400).json({ error: "Document has not been parsed yet. Please run extraction first." });
  }

  try {
    const underwritingResult = underwritingService.evaluateRules(session.extraction);
    session.underwritingResult = underwritingResult;
    
    logger.info(`Completed underwriting check`, { userId: req.userId, decision: underwritingResult.decision });
    res.json({ success: true, underwritingResult });
  } catch (err) {
    logger.error(`Underwriting engine execution failure`, { userId: req.userId, error: err.message });
    res.status(500).json({ error: "Rules check failed." });
  }
});

// 7. Grounded Chatbot Q&A
app.post("/api/chat", requireAuth, validator.validateChatQuestion, async (req, res) => {
  const session = req.session;
  const { question } = req.body;

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
    const reply = await llmService.query(requestBody, req.userId);

    // Save to session history
    session.chatHistory.push({ role: "user", content: question });
    session.chatHistory.push({ role: "assistant", content: reply });

    res.json({ reply, chatHistory: session.chatHistory });
  } catch (apiErr) {
    logger.error("Error in chat LLM request:", { userId: req.userId, error: apiErr.message });
    res.status(500).json({ error: apiErr.message || "Chat service failed." });
  }
});

// Start express server
app.listen(PORT, () => {
  logger.info(`Server successfully started. Listening on http://localhost:${PORT}`);
});
