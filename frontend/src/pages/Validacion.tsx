import { useEffect, useState } from "react";
import { api, type IndependenceResult, type MonotonicityRow, type PlaceboResult } from "../lib/api";
import { Panel, Table, fmtNum, fmtP, fmtPct } from "../components/ui";

export function Validacion() {
  const [placebo, setPlacebo] = useState<PlaceboResult | null>(null);
  const [indep, setIndep] = useState<IndependenceResult | null>(null);
  const [mono, setMono] = useState<MonotonicityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.placebo().then(setPlacebo).catch((e) => setError(String(e)));
    api.independence().then(setIndep).catch((e) => setError(String(e)));
    api.monotonicity().then((r) => setMono(r.rows)).catch((e) => setError(String(e)));
  }, []);

  const deltaRows = mono?.filter((r) => r.axis === "delta") ?? [];
  const kappaRows = mono?.filter((r) => r.axis === "kappa") ?? [];
  const seeds = Array.from(new Set(deltaRows.map((r) => r.seed)));

  return (
    <div>
      <h1>Validación</h1>
      <div className="prose">
        <p>
          Un estimador que no puede recuperar el cero que se le inyectó, o que no
          responde en la dirección correcta cuando el parámetro inyectado sube, está
          mal — sin importar qué tan razonable se vea el código. Esta página corre esa
          prueba directamente, no la asume.
        </p>
      </div>
      {error && <div style={{ color: "var(--critical)" }}>{error}</div>}

      <h2 style={{ marginTop: "2rem" }}>1. La restricción grande: sin trading informado</h2>
      {placebo && (
        <Panel title="corr(título comprado, retorno futuro) y diferencia de medias vs. benchmark">
          <Table
            head={["", "valor"]}
            rows={[
              ["correlación (título, retorno a 20 días)", fmtNum(placebo.correlation, 4)],
              ["diferencia de medias (comprado − incondicional)", fmtPct(placebo.mean_diff, 3)],
              ["error estándar de la diferencia", fmtPct(placebo.mean_diff_se, 3)],
              ["p", fmtP(placebo.mean_diff_p)],
              ["n compras evaluadas", placebo.n_events.toLocaleString("es")],
            ]}
          />
        </Panel>
      )}
      <p className="prose" style={{ fontSize: "0.9rem" }}>
        Si esta diferencia fuera distinguible de cero, cualquier hallazgo de
        sobreconfianza en este simulador sería sospechoso de estar contaminado por
        trading informado accidental — el primero de los cuatro mecanismos de la
        página de Confusores, y el único que sería un error real de diseño.
      </p>

      <h2 style={{ marginTop: "2rem" }}>2. Independencia entre δ y κ</h2>
      <div className="prose">
        <p>
          δ<sub>i</sub> y κ<sub>i</sub> se generan con dos llamadas separadas al
          generador de números aleatorios (ver <span className="mono">agents.py</span>):
          nada en el código condiciona una en función de la otra. Eso garantiza que su
          correlación muestral sea chica, pero <strong>no</strong> garantiza lo mismo
          para la correlación entre δ y el turnover realizado — son cosas distintas.
        </p>
      </div>
      {indep && (
        <Panel title={`Población heterogénea (n=${indep.n_agents}, δ,κ ~ U(0,1) i.i.d.)`}>
          <Table
            head={["par", "correlación muestral"]}
            rows={[
              ["corr(δ, κ) — parámetros inyectados", fmtNum(indep.corr_delta_kappa, 4)],
              ["corr(δ, turnover realizado)", fmtNum(indep.corr_delta_turnover, 4)],
              ["corr(κ, turnover realizado)", fmtNum(indep.corr_kappa_turnover, 4)],
            ]}
          />
        </Panel>
      )}
      <div className="prose">
        <p>
          corr(δ, κ) sale cerca de cero, como debe ser. corr(δ, turnover) sale
          <strong> distinto</strong> de cero, y no es un error: un δ alto reduce la
          tasa de riesgo de venta específicamente en las posiciones con pérdida
          (el término <span className="mono">tanh</span> del modelo es menor a 1 para{" "}
          <span className="mono">x&lt;0</span>), así que una cuenta con δ alto retiene
          más sus perdedores y por lo tanto vende con menos frecuencia — su turnover
          medido baja como consecuencia mecánica de δ, sin que δ y κ hayan estado
          correlacionados en absoluto al generarse. Esta es exactamente la distinción
          que pide la consigna entre <em>el parámetro inyectado</em> y{" "}
          <em>el comportamiento que produce</em>: son independientes por construcción,
          pero uno de ellos deja una huella causal directa sobre una variable que
          después se usa como regresor en la sección de sobreconfianza.
        </p>
        <p>
          <strong>¿Qué pasaría si δ y κ se hubieran generado correlacionados por
          diseño?</strong> Si, por ejemplo, las cuentas con κ alto tendieran también a
          tener δ alto, el turnover dejaría de ser una medida limpia de sobreconfianza:
          parte de su variación cruzada vendría de δ (a través del canal de causalidad
          inversa de la página de Confusores), y el coeficiente β de la regresión de
          sobreconfianza estaría capturando una mezcla de ambos mecanismos en vez del
          costo de operar de más. En la práctica, eso sesgaría β hacia valores más
          positivos (si δ y κ fueran positivamente correlacionados, porque el canal de
          causalidad inversa de la disposición empuja el signo hacia arriba) y haría
          que el coeficiente ya no tuviera una interpretación causal única —
          exactamente el problema que el diseño de "muestreo independiente" evita.
        </p>
      </div>

      <h2 style={{ marginTop: "2rem" }}>3. Recuperación del cero y monotonía</h2>
      <div className="prose">
        <p>
          Se corren tres réplicas independientes (semillas distintas) de un barrido en
          δ (con κ=0) y un barrido en κ (con δ=0), cada barrido compartiendo mercado y
          población dentro de la réplica.
        </p>
      </div>
      {mono && (
        <>
          <Panel title="Barrido en δ (κ=0): PGR − PLR debería crecer con δ">
            <Table
              head={["δ", ...seeds.map((s) => `semilla ${s}`)]}
              rows={[0, 0.3, 0.8].map((v) => [
                String(v),
                ...seeds.map((s) => {
                  const row = deltaRows.find((r) => r.value === v && r.seed === s);
                  return row ? fmtPct(row.diff, 3) : "…";
                }),
              ])}
            />
          </Panel>
          <Panel title="Barrido en κ (δ=0): β(neto ~ turnover) debería ser ≤0 y no crecer">
            <Table
              head={["κ", ...seeds.map((s) => `semilla ${s}`)]}
              rows={[0, 0.3, 0.8].map((v) => [
                String(v),
                ...seeds.map((s) => {
                  const row = kappaRows.find((r) => r.value === v && r.seed === s);
                  return row ? fmtNum(row.beta_net, 4) : "…";
                }),
              ])}
            />
          </Panel>
        </>
      )}
      <div className="prose">
        <p>
          La brecha PGR−PLR es monótona creciente en δ en todas las réplicas, y
          esencialmente nula en δ=0 — el estimador recupera el cero y responde en la
          dirección correcta. El coeficiente β en el barrido de κ es más ruidoso
          escenario a escenario (dentro de una población homogénea en κ, la única
          variación transversal de turnover viene de ruido de muestreo, no del
          parámetro en sí — ver la nota metodológica en la página de Escenarios), pero
          se mantiene negativo o indistinguible de cero en δ=0, nunca positivo y
          grande, que es lo que importa para descartar un error de signo.
        </p>
      </div>
    </div>
  );
}
