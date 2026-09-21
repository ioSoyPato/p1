# Single image: builds the React/Vite frontend, then serves it AND the
# FastAPI backend from one Python process on one port. No second image,
# no docker-compose needed.
#
#   docker build -t sesgo-simulador .
#   docker run -p 8000:8000 sesgo-simulador
#   -> http://localhost:8000

# ---- stage 1: compile the frontend to static files ----
FROM node:22-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig*.json ./
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/.env.production ./.env.production

# VITE_API_BASE resolves to "" at build time (see .env.production), so the
# built app calls "/api/..." on whatever origin serves it -- exactly this
# container, on whatever port it's run with.
RUN npm run build

# ---- stage 2: the actual runtime image ----
FROM python:3.12-slim AS runtime

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend-build /frontend/dist ./frontend_dist

ENV FRONTEND_DIST=/app/frontend_dist
EXPOSE 8000

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
