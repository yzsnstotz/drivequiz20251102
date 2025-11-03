# ZALEM AI-Service Dockerfile
# 基于 Node 20 Alpine，轻量级镜像

FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖（生产依赖）
RUN npm ci --omit=dev

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 从 builder 复制依赖和构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# 暴露端口（Railway 会自动映射）
EXPOSE 8787

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/healthz', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["npm", "start"]

