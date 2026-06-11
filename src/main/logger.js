const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function fmt(level, scope, args) {
  const ts = new Date().toISOString();
  const head = `[${ts}] [${level.toUpperCase()}]${scope ? ` [${scope}]` : ''}`;
  return [head, ...args];
}

export function createLogger(scope) {
  return {
    error: (...args) => CURRENT >= LEVELS.error && console.error(...fmt('error', scope, args)),
    warn: (...args) => CURRENT >= LEVELS.warn && console.warn(...fmt('warn', scope, args)),
    info: (...args) => CURRENT >= LEVELS.info && console.info(...fmt('info', scope, args)),
    debug: (...args) => CURRENT >= LEVELS.debug && console.debug(...fmt('debug', scope, args))
  };
}

export function setLogLevel(level) {
  if (level in LEVELS) {
    process.env.LOG_LEVEL = level;
  }
}
