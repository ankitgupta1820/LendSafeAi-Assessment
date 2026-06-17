# Use Node LTS alpine image
FROM node:20-alpine

WORKDIR /app

# Copy package configurations
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy backend files
COPY backend/ .

# Expose backend port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
