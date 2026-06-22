import type { AnalyticsData, Explanation, ExplanationMarker, GazePoint, HeatmapPoint, ReadingLevel, Report } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Must match the backend CSRF_COOKIE constant in app/dependencies.py.
const CSRF_COOKIE = 'medexplain_csrf';

let csrfToken: string | null = null;

/** Read a named cookie from document.cookie. Returns null if absent. */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

/** Best-effort write of a cookie. Used to mirror the in-memory token so that
 *  subsequent same-page POSTs and future page loads can read it back. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

export function setCsrfToken(token: string) {
  csrfToken = token || null;
  if (csrfToken) {
    // Mirror to cookie so a page refresh can recover it without a network
    // round-trip. The backend also sets this cookie via Set-Cookie on
    // login/register/refresh — this is just a safety net.
    writeCookie(CSRF_COOKIE, csrfToken, 60 * 60);
  }
}

export function getCsrfToken(): string | null {
  if (csrfToken) return csrfToken;
  // Fall back to the cookie so code that runs before AuthProvider has had a
  // chance to call ensureCsrfToken() still gets a usable token.
  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) {
    csrfToken = fromCookie;
    return csrfToken;
  }
  return null;
}

/** True when an ensureCsrfToken() call is already in flight. */
let ensurePromise: Promise<string | null> | null = null;

/**
 * Make sure the in-memory CSRF token is populated before a state-changing
 * request. Resolution order:
 *   1. in-memory token (set by a previous login/register/refresh)
 *   2. readable CSRF cookie (set by the backend on login/register/refresh)
 *   3. POST /auth/csrf/refresh — mints a brand-new token for the current
 *      session, persists its hash, and sets a fresh cookie.
 *
 * Returns the token (or null if the user is unauthenticated, which is fine —
 * the request will then 401/403 and the caller can handle it).
 */
export async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;

  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) {
    csrfToken = fromCookie;
    return csrfToken;
  }

  // No token anywhere — ask the backend to mint a new one for the current
  // session. Dedupe concurrent calls so we don't fire N refreshes for N
  // parallel POSTs on page load.
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/csrf/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { csrf_token?: string };
        if (!data.csrf_token) return null;
        csrfToken = data.csrf_token;
        // The backend will have set the cookie via Set-Cookie, but mirror it
        // locally too in case the response is from a same-origin fetch where
        // document.cookie is already up to date.
        writeCookie(CSRF_COOKIE, csrfToken, 60 * 60);
        return csrfToken;
      } catch {
        return null;
      } finally {
        ensurePromise = null;
      }
    })();
  }
  return ensurePromise;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const isStateChanging =
    !!options.method && options.method !== 'GET' && options.method !== 'HEAD';
  if (isStateChanging) {
    // Make sure we have a token before sending. On a fresh page load this
    // will read the cookie (cheap) or hit /auth/csrf/refresh (one round-trip,
    // deduped across concurrent requests).
    const token = await ensureCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    let detail = 'Request failed';
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: { id: string; email: string }; csrf_token: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string }; csrf_token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ id: string; email: string }>('/auth/me'),

  /** Force-refresh the CSRF token for the current session. Exposed for the
   *  AuthProvider's page-load bootstrap and for manual recovery flows. */
  refreshCsrf: () =>
    request<{ csrf_token: string }>('/auth/csrf/refresh', { method: 'POST' }),

  uploadReport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Report>('/reports/upload', {
      method: 'POST',
      body: form,
    });
  },

  listReports: () => request<Report[]>('/reports'),

  getReport: (id: string) =>
    request<Report>(`/reports/${id}`),

  getReportContentUrl: (id: string) => `${API_BASE}/reports/${id}/content`,

  deleteReport: (id: string) =>
    request<{ message: string }>(`/reports/${id}`, { method: 'DELETE' }),

  explain: (
    reportId: string,
    data: {
      region_text: string;
      reading_level: ReadingLevel;
      page_number: number;
      region_bounds?: { x: number; y: number; width: number; height: number };
    },
  ) =>
    request<Explanation>(
      `/explanations/${reportId}/explain`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  listExplanations: (reportId: string) =>
    request<Explanation[]>(`/explanations/${reportId}`),

  recordGaze: (reportId: string, points: GazePoint[]) =>
    request<{ message: string }>(`/reports/${reportId}/gaze`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),

    getHeatmap: (reportId: string, page: number) =>
      request<{
        page_number: number;
        points: HeatmapPoint[];
        explanation_points: ExplanationMarker[];
      }>(`/reports/${reportId}/heatmap/${page}`),
  
    getAnalytics: (reportId: string) =>
      request<AnalyticsData>(`/reports/${reportId}/analytics`),

  clearAllData: () =>
    request<{ message: string }>('/explanations/user/data', {
      method: 'DELETE',
    }),
};

export { ApiError };
