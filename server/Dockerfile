# ---- SZU Valley Server · Multi-stage build ----
# Stage 1: Build (full dependencies for TypeScript compilation)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production (runtime only)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/src/data/ ./dist/data/
EXPOSE 3001
CMD ["node", "dist/index.js"]
