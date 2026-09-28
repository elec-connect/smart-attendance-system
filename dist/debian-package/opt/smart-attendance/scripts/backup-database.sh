#!/bin/bash
# ============================================
# SMART ATTENDANCE - SAUVEGARDE DE LA BASE
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-attendance"
BACKEND_DIR="$INSTALL_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
BACKUP_DIR="$BACKEND_DIR/backups"

# Vérifier root (nécessaire pour lire .env avec permissions)
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Ce script doit être exécuté en root pour accéder à la config${NC}"
    echo "   Utilisez : sudo $0"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Fichier .env introuvable : $ENV_FILE${NC}"
    exit 1
fi

# Lire la config
DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d '=' -f2-)
DB_HOST=$(grep "^DB_HOST=" "$ENV_FILE" | cut -d '=' -f2- || echo "localhost")
DB_PORT=$(grep "^DB_PORT=" "$ENV_FILE" | cut -d '=' -f2- || echo "5432")

# Créer le dossier backups
mkdir -p "$BACKUP_DIR"

# Nom du fichier avec date
DATE_STR=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/smart_attendance_$DATE_STR.backup"

echo -e "${CYAN}"
echo "============================================"
echo "   SAUVEGARDE BASE DE DONNÉES"
echo "============================================"
echo -e "${NC}"
echo ""
echo "📁 Base de données : $DB_NAME"
echo "📁 Destination     : $BACKUP_FILE"
echo "⏳ Sauvegarde en cours..."
echo ""

# Sauvegarder
export PGPASSWORD="$DB_PASSWORD"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Sauvegarde réussie !${NC}"
    echo "   Fichier : $BACKUP_FILE"
    echo "   Taille  : $SIZE"
else
    echo -e "${RED}❌ Erreur lors de la sauvegarde${NC}"
    exit 1
fi

# Nettoyage : garder les 10 dernières
echo ""
echo "🧹 Nettoyage (garde les 10 dernières)..."
cd "$BACKUP_DIR"
ls -t *.backup 2>/dev/null | tail -n +11 | while read -r file; do
    rm -f "$file"
    echo "   Supprimé : $file"
done

echo ""
echo -e "${GREEN}✅ Terminé !${NC}"