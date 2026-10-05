# =============================================================================
# backend/Dockerfile
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# ติดตั้ง dependencies ก่อน (ใช้ cache layer ของ Docker)
COPY package*.json ./
RUN npm install

# คัดลอกโค้ดทั้งหมด
COPY . .

# สร้าง Prisma Client
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]