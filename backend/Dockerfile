# =============================================================================
# backend/Dockerfile
# ระบบจองตั๋วหนัง — Express.js + Prisma + PostgreSQL
# =============================================================================
# ใช้ node:20-slim (Debian) แทน alpine เพราะ Prisma Migrate
# ต้องการ OpenSSL เวอร์ชัน 1.1 ซึ่งไม่มีใน Alpine รุ่นใหม่
# ถ้าใช้ alpine จะได้ error "Error relocating ... X509_free: symbol not found"
# =============================================================================
FROM node:20-slim

WORKDIR /app

# ติดตั้ง OpenSSL สำหรับ Prisma Migrate
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ติดตั้ง dependencies ตาม package-lock.json (version ตรงกันทุกเครื่อง)
# npm ci ต้องมี package-lock.json และ fail ถ้า lock กับ package.json ไม่ตรงกัน
COPY package*.json ./
RUN npm ci

# คัดลอกโค้ดทั้งหมด
COPY . .

# สร้าง Prisma Client
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]