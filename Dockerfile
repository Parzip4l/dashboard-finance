# syntax=docker/dockerfile:1

# Shared dependency layer for the React frontend and backend_erp.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Development base. docker-compose mounts the project over /app for hot reload.
FROM deps AS dev-base
WORKDIR /app
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
COPY . .

FROM dev-base AS frontend-dev
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dev-base AS backend-erp-dev
EXPOSE 5100
CMD ["npm", "run", "dev:erp:watch"]

# Build static frontend assets for production-like deployment.
FROM deps AS frontend-build
WORKDIR /app
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS frontend-prod
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 9060
CMD ["nginx", "-g", "daemon off;"]

# backend_erp production-like image. Secrets are injected by env_file at runtime.
FROM node:22-alpine AS backend-erp-prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend_erp ./backend_erp
EXPOSE 5100
CMD ["node", "backend_erp/src/server.js"]
