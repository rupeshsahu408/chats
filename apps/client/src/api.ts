import { HealthResponseSchema, type HealthResponse } from "@veil/shared";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const json = await res.json();
  return HealthResponseSchema.parse(json);
}
