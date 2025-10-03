FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

RUN npm prune --production

RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
