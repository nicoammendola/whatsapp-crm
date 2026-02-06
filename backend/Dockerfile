# WhatsApp CRM Backend — production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (need devDependencies for build)
# --legacy-peer-deps: skip unmet optional peer deps (react from prisma-studio, sharp from baileys)
RUN npm ci --legacy-peer-deps

# Copy source and config
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client and build TypeScript
RUN npx prisma generate && npm run build

EXPOSE 3001

# Run migrations then start the server
# Use a volume mount at SESSION_PATH (e.g. /data) for WhatsApp session persistence
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
