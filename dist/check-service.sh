#!/bin/bash
# ============================================
# SMART ATTENDANCE - DIAGNOSTIC COMPLET
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-attendance"
BACKEND_DIR="$INSTALL_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
SERVICE_NAME="smart-attendance"

echo -e "${CYAN}"
echo "============================================"
echo "   DIAGNOSTIC SMART ATTENDANCE"
echo "============================================"
echo -e "${NC}"

ERRORS=0
WARNINGS=0

# ═══════════════════════════════════════════
# 1. Installation
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[1/8] Vérification de l'installation...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${GREEN}   ✅ Dossier : $INSTALL_DIR${NC}"
else
    echo -e "${RED}   ❌ Dossier $INSTALL_DIR MANQUANT${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "$BACKEND_DIR/server.js" ]; then
    echo -e "${GREEN}   ✅ server.js présent${NC}"
else
    echo -e "${RED}   ❌ server.js MANQUANT${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}   ✅ .env présent${NC}"
else
    echo -e "${RED}   ❌ .env MANQUANT${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ═══════════════════════════════════════════
# 2. Node.js
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[2/8] Vérification de Node.js...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}   ✅ Node.js : $NODE_VERSION${NC}"
else
    echo -e "${RED}   ❌ Node.js NON INSTALLÉ${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "$BACKEND_DIR/node_modules" ]; then
    MOD_COUNT=$(ls -1 "$BACKEND_DIR/node_modules" 2>/dev/null | wc -l)
    echo -e "${GREEN}   ✅ node_modules : $MOD_COUNT modules${NC}"
else
    echo -e "${RED}   ❌ node_modules MANQUANT${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ═══════════════════════════════════════════
# 3. PostgreSQL
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[3/8] Vérification de PostgreSQL...${NC}"

if systemctl is-active --quiet postgresql 2>/dev/null; then
    echo -e "${GREEN}   ✅ Service PostgreSQL actif${NC}"
else
    echo -e "${RED}   ❌ Service PostgreSQL arrêté${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}   ✅ psql : $PG_VERSION${NC}"
else
    echo -e "${RED}   ❌ psql NON INSTALLÉ${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ═══════════════════════════════════════════
# 4. Base de données
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[4/8] Vérification de la base de données...${NC}"

if [ -f "$ENV_FILE" ]; then
    DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d '=' -f2-)
    DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d '=' -f2-)
    DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d '=' -f2-)
    
    if PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}   ✅ Connexion à la base OK${NC}"
        
        TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)
        echo -e "${GREEN}   ✅ Tables : $TABLES${NC}"
        
        EMPLOYEES=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM employees;" 2>/dev/null | xargs)
        echo -e "${GREEN}   ✅ Employés : $EMPLOYEES${NC}"
    else
        echo -e "${RED}   ❌ Connexion à la base ÉCHOUÉE${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# ═══════════════════════════════════════════
# 5. Service systemd
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[5/8] Vérification du service systemd...${NC}"

if systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    echo -e "${GREEN}   ✅ Service $SERVICE_NAME installé${NC}"
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}   ✅ Service EN COURS${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Service ARRÊTÉ${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}   ❌ Service NON INSTALLÉ${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ═══════════════════════════════════════════
# 6. Port 5000
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[6/8] Vérification du port 5000...${NC}"

if ss -tuln 2>/dev/null | grep -q ":5000 " || netstat -tuln 2>/dev/null | grep -q ":5000 "; then
    echo -e "${GREEN}   ✅ Port 5000 en écoute${NC}"
else
    echo -e "${RED}   ❌ Port 5000 NON EN ÉCOUTE${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ═══════════════════════════════════════════
# 7. Test API
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[7/8] Test de l'API...${NC}"

if command -v curl &> /dev/null; then
    API_RESPONSE=$(curl -s -m 5 http://localhost:5000/api/ping 2>/dev/null)
    if [ -n "$API_RESPONSE" ]; then
        echo -e "${GREEN}   ✅ API répond${NC}"
        echo -e "${CYAN}      $API_RESPONSE${NC}"
    else
        echo -e "${RED}   ❌ API ne répond pas${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}   ⚠️  curl non installé${NC}"
fi

# ═══════════════════════════════════════════
# 8. IP réseau
# ═══════════════════════════════════════════
echo ""
echo -e "${BLUE}[8/8] Informations réseau...${NC}"

LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}   ✅ IP locale : $LOCAL_IP${NC}"

if command -v ufw &> /dev/null; then
    if ufw status | grep -q "5000/tcp.*ALLOW"; then
        echo -e "${GREEN}   ✅ Firewall : port 5000 autorisé${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Firewall : port 5000 non autorisé${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# ═══════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}"
echo "============================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}   ✅ SYSTÈME FONCTIONNEL${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}   ⚠️  $WARNINGS AVERTISSEMENT(S)${NC}"
else
    echo -e "${RED}   ❌ $ERRORS ERREUR(S) / $WARNINGS AVERTISSEMENT(S)${NC}"
fi
echo -e "${CYAN}============================================${NC}"
echo ""

# URL d'accès
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}📡 Accès à l'application :${NC}"
    echo "   Local  : http://localhost:5000"
    echo "   Réseau : http://$LOCAL_IP:5000"
    echo ""
fi

exit $ERRORS