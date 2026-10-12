const TOKEN_KEY = 'diamond_auth_token';
const USER_KEY = 'diamond_user';

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasSession() {
  return Boolean(getToken());
}

function readDetail(data, status) {
  if (!data) return `Request failed (${status}).`;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item?.msg || JSON.stringify(item)).join(' ');
  }
  if (data.error) return data.error;
  return `Request failed (${status}).`;
}

export async function api(path, options = {}) {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const finalHeaders = { ...headers };
  const token = getToken();
  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

  const init = { method, headers: finalHeaders };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(path, init);

  if (res.status === 401 && auth) {
    clearSession();
    if (unauthorizedHandler) unauthorizedHandler();
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    throw err;
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    const err = new Error(readDetail(data, res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
