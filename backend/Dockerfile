FROM node:20-alpine AS base
WORKDIR /app

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Create data & uploads directories
RUN mkdir -p data uploads

EXPOSE 3000
CMD ["node", "src/index.js"]
