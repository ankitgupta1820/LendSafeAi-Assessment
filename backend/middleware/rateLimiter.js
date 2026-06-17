import { logger } from "../utils/logger.js";

const rateLimitStore = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60;     // Limit to 60 requests per minute

export const rateLimiter = (req, res, next) => {
  const userId = req.headers["x-user-id"] || req.ip || "unknown";
  const now = Date.now();

  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, []);
  }

  const timestamps = rateLimitStore.get(userId);
  
  // Remove timestamps outside of the 1-minute window
  const activeTimestamps = timestamps.filter(t => now - t < WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_REQUESTS) {
    logger.warn(`API Rate limit exceeded`, { userId });
    return res.status(429).json({
      error: "Rate limit exceeded. Too many requests. Please retry in a minute."
    });
  }

  activeTimestamps.push(now);
  rateLimitStore.set(userId, activeTimestamps);
  next();
};

// Periodically clean stale keys from memory every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of rateLimitStore.entries()) {
    const active = timestamps.filter(t => now - t < WINDOW_MS);
    if (active.length === 0) {
      rateLimitStore.delete(userId);
    } else {
      rateLimitStore.set(userId, active);
    }
  }
}, 10 * 60 * 1000).unref();
