'use client';

/**
 * HydrationErrorBoundary
 * ──────────────────────
 * Catches React hydration mismatches at runtime and logs:
 *   • The component tree path where the mismatch occurred
 *   • The trigger function / pattern that caused the divergence
 *   • The exact server vs client value divergence (when extractable)
 *   • A full stack trace
 *
 * Usage:
 *   <HydrationErrorBoundary name="DashboardPage">
 *     <YourComponent />
 *   </HydrationErrorBoundary>
 *
 * In development the boundary renders a visible diagnostic panel.
 * In production it renders a silent fallback (or your custom fallback).
 */

import React, { Component, ErrorInfo, ReactNode, useId, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HydrationDivergence {
  serverValue: string | null;
  clientValue: string | null;
  triggerPattern: string | null;
}

interface HydrationErrorLog {
  timestamp: string;
  boundaryName: string;
  errorMessage: string;
  componentStack: string;
  divergence: HydrationDivergence;
  triggerFunction: string | null;
  stackTrace: string;
}

interface Props {
  children: ReactNode;
  /** Label shown in dev panel and logs (e.g. "PerformanceDashboard") */
  name?: string;
  /** Custom fallback UI for production. Defaults to null (silent). */
  fallback?: ReactNode;
  /** Called with the structured log entry whenever a hydration error is caught */
  onError?: (log: HydrationErrorLog) => void;
}

interface State {
  hasError: boolean;
  log: HydrationErrorLog | null;
}

// ─── Hydration Pattern Detector ───────────────────────────────────────────────

const HYDRATION_PATTERNS: Array<{ pattern: RegExp; trigger: string; hint: string }> = [
  {
    pattern: /Hydration failed|hydration mismatch/i,
    trigger: 'React Hydration Mismatch',
    hint: 'Server-rendered HTML does not match client render. Check for dynamic values in JSX.',
  },
  {
    pattern: /Text content does not match/i,
    trigger: 'Text Content Divergence',
    hint: 'A text node differs between SSR and client. Common causes: new Date(), Math.random(), locale formatting.',
  },
  {
    pattern: /did not match.*server/i,
    trigger: 'Attribute/Content Mismatch',
    hint: 'An HTML attribute or child content differs. Check className, style, or data attributes computed at render time.',
  },
  {
    pattern: /new Date\(\)|Date\.now\(\)/i,
    trigger: 'Dynamic Date',
    hint: 'Move date computation into useEffect + useState.',
  },
  {
    pattern: /Math\.random/i,
    trigger: 'Random Value',
    hint: 'Use useId() for stable IDs or pre-compute random values outside render.',
  },
  {
    pattern: /toLocaleString|toLocaleDateString|toLocaleTimeString/i,
    trigger: 'Locale Formatting',
    hint: 'Pass an explicit locale string or compute inside useEffect.',
  },
  {
    pattern: /localStorage|sessionStorage/i,
    trigger: 'Browser Storage Access',
    hint: 'Guard with typeof localStorage !== "undefined" or access inside useEffect.',
  },
  {
    pattern: /window\.|document\.|navigator\./i,
    trigger: 'Browser API Access',
    hint: 'Wrap in useEffect or guard with typeof window !== "undefined".',
  },
  {
    pattern: /crypto\.randomUUID|crypto\.getRandomValues/i,
    trigger: 'Crypto API',
    hint: 'Use useId() or generate IDs server-side.',
  },
];

function detectTrigger(message: string, stack: string): { trigger: string; hint: string } | null {
  const combined = `${message}\n${stack}`;
  for (const { pattern, trigger, hint } of HYDRATION_PATTERNS) {
    if (pattern.test(combined)) return { trigger, hint };
  }
  return null;
}

/**
 * Attempts to extract the server vs client value from React's hydration
 * error message which typically reads:
 *   "Expected server HTML to contain a matching <X> in <Y>." *"Text content did not match. Server: "foo" Client: "bar""
 */
function extractDivergence(message: string): HydrationDivergence {
  const serverMatch = /[Ss]erver[:\s]+"?([^"]+)"?/.exec(message);
  const clientMatch = /[Cc]lient[:\s]+"?([^"]+)"?/.exec(message);
  const triggerMatch = /\b(new Date|Date\.now|Math\.random|toLocaleString|localStorage|window\.|document\.)\b/.exec(message);

  return {
    serverValue: serverMatch ? serverMatch[1].trim() : null,
    clientValue: clientMatch ? clientMatch[1].trim() : null,
    triggerPattern: triggerMatch ? triggerMatch[1] : null,
  };
}

// ─── Error Boundary Class ─────────────────────────────────────────────────────

export class HydrationErrorBoundary extends Component<Props, State> {
  static displayName = 'HydrationErrorBoundary';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, log: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Only intercept hydration-related errors; re-throw others
    const isHydration =
      /hydration|did not match|Text content|server.*client|client.*server/i.test(
        error.message + (error.stack ?? '')
      );

    if (!isHydration) {
      // Let non-hydration errors bubble up to a higher boundary
      throw error;
    }

    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { name = 'Unknown', onError } = this.props;

    const divergence = extractDivergence(error.message);
    const detected = detectTrigger(error.message, error.stack ?? '');

    const log: HydrationErrorLog = {
      timestamp: new Date().toISOString(),
      boundaryName: name,
      errorMessage: error.message,
      componentStack: info.componentStack ?? '',
      divergence,
      triggerFunction: detected?.trigger ?? null,
      stackTrace: error.stack ?? '',
    };

    this.setState({ log });

    // ── Console output ──────────────────────────────────────────────────────
    const styles = {
      header: 'color:#e74c3c;font-weight:bold;font-size:14px',
      label: 'color:#e67e22;font-weight:bold',
      value: 'color:#2c3e50',
      hint: 'color:#27ae60;font-style:italic',
      dim: 'color:#7f8c8d',
    };

