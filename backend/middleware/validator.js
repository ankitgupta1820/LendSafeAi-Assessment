// Request Validation & Prompt Injection Mitigation Middleware
import { logger } from "../utils/logger.js";

const MAX_TEXT_LENGTH = 100000; // 100KB limit
const MAX_BASE64_SIZE = 11000000; // ~8MB binary limit
const MAX_QUESTION_LENGTH = 500;

export const validator = {
  validateDocumentSelection: (req, res, next) => {
    const { customText, fileBase64, documentId } = req.body;
    const userId = req.headers["x-user-id"] || "unknown";

    if (!documentId && !customText && !fileBase64) {
      return res.status(400).json({ error: "Please provide a documentId, customText, or fileBase64." });
    }

    if (customText && customText.length > MAX_TEXT_LENGTH) {
      logger.warn(`Custom text payload exceeded limit`, { userId, length: customText.length });
      return res.status(400).json({ error: "Custom text payload exceeds the maximum limit of 100KB." });
    }

    if (fileBase64 && fileBase64.length > MAX_BASE64_SIZE) {
      logger.warn(`Base64 file payload exceeded limit`, { userId, size: fileBase64.length });
      return res.status(400).json({ error: "File upload size exceeds the maximum limit of 8MB." });
    }

    next();
  },

  validateChatQuestion: (req, res, next) => {
    const { question } = req.body;
    const userId = req.headers["x-user-id"] || "unknown";

    if (!question || question.trim() === "") {
      return res.status(400).json({ error: "Question cannot be empty." });
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      logger.warn(`Question length limit exceeded`, { userId, length: question.length });
      return res.status(400).json({ error: "Question exceeds the maximum limit of 500 characters." });
    }

    // Prompt injection check patterns
    const normalized = question.toLowerCase();
    const injectionVectors = [
      "ignore previous instructions",
      "ignore all instructions",
      "ignore system instructions",
      "ignore the rules",
      "override system prompt",
      "forget previous rules",
      "forget your instructions",
      "you are now a",
      "new instructions:"
    ];

    const isMatch = injectionVectors.some(vector => normalized.includes(vector));
    if (isMatch) {
      logger.warn(`Potential prompt injection blocked`, { userId, question });
      return res.status(400).json({
        error: "Your question was flagged by audit filters as a potential prompt injection and was blocked."
      });
    }

    next();
  }
};
