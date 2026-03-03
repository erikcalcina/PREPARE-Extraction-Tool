# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Accept build arguments
ARG VITE_BACKEND_HOST
ARG NODE_ENV=production

# Set environment variables for Vite build
ENV VITE_BACKEND_HOST=$VITE_BACKEND_HOST
ENV NODE_ENV=$NODE_ENV

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

