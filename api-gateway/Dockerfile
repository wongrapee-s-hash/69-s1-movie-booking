# =============================================================================
# api-gateway/Dockerfile
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# ติดตั้ง dependencies ตาม package-lock.json (version ตรงกันทุกเครื่อง)
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]