# El sesgo bajo control

Un simulador de mercado con **verdad conocida**: se inyecta una magnitud exacta
de disposición (`δ`) y sobreconfianza (`κ`) en una población sintética de
cuentas, y luego se usan los estimadores estándar de la literatura (Odean 1998,
Barber & Odean 2000) para tratar de recuperar esas magnitudes. La presentación
completa —motivación, matemática, resultados de los 8 escenarios pedidos,
diagnóstico de los cuatro confusores, y validación— vive en el front end; este
archivo es sólo el mapa del repositorio.

## Estructura

```
backend/     FastAPI + el simulador y los estimadores en Python puro
  app/simulator/     precios (modelo de factores), agentes, motor de simulación
  app/estimators/    disposición (PGR/PLR + bootstrap), sobreconfianza (OLS), diagnóstico
  app/validation/    placebo de trading informado, independencia, monotonía
  app/api/           endpoints FastAPI + esquemas Pydantic

frontend/    React + TypeScript + Vite
  src/pages/         las 6 secciones de la presentación
  src/components/    KaTeX, gráficos (Recharts), tablas/paneles
```

## Correr todo localmente

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000

# frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Abrir la URL que imprime Vite (por defecto `http://localhost:5174`).

## Decisiones de diseño que vale la pena saber de antemano

- **PGR y PLR nunca se parametrizan directamente.** Lo que se inyecta es una
  tasa de riesgo (hazard) de venta que depende del retorno no realizado a
  través de una `tanh`; PGR/PLR son un conteo hecho después, sobre lo que
  efectivamente se vendió. Ver `backend/app/simulator/engine.py` y la página
  **El modelo** del front end.
- **Números aleatorios comunes.** Los 8 escenarios estándar comparten el mismo
  panel de precios y la misma población de partida (mismas semillas) — sólo
  cambia la configuración de comportamiento. Sin esto, comparar escenarios
  mezclaría el efecto inyectado con la suerte de cada mercado simulado. Ver
  `backend/app/simulator/scenario.py`.
- **Tres medidas de retorno por cuenta** (`neto`, `bruto,fill`, `bruto,mid`)
  separan el costo de operar de la habilidad de selección, y son la base de
  todo el diagnóstico de confusores en la página homónima.
- **Bootstrap por cuenta, no por operación**, para el error estándar de
  PGR−PLR — las observaciones dentro de una cuenta no son independientes.

Todo esto está explicado con la matemática completa y los números reales de
cada corrida en la aplicación misma (secciones **El modelo**, **Escenarios y
resultados**, **Diagnóstico de confusores** y **Validación**).
