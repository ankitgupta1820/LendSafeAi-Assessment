import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

function App() {
  // Authentication / Access Control Scope State
  const [currentUser, setCurrentUser] = useState("Auditor-Alpha");
  
  // App States
  const [mockDocs, setMockDocs] = useState([]);
  const [activeDocId, setActiveDocId] = useState("");
  const [activeDoc, setActiveDoc] = useState(null);
  
  // Custom document upload states
  const [customText, setCustomText] = useState("");
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("Salary Slip");

  // Real file upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileUploadType, setFileUploadType] = useState("Salary Slip");
  const [isUploading, setIsUploading] = useState(false);
  const [inputTab, setInputTab] = useState("text"); // 'text' or 'file'

  // Extracted and analyzed state
  const [extraction, setExtraction] = useState(null);
  const [underwriting, setUnderwriting] = useState(null);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  
  // Grounded Chat Q&A State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  // Error / feedback states
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const chatEndRef = useRef(null);

  // Load documents list and user active session
  useEffect(() => {
    fetchMockDocs();
  }, []);

  // Fetch active session when user changes to demonstrate access control/isolation
  useEffect(() => {
    fetchActiveSession();
  }, [currentUser]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const getHeaders = () => {
    return {
      "Content-Type": "application/json",
      "x-user-id": currentUser
    };
  };

  const fetchMockDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setMockDocs(data);
      }
    } catch (err) {
      setErrorMsg("Failed to connect to the backend server. Is it running on port 5000?");
    }
  };

  const fetchActiveSession = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/session/active`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const session = await res.json();
        if (session.activeDocument) {
          setActiveDoc(session.activeDocument);
          setActiveDocId(session.activeDocument.id);
        } else {
          setActiveDoc(null);
          setActiveDocId("");
        }
        setExtraction(session.extraction);
        setUnderwriting(session.underwritingResult);
        setChatHistory(session.chatHistory || []);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Failed to fetch active session.");
      }
    } catch (err) {
      setErrorMsg("Error connecting to backend server.");
    }
  };

  const handleSelectMockDoc = async (docId) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/document/select`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ documentId: docId })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDoc(data.document);
        setActiveDocId(docId);
        setExtraction(null);
        setUnderwriting(null);
        setChatHistory([]);
        setSuccessMsg(`Document "${data.document.name}" loaded into user session.`);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error);
      }
    } catch (err) {
      setErrorMsg("Error selecting mock document.");
    }
  };

  const handleLoadCustomDoc = async (e) => {
    e.preventDefault();
    if (!customText.trim()) {
      setErrorMsg("Please paste some document text first.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    const name = customName.trim() || `Custom Payslip/Statement (${customType})`;
    
    try {
      const res = await fetch(`${API_BASE}/document/select`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          customText,
          documentName: name,
          documentType: customType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDoc(data.document);
        setActiveDocId(data.document.id);
        setExtraction(null);
        setUnderwriting(null);
        setChatHistory([]);
        setCustomText("");
        setCustomName("");
        setSuccessMsg("Custom text document successfully loaded.");
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error);
      }
    } catch (err) {
      setErrorMsg("Error loading custom document.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleLoadUploadedFile = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select a file first.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(",")[1]; // extract base64 part
        const fileType = selectedFile.type; // e.g. application/pdf, image/png
        const name = selectedFile.name;

        const res = await fetch(`${API_BASE}/document/select`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            documentName: name,
            documentType: fileUploadType,
            fileBase64: base64Data,
            fileType: fileType
          })
        });

        if (res.ok) {
          const data = await res.json();
          setActiveDoc(data.document);
          setActiveDocId(data.document.id);
          setExtraction(null);
          setUnderwriting(null);
          setChatHistory([]);
          setSelectedFile(null);
          // Reset file input value
          const fileInput = document.getElementById("file-input");
          if (fileInput) fileInput.value = "";
          setSuccessMsg(`File "${name}" successfully loaded into session.`);
        } else {
          const errData = await res.json();
          setErrorMsg(errData.error || "Failed to upload file.");
        }
      } catch (err) {
        setErrorMsg("Error uploading selected file.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
      setIsUploading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleExtractData = async () => {
    if (!activeDoc) return;
    setLoadingExtract(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/document/parse`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setExtraction(data.extraction);
        setSuccessMsg("Document parsed successfully via LLM Engine.");
      } else {
        setErrorMsg(data.error || "Failed to parse document.");
      }
    } catch (err) {
      setErrorMsg("Network error occurred during document extraction.");
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleRunUnderwriting = async () => {
    if (!extraction) return;
    setLoadingRules(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/document/underwrite`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setUnderwriting(data.underwritingResult);
        setSuccessMsg("Underwriting decision and rules evaluation complete.");
      } else {
        setErrorMsg(data.error || "Failed to execute underwriting rules.");
      }
    } catch (err) {
      setErrorMsg("Network error occurred during underwriting rules check.");
    } finally {
      setLoadingRules(false);
    }
  };

  const handleSendChatMessage = async (messageText) => {
    const textToSend = messageText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    if (!messageText) {
      setChatInput("");
    }
    setChatLoading(true);
    setErrorMsg("");

    // Append user message immediately locally for responsive UX
    const tempHistory = [...chatHistory, { role: "user", content: textToSend }];
    setChatHistory(tempHistory);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ question: textToSend })
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory(data.chatHistory);
      } else {
        setErrorMsg(data.error || "Failed to get response from chatbot.");
        // Rollback message
        setChatHistory(chatHistory);
      }
    } catch (err) {
      setErrorMsg("Network error contacting chat assistant.");
      setChatHistory(chatHistory);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearSession = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/session/clear`, {
        method: "POST",
        headers: getHeaders()
      });
      if (res.ok) {
        setActiveDoc(null);
        setActiveDocId("");
        setExtraction(null);
        setUnderwriting(null);
        setChatHistory([]);
        setSuccessMsg("Current user session has been reset.");
      }
    } catch (err) {
      setErrorMsg("Error resetting session.");
    }
  };

  const getConfidenceBadgeColor = (score) => {
    if (score >= 0.9) return "var(--color-success)";
    if (score >= 0.8) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case "Approve":
        return <span className="badge badge-approve">Approved</span>;
      case "Manual Review":
        return <span className="badge badge-review">Manual Review</span>;
      case "Reject":
        return <span className="badge badge-reject">Rejected</span>;
      default:
        return null;
    }
  };

  const formatCurrency = (value) => {
    const symbol = extraction?.currency || "$";
    if (symbol === "₹") {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
    }
    if (symbol === "£") {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
    }
    if (symbol === "€") {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  };

  return (
    <div className="app-container">
      {/* Header with Access Scoping Simulation */}
      <header className="app-header glass-panel">
        <div className="brand">
          <div className="brand-logo">Δ</div>
          <div>
            <h1>LendSafe AI</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Document Intelligence & Decision Automated Underwriting
            </p>
          </div>
        </div>

        <div className="auth-simulation">
          <label htmlFor="user-scope">Active Session Scope (User Access):</label>
          <select 
            id="user-scope" 
            className="user-select"
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
          >
            <option value="Auditor-Alpha">Auditor Alpha (Tenant A)</option>
            <option value="Underwriter-Beta">Underwriter Beta (Tenant B)</option>
            <option value="Broker-Gamma">Broker Gamma (Tenant C)</option>
          </select>
        </div>
      </header>

      {/* Messaging / Alerts */}
      {errorMsg && (
        <div className="glass-panel" style={{ padding: "12px 20px", borderLeft: "4px solid var(--color-danger)", background: "rgba(239, 68, 68, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fca5a5", fontSize: "0.85rem", fontWeight: 500 }}>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "1rem" }}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="glass-panel" style={{ padding: "12px 20px", borderLeft: "4px solid var(--color-success)", background: "rgba(16, 185, 129, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#a7f3d0", fontSize: "0.85rem", fontWeight: 500 }}>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer", fontSize: "1rem" }}>×</button>
        </div>
      )}

      {/* Main Grid Workspace */}
      <main className="dashboard-grid">
        
        {/* Column 1: Document Upload Portal */}
        <section className="column">
          <div className="column-card glass-panel">
            <h2 className="card-title">
              <span>Document Portal</span>
              {activeDoc && (
                <button onClick={handleClearSession} style={{ background: "none", border: "none", color: "var(--color-danger)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}>
                  Clear Session
                </button>
              )}
            </h2>
            
            <div className="card-scroll-area">
              <div className="doc-selection-list">
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Select a preloaded simulation document:
                </p>
                {mockDocs.map((doc) => (
                  <button
                    key={doc.id}
                    className={`doc-item ${activeDocId === doc.id ? "active" : ""}`}
                    onClick={() => handleSelectMockDoc(doc.id)}
                  >
                    <span className="doc-name">{doc.name}</span>
                    <span className="doc-type-badge">{doc.type}</span>
                  </button>
                ))}
              </div>

              {activeDoc ? (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>{activeDoc.fileType ? "Uploaded Document Profile:" : "Raw Document text (OCR Mock):"}</span>
                    <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{activeDoc.type}</span>
                  </p>
                  {activeDoc.fileType ? (
                    <div className="file-preview-card" style={{
                      background: "rgba(59, 130, 246, 0.05)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      borderRadius: "10px",
                      padding: "20px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px"
                    }}>
                      <div style={{ fontSize: "2.5rem" }}>
                        {activeDoc.fileType === "application/pdf" ? "📕" : "🖼️"}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", wordBreak: "break-all" }}>
                        {activeDoc.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        MIME Type: {activeDoc.fileType}
                      </div>
                      <div style={{
                        fontSize: "0.7rem",
                        background: "rgba(59, 130, 246, 0.1)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        color: "var(--color-primary)",
                        fontWeight: 600
                      }}>
                        Ready for parsing
                      </div>
                    </div>
                  ) : (
                    <div className="raw-text-container">
                      {activeDoc.rawText}
                    </div>
                  )}
                </div>
              ) : (
                <div className="placeholder-state" style={{ height: "240px", border: "1px dashed var(--border-color)", borderRadius: "10px" }}>
                  <div className="placeholder-icon">📄</div>
                  <p style={{ fontSize: "0.8rem" }}>No document loaded in session.</p>
                </div>
              )}

              <div className="tab-switcher" style={{ display: "flex", gap: "8px", marginTop: "24px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <button 
                  type="button"
                  className={`btn ${inputTab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1, minHeight: "32px" }}
                  onClick={() => setInputTab("text")}
                >
                  Paste Text
                </button>
                <button 
                  type="button"
                  className={`btn ${inputTab === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1, minHeight: "32px" }}
                  onClick={() => setInputTab("file")}
                >
                  Upload PDF / Image
                </button>
              </div>

              {inputTab === "text" ? (
                /* Custom Document Entry Form */
                <form onSubmit={handleLoadCustomDoc} className="custom-upload-zone" style={{ marginTop: "0" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600 }}>Paste Custom Text Doc</p>
                  <input
                    type="text"
                    placeholder="Document Name (e.g. John Payslip)"
                    className="custom-input"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                  <div className="custom-row">
                    <select
                      className="custom-select"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                    >
                      <option value="Salary Slip">Salary Slip</option>
                      <option value="Bank Statement">Bank Statement</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Paste OCR text or financial raw statements here..."
                    className="custom-textarea"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: "8px" }}>
                    Load Text into Session
                  </button>
                </form>
              ) : (
                /* File Upload Zone */
                <form onSubmit={handleLoadUploadedFile} className="custom-upload-zone" style={{ marginTop: "0" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600 }}>Upload Real PDF or Image</p>
                  <div className="custom-row">
                    <select
                      className="custom-select"
                      style={{ width: "100%" }}
                      value={fileUploadType}
                      onChange={(e) => setFileUploadType(e.target.value)}
                    >
                      <option value="Salary Slip">Salary Slip</option>
                      <option value="Bank Statement">Bank Statement</option>
                    </select>
                  </div>
                  <div style={{
                    border: "1px dashed var(--border-color-hover)",
                    borderRadius: "8px",
                    padding: "16px",
                    textAlign: "center",
                    background: "rgba(255,255,255,0.01)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer"
                  }} onClick={() => document.getElementById("file-input").click()}>
                    <span style={{ fontSize: "1.5rem" }}>📤</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                      {selectedFile ? selectedFile.name : "Select PDF or PNG/JPG Image"}
                    </span>
                    <input
                      id="file-input"
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/jpg"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-secondary" 
                    style={{ padding: "8px" }}
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? "Reading File..." : "Load File into Session"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Column 2: Underwriting & Field Extraction Dashboard */}
        <section className="column">
          <div className="column-card glass-panel" style={{ flex: 1.3 }}>
            <h2 className="card-title">Analysis & Evaluation</h2>
            
            <div className="action-bar">
              <button 
                className="btn btn-primary" 
                onClick={handleExtractData}
                disabled={!activeDoc || loadingExtract}
              >
                {loadingExtract ? <span className="loading-spinner"></span> : "1. Extract Data"}
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleRunUnderwriting}
                disabled={!extraction || loadingRules}
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.4)" }}
              >
                {loadingRules ? <span className="loading-spinner"></span> : "2. Evaluate Rules"}
              </button>
            </div>

            <div className="card-scroll-area">
              {!extraction ? (
                <div className="placeholder-state" style={{ padding: "80px 0" }}>
                  <div className="placeholder-icon">⚙️</div>
                  <p style={{ fontSize: "0.85rem", maxWidth: "250px" }}>
                    Select a document and trigger <strong>Extract Data</strong> to parse financial fields.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Fields Extraction Display */}
                  <h3 style={{ fontSize: "0.95rem", color: "#ffffff", marginBottom: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Extracted Applicant Profile</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Parsed via LLM</span>
                  </h3>
                  
                  <div className="extraction-list">
                    
                    {/* Holder Name */}
                    <div className="extraction-item">
                      <div className="extraction-header">
                        <span className="field-name">Account Holder</span>
                        <span className="field-value">{extraction.accountHolderName}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>Source verification:</span>
                        <span className="confidence-indicator">
                          <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.accountHolderName) }}></span>
                          Confidence: {(extraction.confidenceScores?.accountHolderName * 100).toFixed(0)}%
                        </span>
                      </div>
                      {extraction.evidence?.accountHolderName && (
                        <div className="evidence-box">"{extraction.evidence.accountHolderName}"</div>
                      )}
                    </div>

                    {/* Employer */}
                    <div className="extraction-item">
                      <div className="extraction-header">
                        <span className="field-name">Employer</span>
                        <span className="field-value">{extraction.employer}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>Source verification:</span>
                        <span className="confidence-indicator">
                          <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.employer) }}></span>
                          Confidence: {(extraction.confidenceScores?.employer * 100).toFixed(0)}%
                        </span>
                      </div>
                      {extraction.evidence?.employer && (
                        <div className="evidence-box">"{extraction.evidence.employer}"</div>
                      )}
                    </div>

                    {/* Monthly Income */}
                    <div className="extraction-item">
                      <div className="extraction-header">
                        <span className="field-name">Net Monthly Income</span>
                        <span className="field-value" style={{ color: "var(--color-success)" }}>
                          {formatCurrency(extraction.monthlyIncome)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>Source verification:</span>
                        <span className="confidence-indicator">
                          <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.monthlyIncome) }}></span>
                          Confidence: {(extraction.confidenceScores?.monthlyIncome * 100).toFixed(0)}%
                        </span>
                      </div>
                      {extraction.evidence?.monthlyIncome && (
                        <div className="evidence-box">"{extraction.evidence.monthlyIncome}"</div>
                      )}
                    </div>

                    {/* Average Bank Balance (Bank Statement only) */}
                    {extraction.documentType === "Bank Statement" && (
                      <div className="extraction-item">
                        <div className="extraction-header">
                          <span className="field-name">Average Bank Balance</span>
                          <span className="field-value" style={{ color: "#60a5fa" }}>
                            {formatCurrency(extraction.averageBankBalance)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          <span>Source verification:</span>
                          <span className="confidence-indicator">
                            <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.averageBankBalance) }}></span>
                            Confidence: {(extraction.confidenceScores?.averageBankBalance * 100).toFixed(0)}%
                          </span>
                        </div>
                        {extraction.evidence?.averageBankBalance && (
                          <div className="evidence-box">"{extraction.evidence.averageBankBalance}"</div>
                        )}
                      </div>
                    )}

                    {/* Existing EMI */}
                    <div className="extraction-item">
                      <div className="extraction-header">
                        <span className="field-name">Existing Loan EMIs</span>
                        <span className="field-value" style={{ color: "var(--color-warning)" }}>
                          {formatCurrency(extraction.existingEMI)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>Source verification:</span>
                        <span className="confidence-indicator">
                          <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.existingEMI) }}></span>
                          Confidence: {(extraction.confidenceScores?.existingEMI * 100).toFixed(0)}%
                        </span>
                      </div>
                      {extraction.evidence?.existingEMI && (
                        <div className="evidence-box">"{extraction.evidence.existingEMI}"</div>
                      )}
                    </div>

                    {/* Bounced Transactions */}
                    <div className="extraction-item">
                      <div className="extraction-header">
                        <span className="field-name">NSF / Bounced Count</span>
                        <span className="field-value" style={{ color: extraction.bouncedTransactions > 0 ? "var(--color-danger)" : "var(--text-primary)" }}>
                          {extraction.bouncedTransactions} times
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>Source verification:</span>
                        <span className="confidence-indicator">
                          <span className="confidence-dot" style={{ backgroundColor: getConfidenceBadgeColor(extraction.confidenceScores?.bouncedTransactions) }}></span>
                          Confidence: {(extraction.confidenceScores?.bouncedTransactions * 100).toFixed(0)}%
                        </span>
                      </div>
                      {extraction.evidence?.bouncedTransactions && (
                        <div className="evidence-box">"{extraction.evidence.bouncedTransactions}"</div>
                      )}
                    </div>
                  </div>

                  {/* Underwriting Rules Display */}
                  {underwriting && (
                    <div className="decision-card-container">
                      <h3 style={{ fontSize: "0.95rem", color: "#ffffff", marginBottom: "12px" }}>
                        Underwriting Verdict
                      </h3>

                      <div className={`decision-hero ${underwriting.decision.toLowerCase().replace(" ", "")}`}>
                        <span className="decision-label">Automated Decision</span>
                        <span className="decision-value">{underwriting.decision}</span>
                      </div>

                      <div className="rules-list">
                        {underwriting.rules.map((rule, index) => (
                          <div key={index} className="rule-check-item">
                            <div className="rule-icon">
                              {rule.status === "PASS" ? (
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                  <circle cx="10" cy="10" r="9" fill="var(--color-success-glow)" stroke="var(--color-success)" strokeWidth="2"/>
                                  <path d="M6 10l3 3 5-6" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              ) : rule.status === "FAIL" ? (
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                  <circle cx="10" cy="10" r="9" fill="var(--color-danger-glow)" stroke="var(--color-danger)" strokeWidth="2"/>
                                  <path d="M6 6l8 8m0-8l-8 8" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                  <circle cx="10" cy="10" r="9" fill="rgba(255,255,255,0.05)" stroke="var(--text-muted)" strokeWidth="2"/>
                                  <path d="M7 10h6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
                                </svg>
                              )}
                            </div>
                            <div className="rule-details">
                              <span className="rule-name">{rule.name}</span>
                              <span className="rule-desc">{rule.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {underwriting.reasons?.length > 0 && (
                        <div className="remarks-box">
                          <div className="remarks-title">Decision Audit Log:</div>
                          <ul className="remarks-list">
                            {underwriting.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Column 3: Grounded Q&A chatbot */}
        <section className="column chat-column">
          <div className="column-card glass-panel">
            <h2 className="card-title">Grounded Audit Chat</h2>
            
            <div className="chat-history">
              {chatHistory.length === 0 ? (
                <div className="placeholder-state" style={{ height: "100%" }}>
                  <div className="placeholder-icon">💬</div>
                  <p style={{ fontSize: "0.82rem", maxWidth: "250px" }}>
                    Ask questions grounded in the parsed document and underwriting metrics.
                  </p>
                </div>
              ) : (
                chatHistory.map((chat, idx) => (
                  <div key={idx} className={`chat-bubble ${chat.role}`}>
                    {chat.content}
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="chat-bubble assistant" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span className="loading-spinner"></span>
                  <span style={{ fontSize: "0.78rem" }}>AI is auditing...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick suggested prompt questions */}
            {activeDoc && (
              <div className="suggested-questions-grid">
                <button 
                  className="suggestion-btn" 
                  onClick={() => handleSendChatMessage("What monthly income was extracted from the document?")}
                  disabled={chatLoading}
                >
                  "What monthly income was extracted?"
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSendChatMessage("Explain the reasons for the underwriting decision.")}
                  disabled={chatLoading || !underwriting}
                >
                  "Explain the decision rules."
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSendChatMessage("Are there any bounced transactions or NSF checks?")}
                  disabled={chatLoading}
                >
                  "Any bounced checks?"
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSendChatMessage("What is the name of the employer listed in the document?")}
                  disabled={chatLoading}
                >
                  "Who is the employer?"
                </button>
              </div>
            )}

            {/* Message input */}
            <div className="chat-input-area">
              <input
                type="text"
                className="chat-input"
                placeholder={activeDoc ? "Ask a grounded auditor question..." : "Select a document to begin chat"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                disabled={!activeDoc || chatLoading}
              />
              <button 
                className="btn btn-primary"
                onClick={() => handleSendChatMessage()}
                disabled={!activeDoc || !chatInput.trim() || chatLoading}
                style={{ padding: "10px 14px" }}
              >
                Send
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
