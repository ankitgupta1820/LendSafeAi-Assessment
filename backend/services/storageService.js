import { logger } from "../utils/logger.js";

const sessionStore = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const storageService = {
  getSession: (userId) => {
    if (!userId) return null;
    const now = Date.now();
    if (!sessionStore.has(userId)) {
      logger.info(`Initializing session context`, { userId });
      sessionStore.set(userId, {
        activeDocument: null,
        extraction: null,
        underwritingResult: null,
        chatHistory: [],
        createdAt: now,
        lastAccessed: now
      });
    } else {
      const session = sessionStore.get(userId);
      session.lastAccessed = now;
    }
    return sessionStore.get(userId);
  },
  
  clearSession: (userId) => {
    if (sessionStore.has(userId)) {
      logger.info(`Clearing session context`, { userId });
      sessionStore.set(userId, {
        activeDocument: null,
        extraction: null,
        underwritingResult: null,
        chatHistory: [],
        createdAt: Date.now(),
        lastAccessed: Date.now()
      });
      return true;
    }
    return false;
  },

  evictExpiredSessions: () => {
    const now = Date.now();
    let evictedCount = 0;
    for (const [userId, session] of sessionStore.entries()) {
      if (now - session.lastAccessed > SESSION_TTL_MS) {
        sessionStore.delete(userId);
        evictedCount++;
        logger.info(`Evicted inactive session`, { userId });
      }
    }
    if (evictedCount > 0) {
      logger.info(`Session clean-up cycle completed. Evicted ${evictedCount} idle session(s). Active size: ${sessionStore.size}`);
    }
  }
};

// Periodic storage clean-up every 5 minutes
setInterval(() => {
  storageService.evictExpiredSessions();
}, 5 * 60 * 1000).unref();
