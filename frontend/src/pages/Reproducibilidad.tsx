import { Panel, Table } from "../components/ui";

export function Reproducibilidad() {
  return (
    <div>
      <h1>Reproducibilidad</h1>
      <div className="prose">
        <p>
          Cada corrida es una función pura de dos semillas: no hay estado global ni
          orden de ejecución que cambie el resultado. Correr el mismo escenario dos
          veces —desde este front end, desde la API, o desde un script en Python—
          produce exactamente los mismos números, dígito por dígito.
        </p>
      </div>

      <Panel title="Las dos semillas de cada escenario">
        <Table
          head={["semilla", "controla", "compartida entre escenarios 1–8"]}
          rows={[
            ["price_seed", "el panel de precios completo (factores, betas, spreads)", "sí — mismo mercado para los 8"],
            ["seed", "capitales/tamaños de cartera y todos los sorteos del motor (ventas, reinversión)", "sí — misma población de partida"],
          ]}
        />
      </Panel>

      <div className="prose">
        <p>
          Esto es la técnica de <em>números aleatorios comunes</em>: al compartir
          ambas semillas entre los ocho escenarios estándar, la única diferencia entre
          correr el escenario 1 y el escenario 3 es la configuración de δ y κ — nunca
          una casualidad de mercado distinta. Sin esto, comparar el retorno promedio
          entre dos escenarios estaría comparando dos mercados distintos, no dos
          comportamientos distintos.
        </p>
      </div>

      <Panel title="Cómo correr el proyecto localmente">
        <pre className="mono scrollx" style={{ fontSize: "0.8rem", background: "var(--paper)", padding: "0.8rem", border: "1px solid var(--rule)", borderRadius: "3px" }}>
{`# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000

# frontend (otra terminal)
cd frontend
npm install
npm run dev`}
        </pre>
      </Panel>

      <div className="prose">
        <p>
          El repositorio no fija ninguna dependencia a una versión "de esta
          computadora": <span className="mono">requirements.txt</span> y{" "}
          <span className="mono">package.json</span> son las únicas fuentes de verdad.
          Todos los estimadores (disposición, sobreconfianza, diagnóstico de
          confusores, validación) están separados de la simulación en módulos
          independientes de Python (<span className="mono">app/estimators/</span>,{" "}
          <span className="mono">app/validation/</span>), así que se pueden correr
          también fuera del servidor, directamente desde un notebook o un script,
          contra cualquier <span className="mono">SimulationResult</span>.
        </p>
      </div>
    </div>
  );
}
