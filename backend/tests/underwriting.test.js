import test from 'node:test';
import assert from 'node:assert';
import { underwritingService } from '../services/underwritingService.js';

test('Underwriting Service - evaluateRules', async (t) => {

  await t.test('should throw an error if extraction profile is missing', () => {
    assert.throws(() => {
      underwritingService.evaluateRules(null);
    }, /No extraction profile available to underwrite/);
  });

  await t.test('should Approve a healthy USD profile', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 5000,
      existingEMI: 1000, // FOIR = 20%
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9,
        existingEMI: 0.95
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Approve');
    assert.ok(result.reasons.includes('All underwriting rules satisfied with healthy financial margins.'));
    
    // Check individual rules status
    const incomeRule = result.rules.find(r => r.name === 'Minimum Net Income Check');
    assert.strictEqual(incomeRule.status, 'PASS');

    const foirRule = result.rules.find(r => r.name === 'FOIR / Debt-to-Income Ratio Check');
    assert.strictEqual(foirRule.status, 'PASS');

    const bounceRule = result.rules.find(r => r.name === 'Repayment Cleanliness (Bounces)');
    assert.strictEqual(bounceRule.status, 'PASS');
  });

  await t.test('should Reject USD profile due to low income', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 1500, // < 2000 threshold
      existingEMI: 300, // FOIR = 20%
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Reject');
    assert.ok(result.reasons.some(r => r.includes('Minimum Net Income Check')));
  });

  await t.test('should Reject USD profile due to high FOIR (> 40%)', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 3000,
      existingEMI: 1500, // FOIR = 50%
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Reject');
    assert.ok(result.reasons.some(r => r.includes('FOIR / Debt-to-Income Ratio Check')));
  });

  await t.test('should Reject if there are bounced transactions', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 4000,
      existingEMI: 500,
      documentType: 'Pay Slip',
      bouncedTransactions: 2, // Non-zero bounces
      confidenceScores: {
        monthlyIncome: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Reject');
    assert.ok(result.reasons.some(r => r.includes('Repayment Cleanliness (Bounces)')));
  });

  await t.test('should trigger Manual Review for non-critical failures (Average Balance Sufficiency on Bank Statement)', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 5000,
      existingEMI: 1000, // 2x EMI = 2000 needed
      averageBankBalance: 1500, // Average balance insufficient (1500 < 2000)
      documentType: 'Bank Statement',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9,
        existingEMI: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Manual Review');
    assert.ok(result.reasons.some(r => r.includes('Non-Critical Fail: Average Balance Sufficiency Check')));
  });

  await t.test('should trigger Manual Review for low OCR confidence scores', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 5000,
      existingEMI: 500,
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.75, // < 0.8 trigger
        existingEMI: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Manual Review');
    assert.ok(result.reasons.some(r => r.includes('Low OCR confidence on fields')));
  });

  await t.test('should trigger Manual Review for borderline FOIR (between 35% and 40%)', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 10000,
      existingEMI: 3700, // FOIR = 37%
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Manual Review');
    assert.ok(result.reasons.some(r => r.includes('Borderline FOIR')));
  });

  await t.test('should trigger Manual Review for borderline Net Income (USD)', () => {
    const ext = {
      currency: '$',
      monthlyIncome: 2200, // Within +$500 income margin (threshold is $2000)
      existingEMI: 200,
      documentType: 'Pay Slip',
      bouncedTransactions: 0,
      confidenceScores: {
        monthlyIncome: 0.9
      }
    };

    const result = underwritingService.evaluateRules(ext);
    assert.strictEqual(result.decision, 'Manual Review');
    assert.ok(result.reasons.some(r => r.includes('Borderline income')));
  });

  await t.test('should correctly handle INR currency thresholds (income limit, income margin)', async (t) => {
    await t.test('should Approve a healthy INR profile', () => {
      const ext = {
        currency: '₹',
        monthlyIncome: 50000, // > 20000 min income
        existingEMI: 5000, // FOIR = 10%
        documentType: 'Pay Slip',
        bouncedTransactions: 0,
        confidenceScores: {
          monthlyIncome: 0.9
        }
      };

      const result = underwritingService.evaluateRules(ext);
      assert.strictEqual(result.decision, 'Approve');
    });

    await t.test('should Reject an INR profile with income below ₹20,000', () => {
      const ext = {
        currency: '₹',
        monthlyIncome: 18000, // < 20000
        existingEMI: 2000,
        documentType: 'Pay Slip',
        bouncedTransactions: 0,
        confidenceScores: {
          monthlyIncome: 0.9
        }
      };

      const result = underwritingService.evaluateRules(ext);
      assert.strictEqual(result.decision, 'Reject');
      assert.ok(result.reasons.some(r => r.includes('Minimum Net Income Check')));
    });

    await t.test('should trigger Manual Review for borderline INR income (within ₹5,000 margin above ₹20,000)', () => {
      const ext = {
        currency: '₹',
        monthlyIncome: 23000, // Within +5000 margin (20000 - 25000)
        existingEMI: 2000,
        documentType: 'Pay Slip',
        bouncedTransactions: 0,
        confidenceScores: {
          monthlyIncome: 0.9
        }
      };

      const result = underwritingService.evaluateRules(ext);
      assert.strictEqual(result.decision, 'Manual Review');
      assert.ok(result.reasons.some(r => r.includes('Borderline income')));
    });
  });

});
