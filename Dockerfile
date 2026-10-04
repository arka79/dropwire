# Single image that runs both processes (web on :3000, signaling on :4000).
# Build args are inlined into the client bundle at build time — set them to
# your public origins:
#   docker build -t dropwire \
#     --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
#     --build-arg NEXT_PUBLIC_SIGNALING_URL= \
#     .
# An empty NEXT_PUBLIC_SIGNALING_URL means "same origin": put a reverse
# proxy in front that sends /socket.io, /config and /health to :4000 and
# everything else to :3000, and set TRUST_PROXY=1 at runtime.
FROM node:24-alpine AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SIGNALING_URL=http://localhost:4000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SIGNALING_URL=$NEXT_PUBLIC_SIGNALING_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=build /app /app
EXPOSE 3000 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -q -O - http://127.0.0.1:4000/health || exit 1
CMD ["npm", "run", "start:prod"]
