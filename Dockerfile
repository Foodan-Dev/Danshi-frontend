# Expo Web 静态导出 → nginx 托管
#
# API 地址在构建期烘进 bundle（EXPO_PUBLIC_* 是编译期内联的），
# 因此换环境必须重新构建镜像，不能只改运行时环境变量。

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_REQUEST_TIMEOUT_MS=10000
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    EXPO_PUBLIC_REQUEST_TIMEOUT_MS=${EXPO_PUBLIC_REQUEST_TIMEOUT_MS}

RUN npx expo export --platform web --output-dir dist

FROM nginx:1.29-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
