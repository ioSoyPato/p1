export type PageKey = "resumen" | "modelo" | "escenarios" | "confusores" | "validacion" | "reproducibilidad";

const ITEMS: { key: PageKey; label: string; n?: string }[] = [
  { key: "resumen", label: "Por qué un simulador" },
  { key: "modelo", label: "El modelo", n: "matemática" },
  { key: "escenarios", label: "Escenarios y resultados", n: "interactivo" },
  { key: "confusores", label: "Diagnóstico de confusores" },
  { key: "validacion", label: "Validación" },
  { key: "reproducibilidad", label: "Reproducibilidad" },
];

export function Nav({ current, onNavigate }: { current: PageKey; onNavigate: (k: PageKey) => void }) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.3rem" }}>
        El sesgo bajo control
      </div>
      <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)", marginBottom: "1.2rem", lineHeight: 1.4 }}>
        Un simulador de mercado con verdad conocida para estimar disposición y sobreconfianza
      </div>
      {ITEMS.map((it) => {
        const active = it.key === current;
        return (
          <button
            key={it.key}
            onClick={() => onNavigate(it.key)}
            style={{
              textAlign: "left",
              background: active ? "var(--accent-blue-soft)" : "transparent",
              color: active ? "var(--accent-blue)" : "var(--ink-soft)",
              border: "none",
              borderLeft: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
              padding: "0.45rem 0.6rem",
              fontSize: "0.88rem",
              cursor: "pointer",
              borderRadius: "0 3px 3px 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.5rem",
            }}
          >
            <span>{it.label}</span>
            {it.n && (
              <span className="mono" style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>
                {it.n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
