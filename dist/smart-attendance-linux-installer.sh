#!/bin/bash
# ============================================
# SMART ATTENDANCE - INSTALLATEUR LINUX
# Généré automatiquement le $(date)
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "============================================"
echo "   SMART ATTENDANCE SYSTEM - INSTALLATION"
echo "                LINUX"
echo "============================================"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Variables
INSTALL_DIR="/opt/smart-attendance"
BACKEND_DIR="$INSTALL_DIR/backend"
SCRIPTS_DIR="$INSTALL_DIR/scripts"
SERVICE_USER="smartattendance"
DB_NAME="smart_attendance_db"
DB_USER="postgres"
DB_PASSWORD="Haouala18"
PORT="5000"

# Vérification root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Veuillez exécuter en tant que root (sudo)${NC}"
    exit 1
fi

# ============================================
# DÉPENDANCES
# ============================================
echo -e "${YELLOW}📦 Installation des dépendances système...${NC}"
apt-get update
apt-get install -y curl wget gnupg ca-certificates tar rsync

echo -e "${YELLOW}📦 Installation Node.js 18...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo -e "${YELLOW}📦 Installation PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl start postgresql
systemctl enable postgresql

# ============================================
# UTILISATEUR DÉDIÉ
# ============================================
echo -e "${YELLOW}👤 Création de l'utilisateur système dédié...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false -d $INSTALL_DIR $SERVICE_USER
fi

# ============================================
# DOSSIERS
# ============================================
echo -e "${YELLOW}📁 Création des dossiers...${NC}"
mkdir -p $BACKEND_DIR $SCRIPTS_DIR
mkdir -p $BACKEND_DIR/logs $BACKEND_DIR/uploads $BACKEND_DIR/temp_images $BACKEND_DIR/backups

# ============================================
# COPIE DES FICHIERS
# ============================================
echo -e "${YELLOW}📋 Copie des fichiers backend...${NC}"

if [ -f "$SCRIPT_DIR/backend.tar.gz" ]; then
    tar -xzf "$SCRIPT_DIR/backend.tar.gz" -C $BACKEND_DIR
    echo -e "${GREEN}✅ Archive extraite${NC}"
