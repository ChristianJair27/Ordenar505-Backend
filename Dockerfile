FROM node:20-bookworm-slim

# Instala dependencias críticas
RUN apt-get update && apt-get install -y openssl tzdata && rm -rf /var/lib/apt/lists/*
ENV TZ=America/Mexico_City
ENV NODE_ENV=production
ENV PORT=80

WORKDIR /app

# Instala dependencias (incluye devDependencies para Prisma)
COPY package*.json ./
RUN npm ci  # ¡No uses --omit=dev si necesitas Prisma!

COPY . .

# Genera assets de Prisma (si lo usas)
RUN npx prisma generate

EXPOSE 80

# Usa node directamente (evita npm start para mejor manejo de memoria)
CMD ["node", "--max-old-space-size=1024", "app.js"]
