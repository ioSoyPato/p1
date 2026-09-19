import { useEffect, useState } from "react";
import { api, type SimResult } from "../lib/api";
import { Panel, Table, fmtPct, fmtNum, fmtP } from "../components/ui";
import { EqInline } from "../components/Eq";

const KEYS = ["s1_null", "s2_disp_low", "s3_disp_high", "s5_turn_high", "s7_rebalance", "s8_reversal", "s9_heterogeneous"];

export function Confusores() {
  const [data, setData] = useState<Record<string, SimResult>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(KEYS.map((k) => api.simulate({ scenario_key: k }).then((r) => [k, r] as const)))
      .then((pairs) => setData(Object.fromEntries(pairs)))
      .catch((e) => setError(String(e)));
  }, []);

  const s1 = data["s1_null"], s2 = data["s2_disp_low"], s3 = data["s3_disp_high"];
  const s5 = data["s5_turn_high"], s7 = data["s7_rebalance"], s8 = data["s8_reversal"], s9 = data["s9_heterogeneous"];

  return (
    <div>
      <h1>Diagnóstico de confusores</h1>
      <div className="prose">
        <p>
          Encontrar <EqInline>{"\\beta_{\\text{bruto}} < 0"}</EqInline> o encontrar que{" "}
          <span className="mono">PGR &gt; PLR</span> en un escenario que se supone
          "limpio" no es automáticamente un error. Hay cuatro mecanismos legítimos
          que pueden producir exactamente ese patrón sin que exista ningún sesgo
          conductual verdadero. Sólo el primero es un bug — y si apareciera, se
          corrige y no se reporta como hallazgo. Los otros tres son fenómenos reales
          de este simulador (y, en mayor o menor medida, de cualquier mercado real) y
          se documentan aquí con sus números exactos.
        </p>
      </div>

      {error && <div style={{ color: "var(--critical)" }}>{error}</div>}
      {!error && !s1 && <div style={{ color: "var(--ink-muted)" }}>Corriendo 7 simulaciones para este diagnóstico…</div>}

      <h2 style={{ marginTop: "2rem" }}>0. Trading informado por fuga de información — el único que sería un bug</h2>
      <div className="prose">
        <p>
          Se verifica en la página de <strong>Validación</strong> con una prueba directa:
          la correlación entre qué título se compra y su retorno futuro debe ser
          indistinguible de cero. En este proyecto sale ≈0 en todas las corridas
          porque la reinversión siempre elige el título con un número aleatorio
          uniforme (ver <span className="mono">engine.py: do_buys</span>). No se
          reporta como hallazgo porque no lo es: es una verificación de que el
          simulador está bien construido.
        </p>
      </div>

      <h2 style={{ marginTop: "2rem" }}>1. Cash drag (arrastre de efectivo)</h2>
      <div className="prose">
        <p>
          Vender deja a la cuenta en efectivo durante 2 días antes de reinvertir. Si
          el mercado tiene tendencia positiva, una cuenta que rota más pasa
          proporcionalmente más tiempo fuera de esa tendencia — sin que haga falta
          ningún sesgo. Esto se mide con la correlación entre turnover y fracción de
          tiempo en efectivo:
        </p>
      </div>
      {s9 && (
        <Panel title="corr(turnover, % tiempo en efectivo) — población heterogénea">
          <div className="mono" style={{ fontSize: "1.3rem" }}>{fmtNum(s9.diagnosis.cash_drag_corr, 3)}</div>
        </Panel>
      )}

      <h2 style={{ marginTop: "2rem" }}>2. El spread dentro del propio precio de ejecución</h2>
      <div className="prose">
        <p>
          "Bruto de comisión" no es lo mismo que "sin fricción": si las operaciones
          se llenan al bid/ask, la mitad del spread ya está adentro del precio de
          ejecución aunque se le sume la comisión de vuelta. La cuña entre{" "}
          <span className="mono">bruto (fill)</span> y{" "}
          <span className="mono">bruto (mid)</span> mide exactamente esto, y crece
          con el número de operaciones:
        </p>
      </div>
      {s9 && (
        <Panel title="Cuña de spread — población heterogénea">
          <Table
            head={["", "valor"]}
            rows={[
              ["cuña media (fill − mid)", fmtPct(s9.diagnosis.spread_wedge_mean, 3)],
              ["cuña por operación adicional", fmtNum(s9.diagnosis.spread_wedge_per_trade, 6)],
              ["p", fmtP(s9.diagnosis.spread_wedge_per_trade_p)],
            ]}
          />
        </Panel>
      )}

      <h2 style={{ marginTop: "2rem" }}>3. Efectos de composición geométrica ("compounding path")</h2>
      <div className="prose">
        <p>
          Incluso con retornos i.i.d. y sin ningún sesgo, el turnover cambia el
          retorno geométrico realizado de una cartera: rotar más una posición le
          quita a esa posición la chance de componer sobre un horizonte largo. Se ve
          en el escenario nulo (<span className="mono">δ=κ=0</span>), donde no
          debería haber ninguna relación mecánica y aun así queda un residuo pequeño:
        </p>
      </div>
      {s1 && (
        <Panel title="Escenario 1 (nulo): β(bruto,mid ~ turnover)">
          <Table
            head={["", "β", "p"]}
            rows={[["nulo (δ=κ=0)", fmtNum(s1.overconfidence.gross_mid.beta_turnover, 4), fmtP(s1.overconfidence.gross_mid.p_beta_turnover)]]}
          />
          <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", marginTop: "0.6rem" }}>
            Es pequeño frente a los β de la sección de sobreconfianza (orden de
            magnitud 5-10 veces menor), pero no es exactamente cero — es la firma de
            este mecanismo, no un error.
          </p>
        </Panel>
      )}

      <h2 style={{ marginTop: "2rem" }}>4. Causalidad inversa — la más grande, y la más engañosa</h2>
      <div className="prose">
        <p>
          Si la regla de venta depende de si la posición está en ganancia (que es
          exactamente lo que hace la disposición por construcción), una cuenta que
          tuvo suerte tiene más ganadores en cartera, vende más de ellos, y termina
          con turnover alto <em>como consecuencia</em> de su retorno — no al revés.
          La regresión lee la flecha al revés. Esto se ve regresando turnover sobre
          el retorno (en vez de al revés) en escenarios donde sólo δ está activo,
          contra uno donde sólo κ está activo:
        </p>
      </div>
      {s3 && s5 && (
        <Panel title="β(turnover ~ retorno neto), controlando por tamaño/posiciones/exposición">
          <Table
            head={["escenario", "β", "p", "signo"]}
            rows={[
              ["3. sólo disposición (δ=0.8)", fmtNum(s3.diagnosis.reverse_causality_beta, 3), fmtP(s3.diagnosis.reverse_causality_p), s3.diagnosis.reverse_causality_beta > 0 ? "positivo — causalidad inversa" : "—"],
              ["5. sólo sobreconfianza (κ=0.8)", fmtNum(s5.diagnosis.reverse_causality_beta, 3), fmtP(s5.diagnosis.reverse_causality_p), s5.diagnosis.reverse_causality_beta < 0 ? "negativo — canal de costo" : "—"],
            ]}
          />
          <p style={{ fontSize: "0.85rem", marginTop: "0.7rem" }} className="prose">
            El signo se invierte según qué mecanismo domina. Con sólo disposición
            activa (escenario 3), el signo es <strong>positivo</strong>: exactamente
            la firma de causalidad inversa descrita en la consigna. Con sólo
            sobreconfianza activa (escenario 5), el signo es <strong>negativo</strong>,
            porque ahí no existe ninguna regla que dependa de si la posición está en
            ganancia — el turnover es genuinamente exógeno al retorno, y lo único que
            queda es el canal de costo real.
          </p>
        </Panel>
      )}
      {s2 && (
        <Panel title="Consecuencia sobre β(retorno ~ turnover) en los escenarios de disposición">
          <Table
            head={["escenario", "β neto", "β bruto (mid)"]}
            rows={[
              ["2. disposición baja (δ=0.3)", fmtNum(s2.overconfidence.net.beta_turnover, 4), fmtNum(s2.overconfidence.gross_mid.beta_turnover, 4)],
              ["3. disposición alta (δ=0.8)", s3 ? fmtNum(s3.overconfidence.net.beta_turnover, 4) : "…", s3 ? fmtNum(s3.overconfidence.gross_mid.beta_turnover, 4) : "…"],
            ]}
          />
          <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", marginTop: "0.6rem" }}>
            El signo es positivo y crece con δ — la causalidad inversa es lo bastante
            fuerte en este simulador como para dar vuelta el signo del canal de costo
            cuando la disposición está activa sin sobreconfianza. Ver la sección de
            Escenarios para el resultado limpio (canal de costo dominando) en la
            población heterogénea, donde ambos mecanismos coexisten en proporciones
            realistas.
          </p>
        </Panel>
      )}

      <h2 style={{ marginTop: "2rem" }}>Escenarios 7 y 8: confusores puros por diseño</h2>
      <div className="prose">
        <p>
          En estos dos escenarios <span className="mono">δ=κ=0</span> — la tasa de
          riesgo de venta es idéntica para ganancias y pérdidas — pero cada uno activa
          una regla de venta completamente distinta que no lee el precio de compra en
          absoluto:
        </p>
        <ul>
          <li>
            <strong>7 (rebalanceo):</strong> cada 21 días se recorta cualquier posición
            que supere en más de 30% su peso de equal-weight objetivo. Como el peso
            sube cuando el precio sube, esto recorta ganadores mecánicamente.
          </li>
          <li>
            <strong>8 (creencia en reversión):</strong> la tasa de venta se multiplica
            por una función del retorno reciente del <em>título</em> (no de la cuenta),
            así que se vende lo que subió recientemente en el mercado — algo que en
            este simulador no tiene ningún poder predictivo real, porque los retornos
            son i.i.d.
          </li>
        </ul>
      </div>
      {s1 && s7 && s8 && (
        <Panel title="PGR − PLR: nulo vs. los dos confusores">
          <Table
            head={["escenario", "PGR", "PLR", "PGR−PLR", "SE (cluster)"]}
            rows={[
              ["1. nulo", fmtPct(s1.disposition.PGR), fmtPct(s1.disposition.PLR), fmtPct(s1.disposition.diff, 3), fmtNum(s1.disposition.se_diff_cluster, 4)],
              ["7. rebalanceo", fmtPct(s7.disposition.PGR), fmtPct(s7.disposition.PLR), fmtPct(s7.disposition.diff, 3), fmtNum(s7.disposition.se_diff_cluster, 4)],
              ["8. reversión", fmtPct(s8.disposition.PGR), fmtPct(s8.disposition.PLR), fmtPct(s8.disposition.diff, 3), fmtNum(s8.disposition.se_diff_cluster, 4)],
            ]}
          />
          <p className="prose" style={{ fontSize: "0.85rem", marginTop: "0.7rem" }}>
            Ambos confusores disparan una brecha PGR−PLR estadísticamente enorme
            frente a su error estándar, del mismo orden de magnitud que la disposición
            genuina del escenario 2 o 3. Un investigador que sólo mirara este número,
            sin poder inspeccionar la regla de decisión, concluiría "hay disposición"
            en los tres casos — y se equivocaría en dos de ellos. Esa es precisamente
            la advertencia que motiva todo este proyecto: el estimador no puede, por sí
            solo, distinguir un sesgo genuino de una regla de rebalanceo o de una
            creencia (incluso incorrecta) en reversión. Distinguirlos requiere mirar el
            mecanismo, no sólo el número.
          </p>
        </Panel>
      )}
    </div>
  );
}
