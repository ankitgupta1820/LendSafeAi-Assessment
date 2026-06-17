import axios from "axios";
import { logger } from "../utils/logger.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const llmService = {
  query: async (requestBody, userId = "SYSTEM") => {
    const url = process.env.LLM_WRAPPER_URL || "https://llm-wrapper-741152993481.asia-south1.run.app";
    const token = process.env.LLM_WRAPPER_TOKEN;

    if (!token || token.trim() === "") {
      logger.error("LLM Wrapper Token configuration is missing in environment variables.", { userId });
      throw new Error("Server API token is not configured. Please set LLM_WRAPPER_TOKEN in server configuration.");
    }

    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      try {
        logger.info(`Invoking LLM Wrapper (Attempt ${attempt}/${maxRetries})`, { userId });
        
        const response = await axios.post(
          `${url}/llm/query`,
          requestBody,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            timeout: 20000 // 20s timeout limit
          }
        );

        let result = response.data;
        if (typeof result === "object") {
          if (result.response) {
            result = result.response;
          } else if (result.reply) {
            result = result.reply;
          }
        }
        
        if (typeof result !== "string") {
          logger.error("LLM returned non-string response format", { userId });
          throw new Error("Received invalid payload format from the parsing engine.");
        }
        
        return result;
      } catch (error) {
        // Retry only on timeouts or server gateway issues (502, 503, 504)
        const isTimeout = error.code === "ECONNABORTED";
        const isServerErr = error.response && [502, 503, 504].includes(error.response.status);
        const isTransient = isTimeout || isServerErr;
        
        logger.warn(`LLM request attempt ${attempt} failed: ${error.message}`, {
          userId,
          status: error.response?.status,
          code: error.code
        });

        if (attempt >= maxRetries || !isTransient) {
          throw new Error(`LLM Query failed: ${error.response?.data?.message || error.message}`);
        }

        const backoffMs = attempt * 1000;
        logger.info(`Backing off for ${backoffMs}ms before next retry...`, { userId });
        await wait(backoffMs);
      }
    }
  }
};
