const isLocalBrowser =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (isLocalBrowser ? 'http://localhost:3000' : '');

export const absoluteApiUrl = (path: string) => {
  const base = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return new URL(path, base).toString();
};

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

const readStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem('devpilot.user') || 'null');
    return user && typeof user.email === 'string' ? user : null;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const user = readStoredUser();
  if (user?.name) {
    headers.set('x-user', String(user.name));
  }
  if (user?.email) {
    headers.set('x-user-email', String(user.email).trim().toLowerCase());
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
