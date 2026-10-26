import type { components } from "./schema";

type S = components["schemas"];
export type Stats = S["Stats"];
export type Meta = S["MetaOut"];
export type Transaction = S["TransactionOut"];
export type TxnPage = S["Page_TransactionOut_"];
export type DecisionSummary = S["DecisionSummary"];
export type DecisionDetail = S["DecisionDetail"];
export type RetrievedChunk = S["RetrievedChunkOut"];
export type RuleHit = S["RuleHitOut"];
export type Obligation = S["Obligation"];
export type Review = S["ReviewOut"];
export type Reviewer = S["ReviewerOut"];
export type ReviewIn = S["ReviewIn"];
export type Run = S["RunOut"];
export type UploadResult = S["UploadResult"];
export type SearchHit = S["SearchHit"];
export type ReportType = S["ReportTypeOut"];
export type DeadlineItem = S["DeadlineItem"];

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  stats: () => request<Stats>("/stats"),
  meta: () => request<Meta>("/meta"),
  search: (q: string) => request<SearchHit[]>(`/search${qs({ q })}`),
  transactions: (params: Record<string, string | number | boolean | undefined>) =>
    request<TxnPage>(`/transactions${qs(params)}`),
  decisions: (params: Record<string, string | number | boolean | undefined> = {}) =>
    request<DecisionSummary[]>(`/decisions${qs(params)}`),
  decision: (id: number) => request<DecisionDetail>(`/decisions/${id}`),
  reanalyze: (txnId: string) => request<DecisionDetail>(`/transactions/${txnId}/analyze`, { method: "POST" }),
  queue: (includeClosed = true) => request<DecisionSummary[]>(`/review/queue${qs({ include_closed: includeClosed })}`),
  reviewers: () => request<Reviewer[]>("/review/reviewers"),
  review: (id: number, body: ReviewIn) =>
    request<DecisionDetail>(`/review/${id}/actions`, { method: "POST", body: JSON.stringify(body) }),
  runs: () => request<Run[]>("/analysis/runs"),
  startRun: (pace_ms?: number) =>
    request<Run>("/analysis/runs", { method: "POST", body: JSON.stringify({ pace_ms: pace_ms ?? null }) }),
  uploadCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<UploadResult>("/analysis/upload", { method: "POST", body: fd });
  },
  reports: () => request<ReportType[]>("/reports"),
  reportUrl: (type: string, fmt: "csv" | "md") => `${BASE}/api/reports/${type}.${fmt}`,
  sseUrl: (path: string) => `${BASE}/api${path}`,
};
