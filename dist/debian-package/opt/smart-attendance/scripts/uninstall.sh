#!/bin/bash
# ============================================
# SMART ATTENDANCE - DÉSINSTALLATION LINUX
# ============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "============================================"
echo "   SMART ATTENDANCE - DÉSINSTALLATION"
echo "============================================"
echo -e "${NC}"

# Vérifier root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Ce script doit être exécuté en tant que root (sudo)${NC}"
    echo "   Utilisez : sudo $0"
    exit 1
fi

INSTALL_DIR="/opt/smart-attendance"
SERVICE_NAME="smart-attendance"
DB_NAME="smart_attendance_db"
SERVICE_USER="smartattendance"

echo ""
echo -e "${YELLOW}⚠️  ATTENTION${NC}"
echo "Ce script va :"
echo "  1. Arrêter le service Smart Attendance"
echo "  2. Supprimer le service systemd"
echo "  3. Supprimer les fichiers de l'application"
echo "  4. Supprimer l'utilisateur système"
echo ""
echo -e "${YELLOW}⚠️  La base de données PostgreSQL sera CONSERVÉE${NC}"
echo "   (pour ne pas perdre vos données)"
echo ""
read -p "Confirmer la désinstallation ? (o/N) : " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo "Désinstallation annulée."
    exit 0
fi

# ═══════════════════════════════════════════
# 1. Arrêter et supprimer le service
# ═══════════════════════════════════════════
echo ""
echo -e "${YELLOW}[1/5] Arrêt du service...${NC}"

if systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
    systemctl stop $SERVICE_NAME
    echo -e "${GREEN}   ✅ Service arrêté${NC}"
else
    echo -e "${BLUE}   ℹ️  Service déjà arrêté${NC}"
fi

echo -e "${YELLOW}[2/5] Désactivation du service...${NC}"

if systemctl is-enabled --quiet $SERVICE_NAME 2>/dev/null; then
    systemctl disable $SERVICE_NAME
    echo -e "${GREEN}   ✅ Service désactivé${NC}"
else
    echo -e "${BLUE}   ℹ️  Service déjà désactivé${NC}"
fi

# Supprimer le fichier systemd
if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
    rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
    echo -e "${GREEN}   ✅ Fichier service supprimé${NC}"
fi

# ═══════════════════════════════════════════
# 2. Sauvegarder les données utilisateur
# ═══════════════════════════════════════════
echo -e "${YELLOW}[3/5] Sauvegarde des données utilisateur...${NC}"

BACKUP_DIR="/tmp/smart-attendance-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

if [ -d "$INSTALL_DIR/backend/uploads" ]; then
    cp -r "$INSTALL_DIR/backend/uploads" "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}   ✅ Uploads sauvegardés : $BACKUP_DIR/uploads${NC}"
fi

if [ -f "$INSTALL_DIR/backend/.env" ]; then
    cp "$INSTALL_DIR/backend/.env" "$BACKUP_DIR/.env.backup"
    echo -e "${GREEN}   ✅ Config sauvegardée : $BACKUP_DIR/.env.backup${NC}"
fi

if [ -f "$INSTALL_DIR/backend/license.dat" ]; then
    cp "$INSTALL_DIR/backend/license.dat" "$BACKUP_DIR/license.dat"
    echo -e "${GREEN}   ✅ Licence sauvegardée${NC}"
fi

# ═══════════════════════════════════════════
# 3. Supprimer les fichiers de l'application
# ═══════════════════════════════════════════
echo -e "${YELLOW}[4/5] Suppression des fichiers...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}   ✅ Dossier $INSTALL_DIR supprimé${NC}"
fi

# ═══════════════════════════════════════════
# 4. Supprimer l'utilisateur système
# ═══════════════════════════════════════════
echo -e "${YELLOW}[5/5] Suppression de l'utilisateur système...${NC}"

if id "$SERVICE_USER" &>/dev/null; then
    userdel "$SERVICE_USER" 2>/dev/null || true
    echo -e "${GREEN}   ✅ Utilisateur $SERVICE_USER supprimé${NC}"
else
    echo -e "${BLUE}   ℹ️  Utilisateur déjà supprimé${NC}"
fi

# ═══════════════════════════════════════════
# 5. Supprimer la règle firewall
# ═══════════════════════════════════════════
if command -v ufw &> /dev/null; then
    ufw delete allow 5000/tcp 2>/dev/null || true
    echo -e "${GREEN}   ✅ Règle firewall supprimée${NC}"
fi

# ═══════════════════════════════════════════
# FIN
# ═══════════════════════════════════════════
echo ""
echo -e "${GREEN}"
echo "============================================"
echo "   ✅ DÉSINSTALLATION TERMINÉE"
echo "============================================"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}📁 Sauvegarde des données :${NC}"
echo "   $BACKUP_DIR"
echo ""
echo -e "${YELLOW}💡 La base de données PostgreSQL est CONSERVÉE :${NC}"
echo "   Nom    : $DB_NAME"
echo "   User   : postgres"
echo ""
echo "   Pour la supprimer manuellement :"
echo "   sudo -u postgres psql -c \"DROP DATABASE $DB_NAME;\""
echo ""
echo -e "${YELLOW}💡 Pour supprimer PostgreSQL complètement :${NC}"
echo "   sudo apt remove --purge postgresql postgresql-*"
echo ""