FROM node:22-alpine

# tini is a tiny init that reaps zombies and forwards signals, so SIGTERM from
# the orchestrator reaches server.js's graceful-shutdown handler cleanly.
RUN apk add --no-cache tini

WORKDIR /app

# Default to production. This is what switches on Secure cookies, hides stack
# traces, and makes the API refuse the dev-login bypass - so the image is safe
# even if a host forgets to set NODE_ENV.
ENV NODE_ENV=production

# Install dependencies first so a code change does not invalidate the layer.
# --omit=dev drops test-only packages (mongodb-memory-server, nodemon).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the source owned by the unprivileged runtime user.
COPY --chown=node:node . .

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
