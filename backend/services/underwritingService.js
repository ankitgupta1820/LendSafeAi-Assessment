// Underwriting Rules Engine Service

export const underwritingService = {
  evaluateRules: (ext) => {
    if (!ext) {
      throw new Error("No extraction profile available to underwrite.");
    }

    const currencySymbol = ext.currency || "$";
    const MIN_INCOME = currencySymbol === "₹" ? 20000 : 2000;
    const MAX_FOIR = 40;     // Max Debt-To-Income 40%
    const MIN_BAL_MULTIPLIER = 2; // Min balance: 2x EMI
    const INCOME_MARGIN = currencySymbol === "₹" ? 5000 : 500;

    const rules = [];

    // Rule 1: Minimum Net Income Check
    const netIncome = ext.monthlyIncome || 0;
    const passedIncome = netIncome >= MIN_INCOME;
    rules.push({
      name: "Minimum Net Income Check",
      description: `Requires net monthly income of at least ${currencySymbol}${MIN_INCOME}. Extracted: ${currencySymbol}${netIncome}`,
      status: passedIncome ? "PASS" : "FAIL",
      critical: true
    });

    // Rule 2: FOIR / Debt-to-Income (DTI) Ratio Check
    let foirVal = 0;
    let passedFOIR = true;
    const existingEMI = ext.existingEMI || 0;
    if (netIncome > 0) {
      foirVal = (existingEMI / netIncome) * 100;
      passedFOIR = foirVal <= MAX_FOIR;
    } else if (existingEMI > 0) {
      passedFOIR = false; // EMI exists but income is 0
    }
    rules.push({
      name: "FOIR / Debt-to-Income Ratio Check",
      description: `Total EMIs (${currencySymbol}${existingEMI}) must not exceed ${MAX_FOIR}% of net income (${currencySymbol}${netIncome}). Calculated FOIR: ${foirVal.toFixed(1)}%`,
      status: passedFOIR ? "PASS" : "FAIL",
      critical: true
    });

    // Rule 3: Balance Sufficiency Check (only applies to Bank Statements with active EMIs)
    if (ext.documentType === "Bank Statement" && existingEMI > 0) {
      const averageBankBalance = ext.averageBankBalance || 0;
      const requiredMinBalance = existingEMI * MIN_BAL_MULTIPLIER;
      const passedBalance = averageBankBalance >= requiredMinBalance;
      rules.push({
        name: "Average Balance Sufficiency Check",
        description: `Average bank balance (${currencySymbol}${averageBankBalance}) must cover at least 2x existing EMIs (${currencySymbol}${requiredMinBalance}).`,
        status: passedBalance ? "PASS" : "FAIL",
        critical: false
      });
    }

    // Rule 4: Repayment Cleanliness (Bounces check)
    const bouncedCount = ext.bouncedTransactions || 0;
    const passedBounces = bouncedCount === 0;
    rules.push({
      name: "Repayment Cleanliness (Bounces)",
      description: `Applicant must have zero bounced/NSF transactions. Extracted: ${bouncedCount} bounces`,
      status: passedBounces ? "PASS" : "FAIL",
      critical: true
    });

    // Underwriting Decision Logic
    let decision = "Approve";
    const reasons = [];

    // Check failures
    const hasCriticalFail = rules.some(r => r.critical && r.status === "FAIL");
    const hasNonCriticalFail = rules.some(r => !r.critical && r.status === "FAIL");

    // Extract low confidence fields (confidence < 0.8)
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
      // Borderline checks for Manual Review triggers
      if (foirVal > 35 && foirVal <= 40) {
        decision = "Manual Review";
        reasons.push("Borderline FOIR: Debt-to-income is high (between 35% and 40%).");
      }
      if (netIncome >= MIN_INCOME && netIncome < MIN_INCOME + INCOME_MARGIN) {
        decision = "Manual Review";
        reasons.push(`Borderline income: Monthly income (${currencySymbol}${netIncome}) is close to minimum threshold of ${currencySymbol}${MIN_INCOME}.`);
      }
    }

    if (decision === "Approve") {
      reasons.push("All underwriting rules satisfied with healthy financial margins.");
    }

    return {
      decision,
      reasons,
      rules,
      analyzedAt: new Date().toISOString()
    };
  }
};