elif [ -d "$SCRIPT_DIR/../backend" ]; then
    cp -r $SCRIPT_DIR/../backend/* $BACKEND_DIR/ 2>/dev/null || true
    rm -rf $BACKEND_DIR/node_modules 2>/dev/null || true
    echo -e "${GREEN}✅ Dossier backend copié${NC}"
else
    echo -e "${RED}❌ Aucun backend trouvé (ni backend.tar.gz ni ../backend)${NC}"
    exit 1
fi

# Copier les scripts Linux additionnels
echo -e "${YELLOW}📋 Copie des scripts de maintenance...${NC}"
for script in uninstall.sh check-service.sh backup-database.sh restore-database.sh update.sh; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
        cp "$SCRIPT_DIR/$script" "$SCRIPTS_DIR/$script"
        chmod +x "$SCRIPTS_DIR/$script"
        echo -e "${GREEN}   ✅ $script${NC}"
    fi
done

# Copier les scripts depuis installer/scripts (ancien format)
if [ -d "$SCRIPT_DIR/../installer/scripts" ]; then
    cp -r $SCRIPT_DIR/../installer/scripts/* $SCRIPTS_DIR/ 2>/dev/null || true
    rm -f $SCRIPTS_DIR/*.bat 2>/dev/null || true
fi

# Copier la documentation
echo -e "${YELLOW}📋 Copie de la documentation...${NC}"
mkdir -p "$INSTALL_DIR/docs"
for doc in README_LINUX.txt GUIDE_POSTGRESQL_LINUX.txt; do
    if [ -f "$SCRIPT_DIR/$doc" ]; then
        cp "$SCRIPT_DIR/$doc" "$INSTALL_DIR/docs/$doc"
        echo -e "${GREEN}   ✅ $doc${NC}"
    fi
done

# ============================================
# FICHIER .env
# ============================================
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/backend.env" ]; then
        cp "$SCRIPT_DIR/backend.env" "$BACKEND_DIR/.env"
        echo -e "${GREEN}✅ .env copié depuis backend.env${NC}"
    elif [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        
        # Remplacer le mot de passe DB par celui de l'installation
        sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" "$BACKEND_DIR/.env"
        
        # Générer les clés JWT et ENCRYPTION
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
        JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
        ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        
        # Ajouter les variables
        echo "" >> "$BACKEND_DIR/.env"
        echo "# Auto-généré par l'installateur" >> "$BACKEND_DIR/.env"
        echo "JWT_SECRET=$JWT_SECRET" >> "$BACKEND_DIR/.env"
        echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> "$BACKEND_DIR/.env"
        echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$BACKEND_DIR/.env"
        
        echo -e "${GREEN}✅ .env créé depuis .env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  Aucun modèle .env trouvé${NC}"
    fi
fi

# ============================================
# INSTALLATION NPM
# ============================================
echo -e "${YELLOW}📦 Installation des dépendances Node.js...${NC}"
cd $BACKEND_DIR
if [ -f package.json ]; then
    npm install --production || { echo -e "${RED}❌ npm install a échoué${NC}"; exit 1; }
else
    echo -e "${RED}❌ package.json introuvable dans $BACKEND_DIR${NC}"
    exit 1
fi

# ============================================
# BASE DE DONNÉES
# ============================================
echo -e "${YELLOW}🗄️ Configuration de la base de données...${NC}"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD'"

sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER"
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""

if [ -f "$SCRIPTS_DIR/install-postgres.sql" ]; then
    echo -e "${YELLOW}📋 Initialisation des tables...${NC}"
    sudo -u postgres psql -d $DB_NAME -f "$SCRIPTS_DIR/install-postgres.sql"
fi

# ============================================
# PERMISSIONS
# ============================================
echo -e "${YELLOW}🔐 Configuration des permissions...${NC}"
chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
chmod -R 750 $BACKEND_DIR
chmod -R 770 $BACKEND_DIR/logs $BACKEND_DIR/uploads $BACKEND_DIR/temp_images $BACKEND_DIR/backups
chmod 600 $BACKEND_DIR/.env 2>/dev/null || true
chmod +x $SCRIPTS_DIR/*.sh 2>/dev/null || true

# ============================================
# SERVICE SYSTEMD
# ============================================
echo -e "${YELLOW}🛠️ Création du service systemd...${NC}"
cat > /etc/systemd/system/smart-attendance.service << SERVICEEOF
[Unit]
Description=Smart Attendance Backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node $BACKEND_DIR/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
NoNewPrivileges=true
PrivateTmp=true

StandardOutput=append:$BACKEND_DIR/logs/access.log
StandardError=append:$BACKEND_DIR/logs/error.log

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable smart-attendance
systemctl start smart-attendance

# ============================================
# FIREWALL
# ============================================
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}🔥 Configuration du firewall...${NC}"
    ufw allow $PORT/tcp 2>/dev/null || true
fi

# ============================================
# FIN
# ============================================
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}"
echo "============================================"
echo "         INSTALLATION TERMINÉE !"
echo "============================================"
echo -e "${NC}"
echo "📡 Backend: http://$LOCAL_IP:$PORT"
echo "🔧 API: http://$LOCAL_IP:$PORT/api"
echo "📊 Santé: http://$LOCAL_IP:$PORT/api/health"
echo ""
echo "📁 Documentation : $INSTALL_DIR/docs/"
echo "📋 Scripts : $SCRIPTS_DIR/"
echo ""
echo "📋 Commandes utiles:"
echo "   sudo systemctl status smart-attendance"
echo "   sudo journalctl -u smart-attendance -f"
echo "   sudo systemctl restart smart-attendance"
echo "   sudo $SCRIPTS_DIR/check-service.sh"
echo ""
echo "============================================"
