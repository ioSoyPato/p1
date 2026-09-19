import { useEffect, useState } from "react";
import { api, type PlaceboResult } from "../lib/api";
import { Panel, StatRow, fmtPct, fmtP } from "../components/ui";
import type { PageKey } from "../components/Nav";

export function Resumen({ onNavigate }: { onNavigate: (k: PageKey) => void }) {
  const [placebo, setPlacebo] = useState<PlaceboResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.placebo().then(setPlacebo).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "2.1rem", maxWidth: "34rem" }}>
        Con datos reales nunca se sabe si un sesgo es real o un error de código.
        Con un simulador, sí.
      </h1>

      <div className="prose">
        <p>
          El efecto disposición —vender ganadores demasiado rápido y aferrarse a los
          perdedores— ya está documentado. No hace falta este trabajo para demostrar
          que existe. La pregunta que sí vale la pena responder es otra: si yo,
          hoy, corro un estudio con datos de cuentas reales y encuentro ese patrón,
          ¿cómo sé que lo que estoy midiendo es el sesgo, y no un error en cómo
          definí una ganancia realizada, un supuesto de costos mal calibrado, o una
          casualidad del mercado en esos años puntuales? Con datos reales, nunca se
          sabe. No existe una cuenta de control que sepamos, con certeza, que{" "}
          <em>no</em> tiene el sesgo.
        </p>
        <p>
          La solución de este proyecto es construir el problema al revés. En vez de
          buscar el sesgo en datos que ya existen, se simula un mercado desde cero,
          se le inyecta a una población de cuentas sintéticas una magnitud exacta y
          conocida de dos sesgos —disposición (<span className="mono">δ</span>) y
          sobreconfianza (<span className="mono">κ</span>)— y después se usan los
          mismos estimadores que usaría un investigador con datos reales (Odean 1998
          para disposición, Barber &amp; Odean 2000 para sobreconfianza) para tratar
          de recuperar esas magnitudes. Si el estimador encuentra{" "}
          <span className="mono">δ ≈ 0</span> cuando se inyectó <span className="mono">δ = 0</span>, y
          encuentra una brecha cada vez más grande a medida que <span className="mono">δ</span> sube
          de 0.3 a 0.8, entonces el estimador funciona. Si no lo logra, el estimador
          —no el mercado— está roto, y ahora se sabe.
        </p>
        <p>
          Esto no es una comprobación decorativa. Es la única forma de responder,
          con evidencia y no con fe, a la pregunta que de verdad importa cuando se
          usa un estimador de sesgos conductuales sobre datos que uno no controla:{" "}
          <strong>¿qué tan seguro puedo estar de que esto mide lo que dice medir?</strong>
        </p>
      </div>

      <Panel
        title="Una prueba concreta de que no hay trampa"
        sub="Cada vez que una cuenta reinvierte, el título que compra se elige con un número aleatorio uniforme —nunca en función de lo que ese título vaya a rendir después. Esto se puede verificar directamente:"
      >
        {err && <div style={{ color: "var(--critical)", fontSize: "0.85rem" }}>No se pudo conectar al backend ({err}). ¿Está corriendo `uvicorn` en :8000?</div>}
        {!err && !placebo && <div style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Calculando…</div>}
        {placebo && (
          <StatRow
            items={[
              {
                label: "corr(título comprado, retorno futuro a 20 días)",
                value: placebo.correlation.toFixed(4),
                hint: `n = ${placebo.n_events.toLocaleString("es")} compras`,
              },
              {
                label: "diferencia de medias vs. benchmark incondicional",
                value: fmtPct(placebo.mean_diff, 3),
                hint: `p = ${fmtP(placebo.mean_diff_p)} — no distinguible de cero`,
                tone: "good",
              },
            ]}
          />
        )}
      </Panel>

      <div className="prose">
        <p>
          Ese número (≈0, sin significancia estadística) es la restricción más
          importante de todo el diseño: si el retorno futuro de un título dependiera,
          aunque sea un poco, de qué cuenta lo compró, cualquier cuenta con mucha
          rotación terminaría pareciendo "informada" —compraría sistemáticamente
          títulos que después suben— y todo el ejercicio de sobreconfianza mediría el
          signo equivocado. La sección{" "}
          <button className="mono" style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", padding: 0, fontSize: "0.95em" }} onClick={() => onNavigate("confusores")}>
            Diagnóstico de confusores
          </button>{" "}
          explica exactamente qué otros cuatro mecanismos sí pueden generar una
          pendiente negativa sin que haya ningún error, y cómo se distingue uno del
          otro.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.9rem", marginTop: "1.6rem", flexWrap: "wrap" }}>
        <NavCard onClick={() => onNavigate("modelo")} title="El modelo" desc="Precios, costos, y la regla de venta como una tasa de riesgo — no un if." />
        <NavCard onClick={() => onNavigate("escenarios")} title="Escenarios" desc="Las 8 configuraciones pedidas, más un constructor de escenarios propios." />
        <NavCard onClick={() => onNavigate("validacion")} title="Validación" desc="Recuperación del cero, monotonía, y el error estándar correcto." />
      </div>
    </div>
  );
}

function NavCard({ onClick, title, desc }: { onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 14rem",
        textAlign: "left",
        background: "var(--paper-raised)",
        border: "1px solid var(--rule)",
        borderRadius: "3px",
        padding: "0.9rem 1rem",
        cursor: "pointer",
        color: "var(--ink)",
      }}
    >
      <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, marginBottom: "0.25rem" }}>{title} →</div>
      <div style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{desc}</div>
    </button>
  );
}
