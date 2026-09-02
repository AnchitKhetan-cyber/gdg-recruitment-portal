FROM node:22-alpine

WORKDIR /app

# Install dependencies first so a code change does not invalidate the layer.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Run as the unprivileged user the base image already provides.
USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
