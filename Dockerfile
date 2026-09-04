FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HTTP_PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY config ./config
COPY src ./src

RUN mkdir -p /app/data/oauth && chown -R node:node /app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/interfaces/http/httpServer.js"]
