/**
 * Frontend app logger with UI transport: errors show in a modal, warnings do not.
 * logger.error() and console.error (when patched) → console + modal.
 * logger.warn() and console.warn are console-only. Call installConsoleToModal() to patch console.error.
 */

export const LOGGER_UI_EVENT = 'dotbot-logger-ui';

export type LoggerUILevel = 'error' | 'warn';

export interface LoggerUIEventDetail {
  message: string;
  level: LoggerUILevel;
}

function formatMessage(msg: unknown, meta?: Record<string, unknown>): string {
  if (msg instanceof Error) return msg.message;
  if (typeof msg === 'string') {
    if (meta && Object.keys(meta).length > 0) {
      try {
        return `${msg} ${JSON.stringify(meta)}`;
      } catch {
        return msg;
      }
    }
    return msg;
  }
  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

function emitToUI(message: string, level: LoggerUILevel): void {
  window.dispatchEvent(
    new CustomEvent<LoggerUIEventDetail>(LOGGER_UI_EVENT, {
      detail: { message, level },
    })
  );
}

const appLogger = {
  error(msg: unknown, meta?: Record<string, unknown>): void {
    const message = formatMessage(msg, meta);
    console.error('[App]', message, meta ?? '');
    if (shouldEmitToModal(message)) emitToUI(message, 'error');
  },

  warn(msg: unknown, meta?: Record<string, unknown>): void {
    const message = formatMessage(msg, meta);
    console.warn('[App]', message, meta ?? '');
    // No UI transport for warnings – modal is errors only
  },

  info(msg: unknown, meta?: Record<string, unknown>): void {
    const message = formatMessage(msg, meta);
    console.info('[App]', message, meta ?? '');
    // no UI transport for info
  },
};

/** Extract a real error/message string from a value (Error, or object with .message / .err). */
function extractMessage(v: unknown): string | null {
  if (v instanceof Error && v.message) return v.message;
  if (v && typeof v === 'object' && typeof (v as { message?: unknown }).message === 'string') {
    return (v as { message: string }).message;
  }
  if (v && typeof v === 'object' && (v as { err?: unknown }).err instanceof Error) {
    return (v as { err: Error }).err.message || null;
  }
  return null;
}

/** True if s looks like a timestamp (e.g. "2026-02-28 04:18:37") or a bare log tag with no message. */
function isTimestampOrTag(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return true;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) return true;
  if (/^\[[\w.]+\](\s*\[\w+\])*$/.test(trimmed)) return true;
  if (/^(Error|Warning)$/i.test(trimmed)) return true;
  return false;
}

/** True if message is internal/Polkadot API noise we don't want in the modal (e.g. runtime API version warnings). */
function isInternalNoise(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  if (/API\/INIT:/i.test(t)) return true;
  if (/Not decorating runtime apis/i.test(t)) return true;
  if (/\b(BeefyApi|DryRunApi|ParachainHost)\/\d+/i.test(t) && /\bknown\)/i.test(t)) return true;
  return false;
}

/**
 * Build a single message for the modal from console args.
 * Prefer the actual error message (Error or object.message); skip tags and timestamps.
 * When logger uses (prefix, message) e.g. console.error("[ScenarioEngine] [ERROR]", "Scenario failed: ..."),
 * use the first meaningful string (the real message), not the tag.
 */
function formatConsoleArgs(args: unknown[]): string {
  if (args.length === 0) return '';

  const firstError = args.find((a): a is Error => a instanceof Error);
  const fromError = firstError ? firstError.message || String(firstError) : null;
  const fromObj = args.map(extractMessage).find(Boolean) as string | undefined;
  const firstString =
    args.length > 0 && typeof args[0] === 'string' ? args[0].trim() : null;

  const actualMessage = fromError ?? fromObj ?? null;
  if (actualMessage) {
    if (firstString && !isTimestampOrTag(firstString) && firstString !== actualMessage && !actualMessage.includes(firstString)) {
      return `${firstString}: ${actualMessage}`;
    }
    return actualMessage;
  }
  if (firstString && !isTimestampOrTag(firstString)) return firstString;
  // First arg is a tag/timestamp; use first other string that is the real message (e.g. ScenarioEngine: console.error("[ScenarioEngine] [ERROR]", "Scenario failed: ..."))
  const firstMeaningfulString = args
    .filter((a): a is string => typeof a === 'string')
    .map((s) => s.trim())
    .find((s) => s.length > 0 && !isTimestampOrTag(s));
  if (firstMeaningfulString) return firstMeaningfulString;
  if (args[0] != null && typeof args[0] === 'object') {
    try {
      const s = JSON.stringify(args[0]);
      if (s && s !== '{}') return s;
    } catch {
      // ignore
    }
  }
  return '';
}

/** Only show modal when we have a real message, not a timestamp, bare tag, or internal noise. */
function shouldEmitToModal(message: string): boolean {
  const t = message.trim();
  return t.length > 0 && !isTimestampOrTag(t) && !isInternalNoise(t);
}

/**
 * Optional: patch console.error/warn so existing frontend console logs also show in the modal.
 * Only shows when we can extract a real error message (skips timestamps and bare tags).
 */
export function installConsoleToModal(): void {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    origError(...args);
    const message = formatConsoleArgs(args);
    if (shouldEmitToModal(message)) emitToUI(message, 'error');
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    // No modal for warnings – errors only
  };
}

export { appLogger };
