import { Eq, EqInline } from "./Eq";
import { Panel } from "./ui";
import type { SimResult } from "../lib/api";

function fmt(x: number, d = 4): string {
  return x.toFixed(d);
}

/** Same three-line hazard formula as engine.py, evaluated in JS for display. */
function hazard(delta: number, kappa: number, x: number, sc: SimResult["scenario"]) {
  const churn = 1 + sc.k_scale * kappa;
  const sesgo = 1 + sc.d_scale * delta * Math.tanh(x / sc.x_ref);
  const raw = sc.lam0 * churn * sesgo;
  const h = Math.min(Math.max(raw, 0), sc.h_max);
  return { churn, sesgo, raw, h };
}

export function WorkedExample({ r }: { r: SimResult }) {
  const s = r.agents_sample;
  const n = s.delta.length;
  if (n === 0) return null;

  const idx = Math.floor(n / 2); // una cuenta cualquiera de esta corrida, ni la más ni la menos sesgada
  const delta = s.delta[idx], kappa = s.kappa[idx];
  const X = 0.08; // retorno no realizado ilustrativo: +8% y -8%, para tener dos casos redondos y comparables

  const gain = hazard(delta, kappa, X, r.scenario);
  const loss = hazard(delta, kappa, -X, r.scenario);
  const ratio = loss.h > 0 ? gain.h / loss.h : NaN;

  const d = r.disposition;
  const pgrCalc = d.Gr / (d.Gr + d.Gp);
  const plrCalc = d.Lr / (d.Lr + d.Lp);

  const reg = r.overconfidence.net;
  const p = reg.params;
  const t = s.turnover[idx], lg = s.portfolio_size[idx], np = s.n_positions[idx], rx = s.risk_exposure[idx];
  const yhat =
    (p.const ?? 0) + (p.turnover ?? 0) * t + (p.log_aum ?? 0) * lg + (p.n_positions ?? 0) * np + (p.risk_exposure ?? 0) * rx;
  const actual = s.net_return[idx];

  return (
    <Panel
      title="Ejemplo numérico, paso a paso"
      sub={`Con números reales de esta corrida — no símbolos. Cuenta de ejemplo #${idx} de esta población: δ=${fmt(delta, 2)}, κ=${fmt(kappa, 2)}.`}
    >
      <h4 style={{ marginTop: 0 }}>Caso 1 — esta cuenta tiene una ganancia de papel de +8%</h4>
      <div className="prose" style={{ fontSize: "0.92rem" }}>
        <p style={{ marginBottom: "0.4rem" }}>
          Su tasa de riesgo de venta hoy para esa posición, con los parámetros de{" "}
          <strong>este</strong> escenario (λ₀={r.scenario.lam0}, escala de churn={r.scenario.k_scale}, escala de sesgo={r.scenario.d_scale}, x_ref={r.scenario.x_ref}):
        </p>
        <Eq>{`\\text{churn} = 1 + ${r.scenario.k_scale}\\times ${fmt(kappa, 2)} = ${fmt(gain.churn, 3)}`}</Eq>
        <Eq>{`\\text{sesgo} = 1 + ${r.scenario.d_scale}\\times ${fmt(delta, 2)} \\times \\tanh(0.08/${r.scenario.x_ref}) = ${fmt(gain.sesgo, 3)}`}</Eq>
        <Eq>{`h = \\text{clip}(${r.scenario.lam0}\\times ${fmt(gain.churn, 3)} \\times ${fmt(gain.sesgo, 3)},\\,0,\\,${r.scenario.h_max}) = ${fmt(gain.h, 4)}`}</Eq>
        <p>
          → <strong>{(gain.h * 100).toFixed(2)}%</strong> de probabilidad de que esta cuenta cierre{" "}
          <em>esta posición puntual, hoy</em>.
        </p>
      </div>

      <h4>Caso 2 — la misma cuenta, la misma fórmula, pero con una pérdida de papel de −8%</h4>
      <div className="prose" style={{ fontSize: "0.92rem" }}>
        <p style={{ marginBottom: "0.4rem" }}>Sólo cambia el signo de x — el churn es el mismo número que en el Caso 1:</p>
        <Eq>{`\\text{sesgo} = 1 + ${r.scenario.d_scale}\\times ${fmt(delta, 2)} \\times \\tanh(-0.08/${r.scenario.x_ref}) = ${fmt(loss.sesgo, 3)}`}</Eq>
        <Eq>{`h = \\text{clip}(${r.scenario.lam0}\\times ${fmt(loss.churn, 3)} \\times ${fmt(loss.sesgo, 3)},\\,0,\\,${r.scenario.h_max}) = ${fmt(loss.h, 4)}`}</Eq>
        <p>
          → <strong>{(loss.h * 100).toFixed(2)}%</strong> de probabilidad de cierre hoy —{" "}
          {Number.isFinite(ratio) ? (
            <>esta cuenta vende ganadores <strong>{ratio.toFixed(2)}×</strong> más rápido que perdedores en este momento.</>
          ) : (
            <>estrictamente menor que en el Caso 1.</>
          )}{" "}
          Sumado día tras día, sobre miles de posiciones y {r.summary.n_agents.toLocaleString("es")} cuentas, es
          exactamente esta asimetría la que después se lee como <span className="mono">PGR &gt; PLR</span> — nunca se
          escribió "si es ganancia, vender".
        </p>
      </div>

      <h4>Caso 3 — de las decisiones diarias al número PGR/PLR</h4>
      <div className="prose" style={{ fontSize: "0.92rem" }}>
        <p style={{ marginBottom: "0.4rem" }}>
          Sumando esas decisiones sobre toda la corrida, los cuatro conteos agregados de esta simulación son los que
          ya se mostraron arriba; PGR y PLR son sólo una división:
        </p>
        <Eq>{`\\widehat{PGR} = \\frac{G_r}{G_r+G_p} = \\frac{${d.Gr.toFixed(0)}}{${d.Gr.toFixed(0)}+${d.Gp.toFixed(0)}} = ${fmt(pgrCalc, 4)}`}</Eq>
        <Eq>{`\\widehat{PLR} = \\frac{L_r}{L_r+L_p} = \\frac{${d.Lr.toFixed(0)}}{${d.Lr.toFixed(0)}+${d.Lp.toFixed(0)}} = ${fmt(plrCalc, 4)}`}</Eq>
      </div>

      <h4>Caso 4 — la predicción de la regresión de sobreconfianza, para esa misma cuenta</h4>
      <div className="prose" style={{ fontSize: "0.92rem" }}>
        <p style={{ marginBottom: "0.4rem" }}>
          Tomando los coeficientes ya estimados (β y γ de la tabla de arriba, retorno neto) y los regresores reales de
          la cuenta #{idx} (turnover={fmt(t, 2)}, log(AUM)={fmt(lg, 2)}, n<sub>i</sub>={np}, exposición={fmt(rx, 2)}):
        </p>
        <Eq>{`\\hat{r}_i = ${fmt(p.const ?? 0, 3)} + (${fmt(p.turnover ?? 0, 4)})(${fmt(t, 2)}) + (${fmt(p.log_aum ?? 0, 4)})(${fmt(lg, 2)}) + (${fmt(p.n_positions ?? 0, 5)})(${np}) + (${fmt(p.risk_exposure ?? 0, 4)})(${fmt(rx, 2)}) = ${fmt(yhat, 4)}`}</Eq>
        <p>
          El retorno neto que <strong>de verdad</strong> tuvo esa cuenta en esta corrida fue{" "}
          <span className="mono">{(actual * 100).toFixed(2)}%</span>, contra una predicción de{" "}
          <span className="mono">{(yhat * 100).toFixed(2)}%</span> — la diferencia es el residuo{" "}
          <EqInline>{"\\epsilon_i"}</EqInline> de esa cuenta particular, todo lo que el modelo no explica.
        </p>
      </div>
    </Panel>
  );
}
