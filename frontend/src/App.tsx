import { useState } from "react";
import { Nav, type PageKey } from "./components/Nav";
import { Resumen } from "./pages/Resumen";
import { Modelo } from "./pages/Modelo";
import { Escenarios } from "./pages/Escenarios";
import { Confusores } from "./pages/Confusores";
import { Validacion } from "./pages/Validacion";
import { Reproducibilidad } from "./pages/Reproducibilidad";

export default function App() {
  const [page, setPage] = useState<PageKey>("resumen");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: "15.5rem",
          flexShrink: 0,
          borderRight: "1px solid var(--rule)",
          padding: "1.6rem 1rem",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <Nav current={page} onNavigate={setPage} />
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "2.4rem clamp(1rem, 4vw, 3.5rem)" }}>
        <div style={{ maxWidth: "58rem" }}>
          {page === "resumen" && <Resumen onNavigate={setPage} />}
          {page === "modelo" && <Modelo />}
          {page === "escenarios" && <Escenarios />}
          {page === "confusores" && <Confusores />}
          {page === "validacion" && <Validacion />}
          {page === "reproducibilidad" && <Reproducibilidad />}
        </div>
      </main>
    </div>
  );
}