    /* eslint-disable no-console */
    console.group('%c🚨 HydrationErrorBoundary caught a mismatch', styles.header);
    console.log('%cBoundary     :%c %s', styles.label, styles.value, name);
    console.log('%cTimestamp    :%c %s', styles.label, styles.value, log.timestamp);
    console.log('%cError        :%c %s', styles.label, styles.value, error.message);

    if (detected) {
      console.log('%cTrigger      :%c %s', styles.label, styles.value, detected.trigger);
      console.log('%cHint         :%c %s', styles.label, styles.hint, detected.hint);
    }

    if (divergence.serverValue || divergence.clientValue) {
      console.group('%cValue Divergence', styles.label);
      console.log('%cServer value :%c %s', styles.label, styles.value, divergence.serverValue ?? '(not extracted)');
      console.log('%cClient value :%c %s', styles.label, styles.value, divergence.clientValue ?? '(not extracted)');
      if (divergence.triggerPattern) {
        console.log('%cPattern      :%c %s', styles.label, styles.value, divergence.triggerPattern);
      }
      console.groupEnd();
    }

    console.group('%cComponent Stack', styles.dim);
    console.log(info.componentStack);
    console.groupEnd();

    console.group('%cFull Stack Trace', styles.dim);
    console.log(error.stack);
    console.groupEnd();

    console.log('%cStructured Log (copy for bug report):', styles.label);
    console.log(JSON.stringify(log, null, 2));

    console.groupEnd();
    /* eslint-enable no-console */

    // ── Persist to sessionStorage for post-reload inspection ───────────────
    if (typeof sessionStorage !== 'undefined') {
      try {
        const existing = JSON.parse(sessionStorage.getItem('__hydration_errors__') ?? '[]') as HydrationErrorLog[];
        existing.push(log);
        // Keep last 20 entries
        sessionStorage.setItem('__hydration_errors__', JSON.stringify(existing.slice(-20)));
      } catch {
        // sessionStorage may be unavailable (private browsing, quota exceeded)
      }
    }

    // ── Custom callback ─────────────────────────────────────────────────────
    onError?.(log);
  }

  render() {
    const { hasError, log } = this.state;
    const { children, fallback, name = 'Component' } = this.props;

    if (!hasError) return children;

    // Production: render custom fallback or nothing
    if (process.env.NODE_ENV === 'production') {
      return fallback ?? null;
    }

    // Development: render diagnostic panel
    return (
      <div
        style={{
          border: '2px solid #e74c3c',
          borderRadius: 8,
          padding: 16,
          margin: 8,
          background: '#fff5f5',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
        data-hydration-boundary={name}
      >
        <div style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: 8, fontSize: 15 }}>
          🚨 Hydration Mismatch — <em>{name}</em>
        </div>

        {log && (
          <>
            <div style={{ marginBottom: 6 }}>
              <strong>Error:</strong>{' '}
              <span style={{ color: '#c0392b' }}>{log.errorMessage}</span>
            </div>

            {log.triggerFunction && (
              <div style={{ marginBottom: 6 }}>
                <strong>Trigger:</strong>{' '}
                <span style={{ color: '#e67e22' }}>{log.triggerFunction}</span>
              </div>
            )}

            {(log.divergence.serverValue || log.divergence.clientValue) && (
              <div
                style={{
                  background: '#ffeaa7',
                  borderRadius: 4,
                  padding: '6px 10px',
                  marginBottom: 8,
                }}
              >
                <strong>Value Divergence</strong>
                <div>
                  Server: <code>{log.divergence.serverValue ?? '—'}</code>
                </div>
                <div>
                  Client: <code>{log.divergence.clientValue ?? '—'}</code>
                </div>
                {log.divergence.triggerPattern && (
                  <div>
                    Pattern: <code>{log.divergence.triggerPattern}</code>
                  </div>
                )}
              </div>
            )}

            <details style={{ marginBottom: 6 }}>
              <summary style={{ cursor: 'pointer', color: '#7f8c8d' }}>
                Component Stack
              </summary>
              <pre
                style={{
                  fontSize: 11,
                  color: '#555',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflow: 'auto',
                  background: '#f8f8f8',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {log.componentStack}
              </pre>
            </details>

            <details>
              <summary style={{ cursor: 'pointer', color: '#7f8c8d' }}>
                Stack Trace
              </summary>
              <pre
                style={{
                  fontSize: 11,
                  color: '#555',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflow: 'auto',
                  background: '#f8f8f8',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {log.stackTrace}
              </pre>
            </details>

            <div style={{ marginTop: 10, color: '#7f8c8d', fontSize: 11 }}>
              Run <code>npx ts-node scripts/scan-hydration-triggers.ts</code> to find all
              static triggers. Check <code>sessionStorage.__hydration_errors__</code> for
              persisted logs.
            </div>
          </>
        )}
      </div>
    );
  }
}

// ─── Convenience hook to read persisted logs ──────────────────────────────────

/**
 * Returns all hydration error logs stored in sessionStorage.
 * Call this in a useEffect to inspect past errors after a reload.
 *
 * @example
 * useEffect(() => {
 *   const logs = getPersistedHydrationLogs();
 *   if (logs.length) console.table(logs);
 * }, []);
 */
export function getPersistedHydrationLogs(): HydrationErrorLog[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem('__hydration_errors__') ?? '[]') as HydrationErrorLog[];
  } catch {
    return [];
  }
}

/**
 * Clears all persisted hydration error logs from sessionStorage.
 */
export function clearPersistedHydrationLogs(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('__hydration_errors__');
  }
}

export default HydrationErrorBoundary;
