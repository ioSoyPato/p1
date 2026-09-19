export const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

export interface TraitSpec {
  kind: "fixed" | "uniform" | "beta";
  value: number; lo: number; hi: number; mean: number; concentration: number;
}

export interface ScenarioMeta {
  key: string; name: string; description: string;
  delta: TraitSpec; kappa: TraitSpec;
  rebalance_confound: boolean; reversal_confound: boolean;
  n_agents: number;
}

export interface RegressionResult {
  dep_var: string; n_obs: number;
  params: Record<string, number>; se: Record<string, number>; pvalues: Record<string, number>;
  conf_int: Record<string, [number, number]>;
  r_squared: number; beta_turnover: number; se_beta_turnover: number; p_beta_turnover: number;
}

export interface Histogram { counts: number[]; edges: number[]; }

export interface DispositionResult {
  Gr: number; Gp: number; Lr: number; Lp: number;
  PGR: number; PLR: number; diff: number; ratio: number;
  n_accounts: number; n_accounts_active: number;
  se_diff_cluster: number; ci_diff_cluster: [number, number];
  se_ratio_cluster: number; ci_ratio_cluster: [number, number];
  se_pgr_cluster: number; se_plr_cluster: number;
  se_diff_naive: number; ci_diff_naive: [number, number]; se_ratio_naive: number;
  boot_diff_cluster_hist: Histogram; boot_diff_naive_hist: Histogram;
}

export interface DiagnosisResult {
  cash_drag_corr: number; mean_cash_fraction: number;
  spread_wedge_mean: number; spread_wedge_per_trade: number; spread_wedge_per_trade_p: number;
  compounding_beta_gross_mid: number; compounding_beta_p: number;
  reverse_causality_beta: number; reverse_causality_p: number;
}

export interface SimSummary {
  n_agents: number; n_days: number; n_securities: number;
  mean_net_return: number; mean_gross_fill_return: number; mean_gross_mid_return: number;
  mean_turnover: number; mean_cash_fraction: number; mean_commission_usd: number;
  mean_n_trades: number; sim_time_seconds: number;
}

export interface AgentsSample {
  delta: number[]; kappa: number[]; capital: number[]; n_positions: number[];
  turnover: number[]; net_return: number[]; gross_fill_return: number[];
  gross_mid_return: number[]; risk_exposure: number[];
}

export interface TimeSeries {
  day: number[]; mean_value_index: number[]; pgr: (number | null)[]; plr: (number | null)[];
  mean_turnover: (number | null)[]; market_index: number[];
}

export interface SimResult {
  scenario: ScenarioMeta;
  summary: SimSummary;
  disposition: DispositionResult;
  overconfidence: { net: RegressionResult; gross_fill: RegressionResult; gross_mid: RegressionResult };
  diagnosis: DiagnosisResult;
  agents_sample: AgentsSample;
  time_series: TimeSeries;
}

export interface PlaceboResult {
  correlation: number; n_events: number; mean_diff: number; mean_diff_se: number;
  mean_diff_p: number; horizon_days: number;
}

export interface IndependenceResult {
  corr_delta_kappa: number; corr_delta_turnover: number; corr_kappa_turnover: number; n_agents: number;
}

export interface MonotonicityRow {
  axis: "delta" | "kappa"; value: number; seed: number;
  PGR?: number; PLR?: number; diff?: number;
  beta_net?: number; beta_gross_mid?: number;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  scenarios: () => jsonFetch<{ scenarios: ScenarioMeta[] }>("/api/scenarios"),
  simulate: (body: Record<string, unknown>) =>
    jsonFetch<SimResult>("/api/simulate", { method: "POST", body: JSON.stringify(body) }),
  placebo: () => jsonFetch<PlaceboResult>("/api/validation/placebo"),
  independence: () => jsonFetch<IndependenceResult>("/api/validation/independence"),
  monotonicity: () => jsonFetch<{ rows: MonotonicityRow[] }>("/api/validation/monotonicity"),
};
