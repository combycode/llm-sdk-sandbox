/**
 * analytics.ts — privacy-first GA4 wrapper.
 *
 * Hard rules:
 *  - We ONLY ever send the whitelisted events below, with a fixed, safe param
 *    shape ({ provider, model, result, error_type }). No free-form payloads.
 *  - We NEVER send: API key, bearer token, prompt, response, full error text,
 *    headers, email, user id, IP. Errors are bucketed to a coarse category.
 *  - Consent Mode denies ad storage; Google Signals + ad personalization off.
 *  - If no measurement id is configured, every call is a no-op.
 *
 * The measurement id comes from the build env var `VITE_GA_ID` (e.g. G-XXXX).
 */

const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() || '';

// Whitelisted event names — anything else is dropped.
export type GaEvent =
  | 'page_view'
  | 'provider_selected'
  | 'model_selected'
  | 'run_started'
  | 'run_succeeded'
  | 'run_failed'
  | 'copy_code'
  | 'github_clicked';

export type ErrorBucket =
  | 'auth_error'
  | 'rate_limit'
  | 'network_error'
  | 'provider_error'
  | 'unsupported_model'
  | 'timeout'
  | 'unknown';

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

function w(): GtagWindow {
  return window as GtagWindow;
}

let started = false;

/** Load gtag.js (external — CSP `script-src` must allow googletagmanager) and
 *  configure GA4 with privacy defaults. Safe to call once at startup. */
export function initAnalytics(): void {
  if (started || !GA_ID || typeof document === 'undefined') return;
  started = true;

  const win = w();
  win.dataLayer = win.dataLayer || [];
  // Defined as a closure rather than an inline page script, so no inline-script
  // CSP exception is needed.
  const gtag = (...args: unknown[]) => {
    win.dataLayer?.push(args);
  };
  win.gtag = gtag;

  // Consent Mode: deny everything ad-related; analytics storage on for usage.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  gtag('js', new Date());
  gtag('config', GA_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

/** Whether GA is configured + available. */
export function analyticsReady(): boolean {
  return !!GA_ID && typeof w().gtag === 'function';
}

/** Allow-listed param keys only — strips anything sensitive by construction. */
interface SafeParams {
  provider?: string;
  model?: string;
  result?: 'success' | 'failure';
  error_type?: ErrorBucket;
}

function send(event: GaEvent, params: SafeParams = {}): void {
  if (!analyticsReady()) return;
  const clean: SafeParams = {};
  if (params.provider) clean.provider = params.provider;
  if (params.model) clean.model = params.model;
  if (params.result) clean.result = params.result;
  if (params.error_type) clean.error_type = params.error_type;
  w().gtag?.('event', event, clean);
}

// ── Public, intent-named trackers (each maps to one safe event) ───────────────

export const trackModelSelected = (provider: string, model: string) =>
  send('model_selected', { provider, model });

export const trackProviderSelected = (provider: string) => send('provider_selected', { provider });

export const trackRunStarted = (provider: string, model: string) =>
  send('run_started', { provider, model });

export const trackRunSucceeded = (provider: string, model: string) =>
  send('run_succeeded', { provider, model, result: 'success' });

export const trackRunFailed = (provider: string, model: string, error: ErrorBucket) =>
  send('run_failed', { provider, model, result: 'failure', error_type: error });

export const trackGithubClicked = () => send('github_clicked');
export const trackCopyCode = () => send('copy_code');

/** Map any thrown error to a coarse, non-sensitive bucket. Never inspect/keep
 *  the raw message beyond this classification. */
export function bucketError(err: unknown): ErrorBucket {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (/401|403|unauthor|invalid.*key|api key|forbidden/.test(msg)) return 'auth_error';
  if (/429|rate.?limit|quota|too many/.test(msg)) return 'rate_limit';
  if (/timeout|timed out|deadline/.test(msg)) return 'timeout';
  if (/unsupported|not supported|no model|unknown model/.test(msg)) return 'unsupported_model';
  if (/network|fetch|connection|cors|failed to fetch|dns/.test(msg)) return 'network_error';
  if (/4\d\d|5\d\d|provider|api error|bad request/.test(msg)) return 'provider_error';
  return 'unknown';
}
