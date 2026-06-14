# ── Stage 1: Build ──
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first (for Docker layer caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build args for env variables (injected at build time)
ARG VITE_API_URL
ARG VITE_SERVER_URL
ARG VITE_FACE_SERVER_URL
ARG VITE_CAMERA_API_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_TURNSTILE_SITE_KEY

# Build the production bundle
RUN npm run build

# ── Stage 2: Serve ──
FROM nginx:alpine AS production

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
