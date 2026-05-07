#!/usr/bin/env bash
# ============================================================================
# NyayaFlow AI — production start script
# ----------------------------------------------------------------------------
# Boots the Python FastAPI backend on 127.0.0.1:8000 in the background, waits
# for it to become healthy, then runs Next.js in the foreground on $PORT.
#
# Works on:
#   • Render's Node native runtime (Debian, Python 3.11 with PEP 668)
#   • Render's Docker runtime (via Dockerfile)
#   • Any Linux/macOS host with `node` and `python3` on PATH
#   • Local dev when you want to simulate production
#
# Render dashboard settings (THIS IS WHAT YOU PASTE):
#
#   Build Command:
#     npm install && npm run build && python3 -m pip install --user --break-system-packages --no-cache-dir -r backend/requirements.txt
#
#   Start Command:
#     ./start.sh
#
#   Health Check Path:
#     /api/health
# ============================================================================

set -u  # crash on unset vars  (NOT -e: we want graceful Python failure)

PY_PORT="${PY_PORT:-8000}"
NODE_PORT="${PORT:-3000}"
NODE_HOST="${HOST:-0.0.0.0}"

log() { echo "[NyayaFlow] $*"; }

log "═══════════════════════════════════════════════════════════"
log "  NyayaFlow AI — production boot"
log "  Python (FastAPI) → http://127.0.0.1:${PY_PORT}"
log "  Next.js          → http://${NODE_HOST}:${NODE_PORT}"
log "═══════════════════════════════════════════════════════════"

# ---------------------------------------------------------------------------
# 1) Pick the right Python interpreter
# ---------------------------------------------------------------------------
PY=""
if [ -x "backend/.venv/bin/python" ]; then
  PY="backend/.venv/bin/python"
  log "Python interpreter: $PY  ($($PY --version 2>&1))"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
  log "Python interpreter: $PY  ($($PY --version 2>&1))"
elif command -v python >/dev/null 2>&1; then
  PY="python"
  log "Python interpreter: $PY  ($($PY --version 2>&1))"
else
  log "⚠ No Python interpreter found on PATH."
fi

# ---------------------------------------------------------------------------
# 2) Helper: run a pip install variant and tee its output through sed.
#    Uses set -o pipefail so the real exit code is propagated.
# ---------------------------------------------------------------------------
run_pip() {
  local label="$1"
  shift
  log "  ▶ pip install ${label}"
  (
    set -o pipefail
    "$PY" -m pip install "$@" --no-cache-dir -r backend/requirements.txt 2>&1 \
      | sed 's/^/    [pip] /'
  )
  return $?
}

# ---------------------------------------------------------------------------
# 3) Make sure FastAPI / PyMuPDF / Uvicorn are importable.
#    If the build step already installed them this is a no-op.
#    Otherwise we try a sequence of install variants that work on Render's
#    Debian/PEP-668 environment.
# ---------------------------------------------------------------------------
PY_OK=0
if [ -n "$PY" ]; then
  if $PY -c "import fastapi, fitz, uvicorn" 2>/dev/null; then
    PY_OK=1
    log "✓ Python deps already installed"
  else
    log "▶ Python deps not importable — installing on the fly."
    log "  (Tip: paste this Build Command in Render so this only happens once,"
    log "   not on every cold start:"
    log "    npm install && npm run build && python3 -m pip install --user --break-system-packages --no-cache-dir -r backend/requirements.txt )"

    # Try strategies in order of preference for Render's Debian Python 3.11.
    if   run_pip "(--user --break-system-packages)" --user --break-system-packages; then :;
    elif run_pip "(--break-system-packages, system-wide)" --break-system-packages; then :;
    elif run_pip "(--user)" --user; then :;
    else log "  All pip install strategies failed.";
    fi

    if $PY -c "import fastapi, fitz, uvicorn" 2>/dev/null; then
      PY_OK=1
      log "✓ Python deps installed"
    else
      log "⚠ Python deps still not importable. Next.js will start, but PDF"
      log "  rendering will show the offline fallback. To fix permanently,"
      log "  set the Render Build Command shown above and redeploy."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 4) Start FastAPI in the background
# ---------------------------------------------------------------------------
PY_PID=""
if [ "$PY_OK" -eq 1 ]; then
  log "▶ Starting Python FastAPI backend on 127.0.0.1:${PY_PORT}..."
  $PY -m uvicorn backend.main:app \
      --host 127.0.0.1 \
      --port "$PY_PORT" \
      --workers 1 \
      --log-level info \
      > /tmp/nyayaflow-py.log 2>&1 &
  PY_PID=$!

  log "  Waiting for FastAPI /health (up to 60s)..."
  for i in $(seq 1 60); do
    if curl -fs -o /dev/null --max-time 2 "http://127.0.0.1:${PY_PORT}/health" 2>/dev/null; then
      log "  ✓ FastAPI is up (PID ${PY_PID})"
      break
    fi
    if ! kill -0 "$PY_PID" 2>/dev/null; then
      log "  ✗ FastAPI exited during startup. Last 20 log lines:"
      tail -20 /tmp/nyayaflow-py.log 2>/dev/null | sed 's/^/    /' || true
      PY_PID=""
      break
    fi
    sleep 1
  done

  if [ -n "$PY_PID" ] && ! curl -fs -o /dev/null --max-time 2 "http://127.0.0.1:${PY_PORT}/health" 2>/dev/null; then
    log "  ⚠ FastAPI didn't respond in 60s — continuing, UI will degrade gracefully."
  fi
fi

# ---------------------------------------------------------------------------
# 5) Forward shutdown signals so Render can stop both processes cleanly
# ---------------------------------------------------------------------------
shutdown() {
  log "▶ Shutting down..."
  if [ -n "${PY_PID:-}" ]; then
    kill -TERM "$PY_PID" 2>/dev/null || true
    wait "$PY_PID" 2>/dev/null || true
  fi
  exit 0
}
trap shutdown SIGINT SIGTERM

# ---------------------------------------------------------------------------
# 6) Start Next.js in the foreground.
# ---------------------------------------------------------------------------
log "▶ Starting Next.js production server on ${NODE_HOST}:${NODE_PORT}..."
if [ -x "node_modules/.bin/next" ]; then
  exec node_modules/.bin/next start -H "$NODE_HOST" -p "$NODE_PORT"
else
  exec node node_modules/next/dist/bin/next start -H "$NODE_HOST" -p "$NODE_PORT"
fi
