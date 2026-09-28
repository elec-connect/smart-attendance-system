============================================================
   SMART ATTENDANCE SYSTEM - GUIDE D'INSTALLATION
============================================================

Version : 2.0.0
Date    : 27 Septembre 2026
Site    : https://entreprise-1.smart-haouala.com

============================================================
   1. CONTENU DE L'INSTALLATION
============================================================

Cet installateur va installer automatiquement :

  ✅ PostgreSQL 18    - Base de données
  ✅ pgAdmin 4        - Interface d'administration de la base
  ✅ Node.js 18       - Runtime JavaScript
  ✅ Smart Attendance - Application de gestion des présences
  ✅ Service Windows  - Démarrage automatique

============================================================
   2. PRÉREQUIS
============================================================

  • Windows 10 / 11 (64 bits)
  • 4 Go de RAM minimum (8 Go recommandé)
  • 5 Go d'espace disque libre
  • Droits administrateur
  • Connexion Internet (pour l'installation initiale)

============================================================
   3. INSTALLATION RAPIDE (5 ÉTAPES)
============================================================

ÉTAPE 1 : Lancer l'installateur
  • Double-cliquez sur SmartAttendance_Setup_v2.0.0.exe
  • Acceptez la demande d'élévation (UAC)
  • Suivez l'assistant

ÉTAPE 2 : Choisir le dossier
  • Par défaut : C:\Program Files\SmartAttendanceServer
  • Recommandation : gardez le chemin par défaut

ÉTAPE 3 : Mot de passe PostgreSQL
  • Choisissez un mot de passe sécurisé (min 8 caractères)
  • ⚠️  NOTEZ-LE PRÉCIEUSEMENT
  • Il sera affiché à la fin sur le bureau

ÉTAPE 4 : Compte administrateur
  • Entrez l'email admin (ex: admin@votre-entreprise.com)
  • Choisissez un mot de passe (min 6 caractères)
  • Ces identifiants serviront à vous connecter à l'application

ÉTAPE 5 : Attendre la fin de l'installation (5-15 minutes)
  • Installation PostgreSQL (~2 min)
  • Installation pgAdmin (~1 min)
  • Installation Node.js (~1 min)
  • npm install (5-10 min selon connexion)
  • Création base de données + tables (~30 sec)
  • Configuration service Windows (~10 sec)

  ✨ À la fin, un fichier IDENTIFIANTS_ADMIN.txt apparaîtra
     sur votre bureau avec tous les identifiants.

============================================================
   4. APRÈS L'INSTALLATION
============================================================

  • L'application démarre automatiquement
  • L'interface web s'ouvre : http://localhost:5173
  • Connectez-vous avec l'email et mot de passe admin

  Raccourcis créés :
  • Bureau : Smart Attendance
  • Menu Démarrer : Smart Attendance
  • Menu Démarrer : Ouvrir pgAdmin
  • Menu Démarrer : Lire le guide (README)
  • Menu Démarrer : Guide PostgreSQL

============================================================
   5. DÉPANNAGE RAPIDE
============================================================

PROBLÈME : L'application ne démarre pas
SOLUTION :
  1. Ouvrir "Services" (services.msc)
  2. Chercher "Smart Attendance Server"
  3. Vérifier qu'il est en "En cours d'exécution"
  4. Sinon : Clic droit → Démarrer

PROBLÈME : Page blanche dans le navigateur
SOLUTION :
  1. Attendre 30 secondes (le service démarre)
  2. Rafraîchir la page (F5)
  3. Vérifier que le port 5000 est libre

PROBLÈME : Base de données inaccessible
SOLUTION :
  1. Ouvrir pgAdmin 4
  2. Se connecter avec :
     - Host : localhost
     - Port : 5432
     - User : postgres
     - Mot de passe : (celui de l'installation)
  3. Vérifier que la base smart_attendance_db existe

PROBLÈME : Erreur "port 5000 déjà utilisé"
SOLUTION :
  1. Ouvrir le terminal (cmd)
  2. Taper : netstat -ano | findstr :5000
  3. Noter le PID et tuer le processus :
     taskkill /PID [PID] /F
  4. Redémarrer le service Smart Attendance

============================================================
   6. LOGS ET DIAGNOSTIC
============================================================

  Logs du service :
    C:\Program Files\SmartAttendanceServer\backend\logs\service.log
    C:\Program Files\SmartAttendanceServer\backend\logs\service-error.log

  Logs npm install :
    C:\Program Files\SmartAttendanceServer\backend\npm-install.log

  Logs PostgreSQL :
    C:\Program Files\PostgreSQL\18\data\log\

  Logs pgAdmin :
    C:\Users\[VotreNom]\AppData\Roaming\pgAdmin\pgadmin4.log

============================================================
   7. DÉSINSTALLATION
============================================================

  Pour désinstaller :
  
  1. Panneau de configuration → Programmes → Désinstaller
  2. Chercher "Smart Attendance System"
  3. Cliquer sur "Désinstaller"
  
  ⚠️  PostgreSQL et pgAdmin NE seront PAS désinstallés
     (car ils peuvent être utilisés par d'autres applications).
  
  Pour les désinstaller manuellement :
  • Panneau de configuration → Désinstaller un programme
  • Chercher "PostgreSQL" et "pgAdmin"

  ⚠️  VOS DONNÉES sont conservées dans PostgreSQL
     (base smart_attendance_db). Sauvegardez-les avant de désinstaller.

============================================================
   8. SUPPORT
============================================================

  Site web : https://entreprise-1.smart-haouala.com
  Email    : iot.sahnoun@gmail.com
  Téléphone: +216 29 328 870

============================================================
   GARDEZ CE FICHIER - IL CONTIENT TOUTES LES INFOS UTILES
============================================================