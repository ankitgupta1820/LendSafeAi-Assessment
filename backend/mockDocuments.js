export const mockDocuments = [
  {
    id: "john_doe_payslip",
    name: "John Doe - Salary Slip (Healthy Profile)",
    type: "Salary Slip",
    rawText: `================================================
GLOBAL TECH SOLUTIONS INC. - PAYSLIP
================================================
Employee Name      : John Doe
Employee ID        : GTS-84920
Pay Period         : May 1 - May 31, 2026
Designation        : Senior Software Engineer
Bank Account       : Chase Bank ****4321
------------------------------------------------
EARNINGS                    DEDUCTIONS
------------------------------------------------
Basic Salary  : $5,000.00   Tax Deductions : $900.00
HRA           : $1,000.00   Health Ins.    : $250.00
Allowances    :   $500.00   401k Contrib.  : $350.00
------------------------------------------------
Gross Earnings: $6,500.00   Total Deduct.  : $1,500.00
------------------------------------------------
NET PAYABLE   : $5,000.00
(Five Thousand US Dollars Only)
------------------------------------------------
Additional Financial Disclosure:
- Declared monthly recurring EMI/obligations: $400.00 (Car Loan)
- Employer status: Active, Full-time
================================================`
  },
  {
    id: "jane_smith_bank_statement",
    name: "Jane Smith - Bank Statement (High Debt-To-Income)",
    type: "Bank Statement",
    rawText: `================================================
FIDELITY UNION BANK - ACCOUNT STATEMENT
================================================
Account Holder  : Jane Smith
Account Number  : FUB-993201492
Statement Period: May 1 - May 31, 2026
Currency        : USD ($)
------------------------------------------------
SUMMARY
------------------------------------------------
Opening Balance      : $950.00
Total Credits (Direct): $4,000.00 (from BioLab Inc. Salary)
Total Debits         : $4,200.00
Average Daily Balance: $650.00
------------------------------------------------
RECURRING MONTHLY OBLIGATIONS (EMIs)
------------------------------------------------
- Housing Mortgage   : $1,800.00 (Debited on May 5)
- Auto Loan EMI      : $300.00   (Debited on May 12)
- Total Monthly EMIs : $2,100.00
------------------------------------------------
BOUNCED / RETURN CHECK REPORT
------------------------------------------------
No bounced/NSF (Non-Sufficient Funds) events recorded during the statement period.
================================================`
  },
  {
    id: "bob_johnson_statement",
    name: "Bob Johnson - Bank Statement (Bounced Transactions)",
    type: "Bank Statement",
    rawText: `================================================
VALLEY NATIONAL BANK - ACCOUNT STATEMENT
================================================
Account Holder  : Bob Johnson
Account Number  : VNB-10023910
Statement Period: May 1 - May 31, 2026
Currency        : USD ($)
------------------------------------------------
SUMMARY
------------------------------------------------
Opening Balance      : $12,500.00
Total Credits        : $15,000.00 (Johnson Consulting LLC)
Total Debits         : $18,200.00
Average Daily Balance: $8,500.00
------------------------------------------------
RECURRING MONTHLY OBLIGATIONS (EMIs)
------------------------------------------------
- Business Equipment Lease : $1,200.00
- Credit Card Min Due      : $600.00
- Total Monthly EMIs       : $1,800.00
------------------------------------------------
BOUNCED / RETURN CHECK & NSF DETAILS
------------------------------------------------
- May 12, 2026: NSF Bounced Auto-Debit (Rent payment) - Fee $35.00
- May 18, 2026: NSF Bounced Cheque #4928 - Fee $35.00
- May 25, 2026: NSF Bounced Cheque #4931 - Fee $35.00
- Total Bounced Events this month: 3
================================================`
  },
  {
    id: "low_quality_payslip",
    name: "Alex Mercer - Poor Quality Document (Scan Error)",
    type: "Salary Slip",
    rawText: `================================================
APEX IN...STR...S  - P...YSL...P  (SCAN CORRUPTED)
================================================
Empl... Name      : Alex M...rc...r
Bank Account       : W...lls F...rgo ****8812
------------------------------------------------
EARN...GS                    DE...UCTIONS
------------------------------------------------
Ba...ic S...la...y: $3,500   Taxes          : $???.00
Allow...nce       : $???.??  Other          : $150.00
------------------------------------------------
Gross Earn...s: $????.??     T...t...l      : $500.00
------------------------------------------------
NET PAYABLE   : $3,000.00 (approximate due to ink smudge)
------------------------------------------------
Declared monthly EMI: $1,500.00 (Unconfirmed mortgage)
Bounces: 0
================================================`
  }
];
