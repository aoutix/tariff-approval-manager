const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, userId } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers["X-User-Id"] = String(userId);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore parse error */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listUsers: () => request("/api/users"),
  whoAmI: (userId) => request("/api/me", { userId }),

  listContracts: (userId) => request("/api/contracts", { userId }),
  createContract: (userId, payload) =>
    request("/api/contracts", { method: "POST", body: payload, userId }),
  updateContract: (userId, id, payload) =>
    request(`/api/contracts/${id}`, { method: "PUT", body: payload, userId }),

  listTariffs: (userId) => request("/api/tariffs", { userId }),
  createTariff: (userId, payload) =>
    request("/api/tariffs", { method: "POST", body: payload, userId }),
  updateTariff: (userId, id, payload) =>
    request(`/api/tariffs/${id}`, { method: "PUT", body: payload, userId }),
  submitTariff: (userId, id) =>
    request(`/api/tariffs/${id}/submit`, { method: "POST", userId }),
  approveTariff: (userId, id) =>
    request(`/api/tariffs/${id}/approve`, { method: "POST", userId }),
  rejectTariff: (userId, id, reason) =>
    request(`/api/tariffs/${id}/reject`, { method: "POST", body: { reason }, userId }),
  auditLog: (userId, id) => request(`/api/tariffs/${id}/audit-log`, { userId }),

  dashboard: (userId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.currency) params.set("currency", filters.currency);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    const qs = params.toString();
    return request(`/api/dashboard${qs ? `?${qs}` : ""}`, { userId });
  },
};

export { ApiError };
