Document Parsing & Loan Decision Automation
Fintech Lending AI Interview Case Study | Expected Time: ~1 Hour
Assignment Type
AI Build / Prototype	Suggested Tools
Cursor + Claude API / Any Stack	Difficulty
SE

1. Problem Statement
Develop an AI-assisted document intelligence system that extracts financial information from uploaded loan documents and applies underwriting rules to generate an approval recommendation. The system should support document-grounded answers and highlight extraction confidence or uncertainty.
2. Business Context
Loan processing teams spend significant time reviewing salary slips, bank statements, tax returns, business financials, and identity documents. Manual review can delay approvals, introduce inconsistency, and increase operational cost. AI-based document parsing can accelerate underwriting by converting unstructured documents into structured data and decision-ready insights.
The objective is not only to build a working prototype, but also to demonstrate how AI can be applied safely, transparently, and pragmatically in a lending environment where financial decisions must be explainable and operationally useful.
3. Scope & Constraints
•	PDF/image upload may be simulated; OCR output can be mocked.
•	Perfect extraction accuracy is not required.
•	The solution should focus on structure, confidence handling, and decision logic.
•	Production-grade document verification or forgery detection is not required.
•	Any technology stack may be used.
4. Functional Requirements
•	Allow upload or simulated upload of documents such as salary slip, bank statement, or business income statement.
•	Extract fields such as monthly income, employer, deductions, average bank balance, existing EMI, bounced transactions, and account holder name.
•	Map extracted data into a structured applicant profile.
•	Apply underwriting rules such as minimum income, FOIR/DTI threshold, balance sufficiency, and repayment capacity.
•	Generate a decision: Approve, Reject, or Manual Review with reasons.
•	Allow document-grounded questions such as “What income was extracted?” or “Which rule caused manual review?”
5. Security & Privacy
Documents and extracted financial data must be scoped to the uploading user/application. Simulate access control using user ID or application token. Do not expose raw document data across users.
Candidates should explicitly describe how user-level access, data isolation, and sensitive-data handling would work in a real implementation, even if authentication is mocked for the prototype.
6. Expected Deliverables
•	Working upload or mocked OCR demo.
•	Structured extraction output and underwriting decision engine.
•	Prompt design for grounded extraction and Q&A.
•	README describing document assumptions, extraction schema, and known limitations.
7. Evaluation Criteria
•	Quality of extraction schema and handling of missing data.
•	Correctness and clarity of decision rules.
•	Grounded AI responses and uncertainty handling.
•	Security around document access.
•	Maintainable code and professional presentation.
8. Bonus (Optional)
•	Confidence score per extracted field.
•	Side-by-side document evidence references.
•	Comparison across multiple months of bank statements or payslips.
9. Candidate Guidance
•	Prioritize a clear end-to-end flow over unnecessary complexity.
•	Use small but realistic mock data to demonstrate the core decision logic.
•	Make AI responses grounded, concise, and auditable.
•	Clearly document assumptions, limitations, and trade-offs in the README.
•	Be prepared to explain architecture, prompts, edge cases, and failure modes during the demo.
End of Assignment
