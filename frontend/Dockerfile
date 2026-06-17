# Use Node LTS alpine image for building
FROM node:20-alpine AS build

WORKDIR /app

# Copy package configurations
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source files
COPY frontend/ .

# Build assets
RUN npm run build

# Use Nginx alpine to serve static assets
FROM nginx:1.25-alpine

# Copy custom build output to nginx document root
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
