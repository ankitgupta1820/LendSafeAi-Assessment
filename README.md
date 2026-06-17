# LendSafe AI - Document Parsing & Underwriting Decision Automation

LendSafe AI is an automated document intelligence and underwriting audit platform. It allows lending teams to upload or select financial documents (salary slips, bank statements), extract critical metrics using LLMs, execute decision rules, and perform grounded audit checks via chat.

## Features

1. **Multi-Tenant Session Scoping**: Implements simulated access isolation. Switching between user roles in the header fetches/isolates session state and chat history.
2. **AI Document Extraction**: Communicates with the LLM Wrapper API to extract fields, confidence levels, and direct document text evidence.
3. **Underwriting Decision Engine**: Evaluates the profile against four programmatic risk rules.
4. **Grounded Q&A Chatbot**: A chatbot loaded with the document content and decision rules to answer questions accurately without hallucinating.

---

## Technical Stack

* **Frontend**: React (Vite-scaffolded, Javascript), Vanilla CSS (glassmorphism UI with responsive grid).
* **Backend**: Node.js + Express, Axios (calls to the LLM Wrapper).

---

## Extraction Schema & Assumptions

The LLM extracts the following schema structure:
* `accountHolderName` (String): Full name of the applicant.
* `employer` (String): Employing company or client paying the applicant.
* `monthlyIncome` (Number): Net monthly salary or income deposits.
* `deductions` (Number): Deductions listed on salary slips.
* `averageBankBalance` (Number): Average balance (applicable to bank statements).
* `existingEMI` (Number): Existing monthly debt/loan payments.
* `bouncedTransactions` (Number): NSF or check bounce events count.
* `documentType` (String): "Salary Slip" or "Bank Statement".
* `confidenceScores` (Object): Numeric values from `0.0` to `1.0` indicating certainty of each field.
* `evidence` (Object): Verbatim source sentences extracted from the raw document for auditing.

---

## Underwriting Rules Engine

1. **Minimum income check**: Monthly income must be $\ge \$2,000$.
2. **FOIR / Debt-to-Income check**: $\text{existing EMI} / \text{monthly income} \le 40\%$.
3. **Average balance sufficiency**: Average bank statement balance must be $\ge 2 \times \text{existing EMIs}$ (skipped for salary slips).
4. **Repayment cleanliness**: Account bounces must be exactly $0$.

### Decision Outputs:
* **Approve**: All rules passed and extraction confidence is high.
* **Manual Review**: Triggers if any field extraction confidence is $< 0.8$, or if rules have borderline outcomes (DTI between 35% and 40% / Income within $500 of the minimum).
* **Reject**: Any critical rule check fails.

---

## Known Limitations

1. **OCR Text Formatting Dependency**: The LLM relies on readable, scanned text representation. OCR noise or corrupt scan segments can lead to lower confidence.
2. **Stateless Wrapper**: Since the LLM wrapper is stateless, the backend maintains current sessions and context.
3. **In-Memory Store**: Session state is persisted in-memory on the backend. Restarting the server clears the data.

---

## Installation and Setup

### Prerequisites
* Node.js (v18 or higher recommended)
* npm (v9 or higher)

### Setup & Launch Instructions

1. **Backend Server**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   The backend will start on `http://localhost:5000`.

2. **Frontend React Application**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The Vite developer server will start (usually on `http://localhost:5173`). Open the browser link to interact with the application.

---

*Made with ❤️ by Ankit*
