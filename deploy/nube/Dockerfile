FROM node:22-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y --no-install-recommends \
 ca-certificates curl git gh ffmpeg python3 python3-venv python3-pip build-essential unzip procps \
 libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 \
 libxfixes3 libxcomposite1 libxdamage1 libcups2 libpango-1.0-0 libcairo2 fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
# CLI oficiales; Codex usa la misma versión que la app. Las sesiones se autorizan después, nunca al construir.
RUN npm install -g @anthropic-ai/claude-code @shopify/cli
RUN useradd --uid 10001 --create-home --home-dir /srv/home kads
WORKDIR /opt/kads
COPY app/package*.json app/
COPY remotion/package*.json remotion/
COPY app/inicio/codex/package*.json app/inicio/codex/
RUN npm ci --prefix app --no-audit --no-fund && npm ci --prefix remotion --no-audit --no-fund \
 && npm ci --prefix app/inicio/codex --no-audit --no-fund
COPY . .
RUN npm run build --prefix app && cd remotion && npx remotion browser ensure
RUN python3 -m venv /opt/python && /opt/python/bin/pip install 'rembg[cpu]' onnxruntime pillow numpy faster-whisper librosa yt-dlp \
 && /opt/python/bin/pip install -r /opt/kads/.claude/skills/anuncios-sketch/scripts/requirements.txt
ENV PATH="/opt/python/bin:/opt/kads/app/inicio/codex/node_modules/.bin:${PATH}" \
 HOME=/srv/home KADS_HOME=/srv/home KADS_RAIZ=/srv/kads
RUN mkdir -p /srv/home /srv/kads
ENTRYPOINT ["node","/opt/kads/deploy/nube/arrancar.mjs"]
