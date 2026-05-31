# ============================================================
# SZU Valley · Railway 单容器部署 Dockerfile
# ============================================================
# 多阶段构建：编译前端 → 编译后端 → 单容器运行
# 一个容器 = 静态文件 + WebSocket + Health Check
# ============================================================

# ---- Stage 1: 编译前端 · Build Client ----
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: 编译后端 · Build Server ----
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- Stage 3: 运行 · Runtime ----
FROM node:20-alpine
WORKDIR /app

# 只装生产依赖（含 pg PostgreSQL 客户端）
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# 复制后端编译产物 + 数据文件
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/dist/data ./dist/data

# 复制前端编译产物 → Node 服务器托管
COPY --from=client-builder /app/client/dist ./public
ENV PUBLIC_DIR=/app/public

EXPOSE 3001
CMD ["node", "dist/index.js"]
