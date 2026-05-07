# NyayaFlow AI — single-container deployment.
#
# Runs BOTH services in one Render web service:
#   • Next.js  on $PORT (public)
#   • FastAPI  on 127.0.0.1:8000 (internal)
#
# The frontend talks to the Python service over loopback, so judges hitting
# the deploy URL get the same experience as local dev — including real
# PyMuPDF page rendering with PyMuPDF-drawn highlight rectangles and
# Tesseract OCR for scanned PDFs.

# -----------------------------------------------------------------------------
# Stage 1 — Build Next.js
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Install Node deps with cached layers
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the Next.js app
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Runtime: Node + Python + Tesseract in one image
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NYAYAFLOW_PY_URL=http://127.0.0.1:8000 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System dependencies: Python, Tesseract OCR, curl (for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        tesseract-ocr \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built Next.js app + only the Node modules it needs
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/next-env.d.ts ./
COPY --from=builder /app/types ./types
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/db ./db

# Copy Python service + sample data + samples folder
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/data/samples ./data/samples
COPY start.sh ./start.sh

# Make sure mutable dirs exist and are writable
RUN mkdir -p data/uploads \
    && chmod -R 777 data \
    && chmod +x start.sh

# Install Python deps inside an in-image venv
RUN python3 -m venv backend/.venv \
    && backend/.venv/bin/pip install --upgrade pip wheel \
    && backend/.venv/bin/pip install -r backend/requirements.txt

# Render injects $PORT (defaults to 3000 locally)
ENV PORT=3000
EXPOSE 3000

CMD ["./start.sh"]
