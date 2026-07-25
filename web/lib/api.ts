import { Component, Dependency, IncidentReport } from "./types";
import demoTopologyRaw from "./demo/topology.json";
import demoIncidentRaw from "./demo/incident.json";
import demoAuditRaw from "./demo/audit.json";
import demoStatsRaw from "./demo/stats.json";
import demoKnowledgeRaw from "./demo/knowledge.json";

// In production, set NEXT_PUBLIC_API_URL to the deployed backend origin.
// Locally it falls back to "/api", which next.config.ts proxies to FastAPI.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// When true, the app runs entirely on the bundled reference-incident data —
// no backend required. It is also used as a graceful fallback whenever a live
// backend call fails, so a hosted deployment never shows a broken screen.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const REFERENCE_INCIDENT_ID = "INC-1001";

export interface AuditVerification {
  is_valid: boolean;
  total_events: number;
  failed_at_index: number | null;
  failure_reason: string | null;
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface KnowledgeResult {
  runbooks: KnowledgeMatch[];
  similar_incidents: KnowledgeMatch[];
}

export interface UsageStats {
  incidents_analyzed: number;
  nodes_analyzed: number;
  audit_events: number;
}

export interface HealthyResult {
  status: "healthy";
  components_analyzed: number;
  telemetry_windows: number;
  metrics_evaluated: string[];
  message: string;
}

const demoTopology = demoTopologyRaw as unknown as { components: Component[]; dependencies: Dependency[] };
const demoIncident = demoIncidentRaw as unknown as IncidentReport;
const demoAudit = demoAuditRaw as unknown as AuditVerification;
const demoStats = demoStatsRaw as unknown as UsageStats;
const demoKnowledge = demoKnowledgeRaw as unknown as KnowledgeResult;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Try the live backend; on demo mode or any failure, serve bundled data.
async function resolve<T>(demo: T, live: () => Promise<T>): Promise<T> {
  if (DEMO_MODE) return clone(demo);
  try {
    return await live();
  } catch (error) {
    if (typeof window !== "undefined") {
      console.warn("Backend unavailable; serving bundled reference data.", error);
    }
    return clone(demo);
  }
}

function formatIncidentTimestamps(data: IncidentReport): IncidentReport {
  if (data.timeline) {
    data.timeline = data.timeline.map((event) => {
      const parts = event.ts.split("T");
      return { ...event, ts: parts.length > 1 ? parts[1].slice(0, 8) : event.ts };
    });
  }
  return data;
}

export async function getTopology(): Promise<{ components: Component[]; dependencies: Dependency[] }> {
  return resolve(demoTopology, async () => {
    const response = await fetch(`${API_BASE_URL}/topology`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch topology: ${response.statusText}`);
    const data = await response.json();
    return { components: data.components, dependencies: data.dependencies };
  });
}

export async function getIncident(incidentId: string): Promise<IncidentReport> {
  const data = await resolve(demoIncident, async () => {
    const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch incident ${incidentId}: ${response.statusText}`);
    return (await response.json()) as IncidentReport;
  });
  return formatIncidentTimestamps(clone(data));
}

export async function getAuditVerification(): Promise<AuditVerification> {
  return resolve(demoAudit, async () => {
    const response = await fetch(`${API_BASE_URL}/audit/verify`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch audit verification: ${response.statusText}`);
    return await response.json();
  });
}

export async function retrieveKnowledge(query: string, k = 3): Promise<KnowledgeResult> {
  return resolve(demoKnowledge, async () => {
    const response = await fetch(`${API_BASE_URL}/knowledge/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Failed to retrieve knowledge: ${response.statusText}`);
    return await response.json();
  });
}

export async function getUsageStats(): Promise<UsageStats> {
  return resolve(demoStats, async () => {
    const response = await fetch(`${API_BASE_URL}/stats`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch usage stats: ${response.statusText}`);
    return await response.json();
  });
}

export async function analyzeIncident(
  payload: unknown,
  fast: boolean = false,
): Promise<IncidentReport | HealthyResult> {
  if (DEMO_MODE) return formatIncidentTimestamps(clone(demoIncident));
  const url = `${API_BASE_URL}/analyze${fast ? "?fast=true" : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.detail || `Analysis failed: ${response.statusText}`);
  }
  return await response.json();
}
