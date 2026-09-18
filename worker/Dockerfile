FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3-pip \
  && pip3 install --break-system-packages --no-cache-dir --upgrade "yt-dlp[default]" \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
