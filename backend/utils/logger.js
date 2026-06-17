// Structured Logger Utility

export const logger = {
  info: (msg, meta = {}) => log('INFO', msg, meta),
  warn: (msg, meta = {}) => log('WARN', msg, meta),
  error: (msg, meta = {}) => log('ERROR', msg, meta)
};

function log(level, msg, meta = {}) {
  const timestamp = new Date().toISOString();
  const traceId = meta.userId || 'SYSTEM';
  
  // Format log as structured JSON or human-readable string
  const logObj = {
    timestamp,
    level,
    traceId,
    message: msg,
    ...meta
  };

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logObj));
  } else {
    const metaStr = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [${level}] [User: ${traceId}] ${msg}${metaStr}`);
  }
}
