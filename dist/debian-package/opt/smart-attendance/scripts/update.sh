#!/bin/bash
# ============================================
# SMART ATTENDANCE - MISE À JOUR
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-attendance"
BACKEND_DIR="$INSTALL_DIR/backend"
BACKUP_DIR="$INSTALL_DIR/backups"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en root${NC}"
    exit 1
fi

echo -e "${CYAN}"
echo "============================================"
echo "   MISE À JOUR SMART ATTENDANCE"
echo "============================================"
echo -e "${NC}"
echo ""

# Vérifier arguments
if [ -z "$1" ]; then
    echo "Usage : sudo $0 <fichier_backend.tar.gz>"
    echo ""
    echo "Exemple :"
    echo "  sudo $0 backend-v2.1.0.tar.gz"
    exit 1
fi

UPDATE_FILE="$1"

if [ ! -f "$UPDATE_FILE" ]; then
    echo -e "${RED}❌ Fichier introuvable : $UPDATE_FILE${NC}"
    exit 1
fi

echo "📦 Fichier de mise à jour : $UPDATE_FILE"
echo ""

# ═══════════════════════════════════════════
# 1. Sauvegarde de sécurité
# ═══════════════════════════════════════════
echo -e "${YELLOW}[1/5] Sauvegarde de l'installation actuelle...${NC}"

mkdir -p "$BACKUP_DIR"
BACKUP_DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_ARCHIVE="$BACKUP_DIR/backend_before_update_$BACKUP_DATE.tar.gz"

tar -czf "$BACKUP_ARCHIVE" -C "$BACKEND_DIR" --exclude=node_modules --exclude=logs --exclude=uploads . 2>/dev/null || true
echo -e "${GREEN}   ✅ $BACKUP_ARCHIVE${NC}"

# ═══════════════════════════════════════════
# 2. Arrêt du service
# ═══════════════════════════════════════════
echo ""
echo -e "${YELLOW}[2/5] Arrêt du service...${NC}"
systemctl stop smart-attendance
echo -e "${GREEN}   ✅ Service arrêté${NC}"

# ═══════════════════════════════════════════
# 3. Extraction de la mise à jour
# ═══════════════════════════════════════════
echo ""
echo -e "${YELLOW}[3/5] Extraction de la mise à jour...${NC}"

# Créer un dossier temporaire
TMP_DIR=$(mktemp -d)
tar -xzf "$UPDATE_FILE" -C "$TMP_DIR"
echo -e "${GREEN}   ✅ Extrait dans $TMP_DIR${NC}"

# ═══════════════════════════════════════════
# 4. Copie des fichiers (en préservant .env, uploads, license)
# ═══════════════════════════════════════════
echo ""
echo -e "${YELLOW}[4/5] Mise à jour des fichiers...${NC}"

# Sauvegarder les fichiers critiques
ENV_BAK=$(mktemp)
UPLOADS_BAK=$(mktemp -d)
if [ -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env" "$ENV_BAK"
fi
if [ -d "$BACKEND_DIR/uploads" ]; then
    cp -r "$BACKEND_DIR/uploads" "$UPLOADS_BAK/" 2>/dev/null || true
fi

# Copier les nouveaux fichiers
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='logs' \
    --exclude='uploads' \
    --exclude='backups' \
    --exclude='licences' \
    --exclude='license.dat' \
    --exclude='.trial' \
    "$TMP_DIR/" "$BACKEND_DIR/" > /dev/null

# Restaurer les fichiers critiques
cp "$ENV_BAK" "$BACKEND_DIR/.env"
if [ -d "$UPLOADS_BAK/uploads" ]; then
    cp -r "$UPLOADS_BAK/uploads/"* "$BACKEND_DIR/uploads/" 2>/dev/null || true
fi

# Restaurer la licence si elle existait
if [ -f "$BACKUP_DIR/license.dat" ]; then
    cp "$BACKUP_DIR/license.dat" "$BACKEND_DIR/license.dat"
fi

echo -e "${GREEN}   ✅ Fichiers mis à jour${NC}"

# ═══════════════════════════════════════════
# 5. Réinstallation des dépendances + redémarrage
# ═══════════════════════════════════════════
echo ""
echo -e "${YELLOW}[5/5] Installation des dépendances...${NC}"

cd "$BACKEND_DIR"
npm install --production --no-audit --no-fund > /dev/null 2>&1
echo -e "${GREEN}   ✅ Dépendances installées${NC}"

# Permissions
chown -R smartattendance:smartattendance "$INSTALL_DIR"
chmod -R 750 "$BACKEND_DIR"

# Redémarrer
systemctl start smart-attendance
sleep 3

# Nettoyage
rm -rf "$TMP_DIR"
rm -f "$ENV_BAK"
rm -rf "$UPLOADS_BAK"

# ═══════════════════════════════════════════
# Vérification
# ═══════════════════════════════════════════
echo ""
if systemctl is-active --quiet smart-attendance; then
    echo -e "${GREEN}"
    echo "============================================"
    echo "   ✅ MISE À JOUR RÉUSSIE"
    echo "============================================"
    echo -e "${NC}"
    echo ""
    echo "📡 L'application tourne toujours sur : http://localhost:5000"
else
    echo -e "${RED}"
    echo "============================================"
    echo "   ❌ ÉCHEC DU DÉMARRAGE"
    echo "============================================"
    echo -e "${NC}"
    echo ""
    echo "Restaurez depuis : $BACKUP_ARCHIVE"
    echo "  sudo tar -xzf $BACKUP_ARCHIVE -C $BACKEND_DIR"
    echo "  sudo systemctl restart smart-attendance"
    exit 1
fi