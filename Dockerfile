# Dockerfile
FROM node:22-bullseye

# Installer Python et les outils de build
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY backend/package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code backend
COPY backend/ ./

# Exposer le port
EXPOSE 5000

# Démarrer l'application
CMD ["node", "server.js"]