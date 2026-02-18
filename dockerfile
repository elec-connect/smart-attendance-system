# Dockerfile
# Utiliser une image Node.js complète (pas alpine) car canvas et sharp ont besoin de compilateurs
FROM node:18-bullseye

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libx11-dev \
    libxt-dev \
    libxext-dev \
    libxrender-dev \
    libxcb1-dev \
    libx11-xcb-dev \
    libxcb-util1 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-shape0 \
    libxcb-sync1 \
    libxcb-xfixes0 \
    libxcb-xinerama0 \
    libxcb-xkb1 \
    libxkbcommon-x11-0 \
    libxkbcommon0 \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    libgles2-mesa \
    libsm6 \
    libice6 \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances (pour optimiser le cache Docker)
COPY backend/package*.json ./

# Installer les dépendances Node.js
RUN npm ci --only=production

# Copier tout le code source du backend
COPY backend/ ./

# Créer les dossiers nécessaires
RUN mkdir -p faces uploads temp_images logs

# Exposer le port
EXPOSE 5000

# Variable d'environnement
ENV NODE_ENV=production

# Démarrer l'application
CMD ["node", "server.js"]