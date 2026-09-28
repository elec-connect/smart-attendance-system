============================================================
   SMART ATTENDANCE - GUIDE D'INSTALLATION LINUX
============================================================

Version : 2.0.0
Site    : https://Elec-connect.tn

============================================================
   1. PRÉREQUIS
============================================================

  • Distribution : Ubuntu 20.04+ / Debian 11+ / Mint 20+
  • RAM          : 4 GB minimum (8 GB recommandé)
  • Disque       : 5 GB d'espace libre
  • Accès root   : sudo
  • Internet     : pour l'installation initiale

============================================================
   2. FICHIERS FOURNIS
============================================================

  📦 smart-attendance-linux-installer.sh   ← Script principal
  📦 backend.tar.gz                        ← Code de l'application
  📦 smart-attendance_2.0.0_amd64.deb      ← Package Debian (optionnel)

============================================================
   3. INSTALLATION RAPIDE
============================================================

Méthode 1 : SCRIPT (toutes distributions)
─────────────────────────────────────────

  1. Copier les fichiers sur le serveur :
     scp smart-attendance-linux-installer.sh backend.tar.gz user@serveur:/tmp/

  2. Se connecter en SSH :
     ssh user@serveur

  3. Rendre exécutable et lancer :
     cd /tmp
     chmod +x smart-attendance-linux-installer.sh
     sudo ./smart-attendance-linux-installer.sh

  4. Attendre 5-10 minutes (installation automatique)

Méthode 2 : PACKAGE DEBIAN (Ubuntu/Debian)
──────────────────────────────────────────

  1. Copier le .deb :
     scp smart-attendance_2.0.0_amd64.deb user@serveur:/tmp/

  2. Installer :
     cd /tmp
     sudo dpkg -i smart-attendance_2.0.0_amd64.deb
     sudo apt-get install -f  # Corriger dépendances si besoin

============================================================
   4. APRÈS L'INSTALLATION
============================================================

L'application est installée dans :
  /opt/smart-attendance/

Le service systemd est actif :
  sudo systemctl status smart-attendance

Accès à l'application :
  Local  : http://localhost:5000
  Réseau : http://[IP_SERVEUR]:5000

Pour trouver l'IP du serveur :
  hostname -I

============================================================
   5. CRÉATION DE L'ADMINISTRATEUR
============================================================

Si l'installeur n'a pas créé l'admin automatiquement :
  sudo /opt/smart-attendance/scripts/create-admin.sh

Vous devrez saisir :
  • Email admin
  • Mot de passe (min 6 caractères)

============================================================
   6. COMMANDES UTILES
============================================================

  # Voir le statut du service
  sudo systemctl status smart-attendance

  # Démarrer / Arrêter / Redémarrer
  sudo systemctl start smart-attendance
  sudo systemctl stop smart-attendance
  sudo systemctl restart smart-attendance

  # Voir les logs en direct
  sudo journalctl -u smart-attendance -f

  # Voir les derniers logs (100 lignes)
  sudo journalctl -u smart-attendance -n 100

  # Voir les logs d'erreur
  sudo tail -f /opt/smart-attendance/backend/logs/error.log

  # Diagnostic complet
  sudo /opt/smart-attendance/scripts/check-service.sh

============================================================
   7. BASE DE DONNÉES POSTGRESQL
============================================================

Connexion à la base :
  sudo -u postgres psql

Voir les bases :
  \l

Se connecter à smart_attendance_db :
  \c smart_attendance_db

Voir les tables :
  \dt

Voir les employés :
  SELECT * FROM employees;

Quitter :
  \q

Configuration pgAdmin4 (interface web) :
  sudo apt install pgadmin4 -y
  # Puis ouvrir http://localhost/pgadmin4

  OU installation classique :
  sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'votre_mdp';"

============================================================
   8. CONFIGURATION RÉSEAU
============================================================

Ouvrir le port 5000 dans le firewall :
  sudo ufw allow 5000/tcp
  sudo ufw reload

Vérifier :
  sudo ufw status

Modifier l'IP dans la config :
  sudo nano /opt/smart-attendance/backend/.env

Chercher les lignes :
  API_BASE_URL=http://[IP]:5000/api
  FRONTEND_URL=http://[IP]:5173

Puis redémarrer :
  sudo systemctl restart smart-attendance

============================================================
   9. SAUVEGARDE
============================================================

Sauvegarde manuelle :
  sudo /opt/smart-attendance/scripts/backup-database.sh

Sauvegardes automatiques (cron) :
  sudo crontab -e

  # Ajouter cette ligne pour une sauvegarde quotidienne à 2h
  0 2 * * * /opt/smart-attendance/scripts/backup-database.sh >> /var/log/smart-attendance-backup.log 2>&1

Restauration :
  sudo /opt/smart-attendance/scripts/restore-database.sh

============================================================
   10. MISE À JOUR
============================================================

  # Récupérer le nouveau backend.tar.gz
  scp backend-v2.1.0.tar.gz user@serveur:/tmp/

  # Lancer la mise à jour
  sudo /opt/smart-attendance/scripts/update.sh /tmp/backend-v2.1.0.tar.gz

  La mise à jour :
  • Sauvegarde automatiquement l'installation actuelle
  • Préserve .env, uploads, license.dat
  • Redémarre le service

============================================================
   11. DÉPANNAGE
============================================================

PROBLÈME : Service ne démarre pas
─────────────────────────────────
  # Voir les logs d'erreur
  sudo journalctl -u smart-attendance -n 50 --no-pager

  # Vérifier que le port 5000 est libre
  sudo ss -tuln | grep 5000

  # Tester manuellement
  sudo -u smartattendance node /opt/smart-attendance/backend/server.js

PROBLÈME : Base de données inaccessible
────────────────────────────────────────
  # Vérifier PostgreSQL
  sudo systemctl status postgresql

  # Tester la connexion
  sudo -u postgres psql -d smart_attendance_db -c "SELECT 1;"

  # Vérifier le mot de passe dans .env
  sudo grep "DB_PASSWORD" /opt/smart-attendance/backend/.env

PROBLÈME : Erreur de permissions
─────────────────────────────────
  # Réparer les permissions
  sudo chown -R smartattendance:smartattendance /opt/smart-attendance
  sudo chmod -R 750 /opt/smart-attendance/backend
  sudo systemctl restart smart-attendance

PROBLÈME : Port 5000 déjà utilisé
──────────────────────────────────
  # Trouver le processus
  sudo lsof -i :5000

  # Tuer le processus (remplacer PID)
  sudo kill -9 [PID]

  # Redémarrer
  sudo systemctl restart smart-attendance

============================================================
   12. DÉSINSTALLATION
============================================================

  sudo /opt/smart-attendance/scripts/uninstall.sh

⚠️  La base de données PostgreSQL est CONSERVÉE.
    Pour la supprimer :
    sudo -u postgres psql -c "DROP DATABASE smart_attendance_db;"

============================================================
   13. SUPPORT
============================================================

  Site  : https://Elec-connect.tn
  Email : iot.sahnoun@gmail.com
  Tél   : +216 29 328 870

============================================================