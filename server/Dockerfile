# ---- SZU Valley Server ----
FROM node:20-alpine

WORKDIR /app

# 依赖安装 · Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 构建产物 · Build output
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# 运行 · Run
EXPOSE 3001
CMD ["node", "dist/index.js"]
