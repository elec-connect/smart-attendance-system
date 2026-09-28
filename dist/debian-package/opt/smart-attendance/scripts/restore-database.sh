#!/bin/bash
# ============================================
# SMART ATTENDANCE - RESTAURATION
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-attendance"
BACKEND_DIR="$INSTALL_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
BACKUP_DIR="$BACKEND_DIR/backups"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en root${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

# Lire la config
DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d '=' -f2-)

# Lister les sauvegardes
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.backup 2>/dev/null)" ]; then
    echo -e "${RED}❌ Aucune sauvegarde trouvée dans : $BACKUP_DIR${NC}"
    exit 1
fi

echo -e "${CYAN}"
echo "============================================"
echo "   RESTAURATION BASE DE DONNÉES"
echo "============================================"
echo -e "${NC}"
echo ""
echo "Sauvegardes disponibles :"
echo ""

i=0
declare -a FILES
for file in $(ls -t $BACKUP_DIR/*.backup); do
    i=$((i+1))
    FILES[$i]="$file"
    SIZE=$(du -h "$file" | cut -f1)
    DATE=$(stat -c %y "$file" | cut -d'.' -f1)
    echo "   [$i] $(basename $file) — $SIZE — $DATE"
done

echo ""
read -p "Numéro de la sauvegarde à restaurer : " CHOICE

if [ -z "${FILES[$CHOICE]}" ]; then
    echo -e "${RED}❌ Choix invalide${NC}"
    exit 1
fi

SELECTED="${FILES[$CHOICE]}"

echo ""
echo -e "${YELLOW}⚠️  ATTENTION : La base actuelle sera ÉCRASÉE${NC}"
echo "   Fichier : $SELECTED"
echo ""
read -p "Confirmer ? (o/N) : " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo "Annulé."
    exit 0
fi

# Sauvegarde de sécurité
echo ""
echo "💾 Sauvegarde de sécurité avant restauration..."
SAFETY="$BACKUP_DIR/before_restore_$(date +%Y-%m-%d_%H-%M).backup"
export PGPASSWORD="$DB_PASSWORD"
pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -f "$SAFETY" 2>/dev/null || true
echo -e "${GREEN}   ✅ $SAFETY${NC}"

# Restaurer
echo ""
echo "⏳ Restauration en cours..."
pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$SELECTED" 2>/dev/null || true

echo ""
echo "🔄 Redémarrage du service..."
systemctl restart smart-attendance

echo ""
echo -e "${GREEN}✅ Restauration terminée !${NC}"