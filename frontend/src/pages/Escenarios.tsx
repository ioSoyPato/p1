import { useEffect, useMemo, useState } from "react";
import { api, type ScenarioMeta, type SimResult } from "../lib/api";
import { Panel, StatRow, Table, Badge, fmtPct, fmtNum, fmtP, sigStars } from "../components/ui";
import {
  PgrPlrBar, HistPair, DispositionOverTime, ValueIndexChart, TurnoverScatter, TurnoverOverTime,
} from "../components/charts";

interface CustomForm {
  deltaKind: "fixed" | "uniform"; deltaValue: number;
  kappaKind: "fixed" | "uniform"; kappaValue: number;
  n_agents: number; n_days: number; n_securities: number;
  rebalance_confound: boolean; reversal_confound: boolean;
  seed: number; price_seed: number;
}

const DEFAULT_CUSTOM: CustomForm = {
  deltaKind: "fixed", deltaValue: 0.5,
  kappaKind: "fixed", kappaValue: 0.5,
  n_agents: 1200, n_days: 504, n_securities: 60,
  rebalance_confound: false, reversal_confound: false,
  seed: 100, price_seed: 42,
};

export function Escenarios() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selected, setSelected] = useState<string>("s1_null");
  const [mode, setMode] = useState<"standard" | "custom">("standard");
  const [custom, setCustom] = useState<CustomForm>(DEFAULT_CUSTOM);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scenarios().then((r) => setScenarios(r.scenarios)).catch((e) => setError(String(e)));
  }, []);

  async function runStandard(key: string) {
    setLoading(true); setError(null);
    try {
      const r = await api.simulate({ scenario_key: key });
      setResult(r);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  async function runCustom() {
    setLoading(true); setError(null);
    try {
      const body = {
        custom: {
          key: "custom", name: "Escenario personalizado", description: "",
          delta: custom.deltaKind === "fixed"
            ? { kind: "fixed", value: custom.deltaValue }
            : { kind: "uniform", lo: 0, hi: 1 },
          kappa: custom.kappaKind === "fixed"
            ? { kind: "fixed", value: custom.kappaValue }
            : { kind: "uniform", lo: 0, hi: 1 },
          n_agents: custom.n_agents, seed: custom.seed, price_seed: custom.price_seed,
          price: { n_securities: custom.n_securities, n_days: custom.n_days },
          rebalance_confound: custom.rebalance_confound,
          reversal_confound: custom.reversal_confound,
          n_boot: 800,
        },
      };
      const r = await api.simulate(body);
      setResult(r);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  useEffect(() => { if (mode === "standard") runStandard(selected); /* eslint-disable-next-line */ }, [selected, mode]);

  const activeMeta = useMemo(() => scenarios.find((s) => s.key === selected), [scenarios, selected]);

  return (
    <div>
      <h1>Escenarios y resultados</h1>
      <p className="prose" style={{ color: "var(--ink-soft)" }}>
        Los 8 escenarios de la consigna comparten <strong>el mismo mercado simulado y la
        misma población de capitales/tamaños de cartera</strong> (números aleatorios
        comunes): lo único que cambia entre ellos es la configuración de comportamiento.
        Sin esto, comparar retornos promedio entre escenarios mezclaría el efecto del
        parámetro inyectado con la suerte particular de cada mercado simulado.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <ModeButton active={mode === "standard"} onClick={() => setMode("standard")}>8 escenarios estándar</ModeButton>
        <ModeButton active={mode === "custom"} onClick={() => setMode("custom")}>Constructor personalizado</ModeButton>
      </div>

      {mode === "standard" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.4rem" }}>
          {scenarios.map((s) => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              style={{
                border: "1px solid " + (selected === s.key ? "var(--accent-blue)" : "var(--rule)"),
                background: selected === s.key ? "var(--accent-blue-soft)" : "var(--paper-raised)",
                color: selected === s.key ? "var(--accent-blue)" : "var(--ink-soft)",
                borderRadius: "3px", padding: "0.4rem 0.7rem", fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {mode === "standard" && activeMeta && (
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginTop: "-0.8rem" }}>{activeMeta.description}</p>
      )}

      {mode === "custom" && (
        <Panel title="Construir un escenario propio">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.9rem" }}>
            <TraitField label="δ (disposición)" kind={custom.deltaKind} value={custom.deltaValue}
              onKind={(k) => setCustom({ ...custom, deltaKind: k })} onValue={(v) => setCustom({ ...custom, deltaValue: v })} />
            <TraitField label="κ (sobreconfianza)" kind={custom.kappaKind} value={custom.kappaValue}
              onKind={(k) => setCustom({ ...custom, kappaKind: k })} onValue={(v) => setCustom({ ...custom, kappaValue: v })} />
            <NumField label="n agentes" value={custom.n_agents} min={200} max={4000} step={100}
              onChange={(v) => setCustom({ ...custom, n_agents: v })} />
            <NumField label="n días" value={custom.n_days} min={100} max={1500} step={50}
              onChange={(v) => setCustom({ ...custom, n_days: v })} />
            <NumField label="n títulos" value={custom.n_securities} min={50} max={200} step={10}
              onChange={(v) => setCustom({ ...custom, n_securities: v })} />
            <NumField label="semilla (mercado)" value={custom.price_seed} min={1} max={99999} step={1}
              onChange={(v) => setCustom({ ...custom, price_seed: v })} />
            <NumField label="semilla (población)" value={custom.seed} min={1} max={99999} step={1}
              onChange={(v) => setCustom({ ...custom, seed: v })} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
              <input type="checkbox" checked={custom.rebalance_confound}
                onChange={(e) => setCustom({ ...custom, rebalance_confound: e.target.checked })} />
              confusor: rebalanceo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
              <input type="checkbox" checked={custom.reversal_confound}
                onChange={(e) => setCustom({ ...custom, reversal_confound: e.target.checked })} />
              confusor: creencia en reversión
            </label>
          </div>
          <button onClick={runCustom} disabled={loading} style={btnPrimary}>
            {loading ? "Simulando…" : "Correr escenario"}
          </button>
        </Panel>
      )}

      {error && <div style={{ color: "var(--critical)", fontSize: "0.85rem", margin: "1rem 0" }}>{error}</div>}
      {loading && mode === "standard" && <div style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Simulando…</div>}

      {result && <Results r={result} />}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      border: "1px solid " + (active ? "var(--ink)" : "var(--rule)"),
      background: active ? "var(--ink)" : "transparent",
      color: active ? "var(--paper)" : "var(--ink-soft)",
      borderRadius: "3px", padding: "0.4rem 0.8rem", fontSize: "0.82rem", cursor: "pointer",
    }}>{children}</button>
  );
}

const btnPrimary: React.CSSProperties = {
  marginTop: "0.9rem", background: "var(--accent-blue)", color: "white", border: "none",
  borderRadius: "3px", padding: "0.5rem 1.1rem", fontSize: "0.85rem", cursor: "pointer",
};

function TraitField({ label, kind, value, onKind, onValue }: {
  label: string; kind: "fixed" | "uniform"; value: number;
  onKind: (k: "fixed" | "uniform") => void; onValue: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.25rem" }}>{label}</div>
      <select value={kind} onChange={(e) => onKind(e.target.value as "fixed" | "uniform")} style={selectStyle}>
        <option value="fixed">fijo (homogéneo)</option>
        <option value="uniform">U(0,1) heterogéneo</option>
      </select>
      {kind === "fixed" && (
        <input type="range" min={0} max={1} step={0.05} value={value}
          onChange={(e) => onValue(parseFloat(e.target.value))}
          style={{ width: "100%", marginTop: "0.35rem" }} />
      )}
      {kind === "fixed" && <div className="mono" style={{ fontSize: "0.78rem" }}>{value.toFixed(2)}</div>}
    </div>
  );
}

function NumField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.25rem" }}>{label}</div>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={selectStyle} />
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "0.35rem 0.4rem", fontSize: "0.82rem",
  border: "1px solid var(--rule)", borderRadius: "3px", background: "var(--paper)", color: "var(--ink)",
};

function Results({ r }: { r: SimResult }) {
  const d = r.disposition;
  const oc = r.overconfidence;
  return (
    <div>
      <Panel title="Resumen de la población" sub={`${r.summary.n_agents.toLocaleString("es")} cuentas · ${r.summary.n_days} días · ${r.summary.n_securities} títulos · simulado en ${r.summary.sim_time_seconds.toFixed(2)}s`}>
        <StatRow items={[
          { label: "retorno neto medio", value: fmtPct(r.summary.mean_net_return), tone: r.summary.mean_net_return >= 0 ? "good" : "critical" },
          { label: "retorno bruto (mid) medio", value: fmtPct(r.summary.mean_gross_mid_return) },
          { label: "turnover anualizado medio", value: fmtNum(r.summary.mean_turnover, 2) + "x" },
          { label: "% tiempo en efectivo", value: fmtPct(r.summary.mean_cash_fraction, 1) },
          { label: "comisión media pagada", value: `$${r.summary.mean_commission_usd.toFixed(0)}` },
          { label: "operaciones medias / cuenta", value: r.summary.mean_n_trades.toFixed(1) },
        ]} />
      </Panel>

      <Panel title="Efecto disposición — PGR vs. PLR" sub="Barras con intervalo de ±1.96 errores estándar (bootstrap por cuenta, no por operación).">
        <PgrPlrBar pgr={d.PGR} plr={d.PLR} sePgr={d.se_pgr_cluster} sePlr={d.se_plr_cluster} />
        <StatRow items={[
          { label: "PGR − PLR", value: fmtPct(d.diff), hint: `SE cluster ${fmtPct(d.se_diff_cluster, 3)} · IC95 [${fmtPct(d.ci_diff_cluster[0],2)}, ${fmtPct(d.ci_diff_cluster[1],2)}]` },
          { label: "PGR / PLR", value: fmtNum(d.ratio, 2), hint: `IC95 [${fmtNum(d.ci_ratio_cluster[0],2)}, ${fmtNum(d.ci_ratio_cluster[1],2)}]` },
          { label: "conteos G_r,G_p,L_r,L_p", value: `${d.Gr.toFixed(0)}, ${d.Gp.toFixed(0)}, ${d.Lr.toFixed(0)}, ${d.Lp.toFixed(0)}` },
          { label: "cuentas con ≥1 venta", value: `${d.n_accounts_active} / ${d.n_accounts}` },
        ]} />
      </Panel>

      <Panel title="Bootstrap: por cuenta vs. por evento (el error incorrecto)" sub="Distribución de PGR−PLR remuestreando cuentas completas (correcto) contra remuestrear eventos individuales como si fueran independientes (incorrecto).">
        <HistPair a={d.boot_diff_cluster_hist} b={d.boot_diff_naive_hist} labelA="por cuenta (correcto)" labelB="por evento (subestima el SE)" />
        <StatRow items={[
          { label: "SE por cuenta", value: fmtNum(d.se_diff_cluster, 4) },
          { label: "SE por evento", value: fmtNum(d.se_diff_naive, 4) },
          { label: "razón", value: `${(d.se_diff_cluster / d.se_diff_naive).toFixed(2)}×` },
        ]} />
      </Panel>

      <Panel title="PGR y PLR acumulados a lo largo del tiempo">
        <DispositionOverTime day={r.time_series.day} pgr={r.time_series.pgr} plr={r.time_series.plr} />
      </Panel>

      <Panel title="Sobreconfianza: retorno ~ turnover" sub="Misma regresión corrida sobre tres definiciones de retorno.">
        <Table
          head={["", "β (turnover)", "SE", "p", "R²", "n"]}
          rows={(["net", "gross_fill", "gross_mid"] as const).map((k) => {
            const label = k === "net" ? "neto" : k === "gross_fill" ? "bruto (fill)" : "bruto (mid, sin fricción)";
            const reg = oc[k];
            return [label, fmtNum(reg.beta_turnover, 4) + sigStars(reg.p_beta_turnover), fmtNum(reg.se_beta_turnover, 4), fmtP(reg.p_beta_turnover), fmtNum(reg.r_squared, 3), String(reg.n_obs)];
          })}
        />
        <div style={{ fontSize: "0.74rem", color: "var(--ink-muted)", marginTop: "0.5rem" }}>*** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05. Errores robustos HC1.</div>
      </Panel>

      <Panel title="Turnover vs. retorno, por cuenta">
        <TurnoverScatter turnover={r.agents_sample.turnover} net={r.agents_sample.net_return} grossMid={r.agents_sample.gross_mid_return} />
      </Panel>

      <Panel title="Valor de cartera promedio vs. índice de mercado">
        <ValueIndexChart day={r.time_series.day} valueIndex={r.time_series.mean_value_index} marketIndex={r.time_series.market_index} />
      </Panel>

      <Panel title="Turnover anualizado acumulado en el tiempo">
        <TurnoverOverTime day={r.time_series.day} meanTurnover={r.time_series.mean_turnover} />
      </Panel>

      <Panel title="Diagnóstico rápido de mecanismos" sub="Ver la página de Confusores para la explicación completa.">
        <StatRow items={[
          { label: "corr(turnover, % en efectivo)", value: fmtNum(r.diagnosis.cash_drag_corr, 3) },
          { label: "cuña de spread (fill − mid)", value: fmtPct(r.diagnosis.spread_wedge_mean, 3) },
          { label: "β compounding (mid | controles)", value: fmtNum(r.diagnosis.compounding_beta_gross_mid, 4), hint: `p=${fmtP(r.diagnosis.compounding_beta_p)}` },
          { label: "β causalidad inversa (turnover~retorno)", value: fmtNum(r.diagnosis.reverse_causality_beta, 3), hint: `p=${fmtP(r.diagnosis.reverse_causality_p)}`, tone: r.diagnosis.reverse_causality_beta > 0 ? "critical" : "neutral" },
        ]} />
      </Panel>

      {(r.scenario.rebalance_confound || r.scenario.reversal_confound) && (
        <div style={{ marginTop: "0.8rem" }}>
          <Badge tone="critical">confusor activo: {r.scenario.rebalance_confound ? "rebalanceo" : "creencia en reversión"}</Badge>
        </div>
      )}
    </div>
  );
}
