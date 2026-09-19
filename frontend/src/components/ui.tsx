import type { ReactNode } from "react";

export function Panel({ title, sub, children }: { title?: string; sub?: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius)",
        background: "var(--paper-raised)",
        padding: "1.1rem 1.3rem",
        margin: "1.1rem 0",
      }}
    >
      {title && (
        <div style={{ marginBottom: sub ? "0.15rem" : "0.7rem" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.92rem" }}>{title}</span>
        </div>
      )}
      {sub && (
        <div style={{ color: "var(--ink-muted)", fontSize: "0.82rem", marginBottom: "0.7rem" }}>{sub}</div>
      )}
      {children}
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string; hint?: string; tone?: "good" | "critical" | "neutral" }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.6rem" }}>
      {items.map((it, i) => (
        <div key={i} style={{ minWidth: "7rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.18rem" }}>{it.label}</div>
          <div
            className="mono"
            style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              color: it.tone === "good" ? "var(--good)" : it.tone === "critical" ? "var(--critical)" : "var(--ink)",
            }}
          >
            {it.value}
          </div>
          {it.hint && <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div className="scrollx">
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.86rem" }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  borderBottom: "1px solid var(--rule-strong)",
                  padding: "0.35rem 0.6rem",
                  color: "var(--ink-soft)",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.78rem",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={ci === 0 ? "" : "mono"}
                  style={{
                    textAlign: ci === 0 ? "left" : "right",
                    borderBottom: "1px solid var(--rule)",
                    padding: "0.35rem 0.6rem",
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "critical" | "neutral" | "accent" }) {
  const colors: Record<string, [string, string]> = {
    good: ["var(--good)", "transparent"],
    critical: ["var(--critical)", "transparent"],
    neutral: ["var(--ink-muted)", "transparent"],
    accent: ["var(--accent-blue)", "var(--accent-blue-soft)"],
  };
  const [fg, bg] = colors[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: "0.72rem",
        color: fg,
        background: bg,
        border: `1px solid ${fg}`,
        borderRadius: "2px",
        padding: "0.05rem 0.4rem",
      }}
    >
      {children}
    </span>
  );
}

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}
export function fmtNum(x: number | null | undefined, digits = 3): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return x.toFixed(digits);
}
export function fmtP(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
export function sigStars(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}
