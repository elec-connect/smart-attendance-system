# SMART ATTENDANCE SYSTEM - DISTRIBUTION

## 📦 Fichiers générés

### 🪟 Windows
| Fichier | Description |
|---------|-------------|
| SmartAttendance_Setup_v2.0.0.exe | Installateur complet (~640 MB) |

### 🐧 Linux
| Fichier | Description |
|---------|-------------|
| smart-attendance-linux-installer.sh | Script d'installation principal |
| backend.tar.gz | Code de l'application |
| uninstall.sh | Désinstallation |
| check-service.sh | Diagnostic |
| backup-database.sh | Sauvegarde |
| restore-database.sh | Restauration |
| update.sh | Mise à jour |
| README_LINUX.txt | Guide d'installation Linux |
| GUIDE_POSTGRESQL_LINUX.txt | Guide PostgreSQL |
| SmartAttendance_Linux_v2.0.0_*.tar.gz | Archive complète Linux |

### 📦 Package Debian
| Fichier | Description |
|---------|-------------|
| debian-package/ | Sources du package .deb |

---

## 🪟 Installation Windows

1. Copier `SmartAttendance_Setup_v2.0.0.exe` sur le serveur
2. Double-cliquer et suivre l'assistant
3. Saisir :
   - Mot de passe PostgreSQL
   - Email + mot de passe admin
4. Attendre 15-25 minutes
5. `IDENTIFIANTS_SMART_ATTENDANCE.txt` est créé sur le bureau

---

## 🐧 Installation Linux

### Méthode 1 : Archive complète (recommandé)

```bash
# 1. Transférer l'archive
scp SmartAttendance_Linux_v2.0.0_*.tar.gz user@serveur:/tmp/

# 2. Extraire
ssh user@serveur
cd /tmp
tar -xzf SmartAttendance_Linux_v2.0.0_*.tar.gz
cd SmartAttendance_Linux_v2.0.0_*

# 3. Installer
chmod +x smart-attendance-linux-installer.sh
sudo ./smart-attendance-linux-installer.sh
```

### Méthode 2 : Package Debian

```bash
cd debian-package
sudo dpkg-deb --build . ../smart-attendance_2.0.0_amd64.deb
sudo dpkg -i ../smart-attendance_2.0.0_amd64.deb
```

---

## 📊 Base de données

- **Utilisateur** : postgres
- **Base** : smart_attendance_db
- **Port** : 5432
- **Hôte** : localhost

⚠️ Le mot de passe n'est PAS inclus dans ce README (sécurité).

---

## 🔧 Maintenance

### Windows
Scripts dans : `C:\Program Files\SmartAttendanceServer\scripts\`

- `backup-database.bat` — Sauvegarder
- `restore-database.bat` — Restaurer
- `check-service.bat` — Diagnostic
- `quick-start.bat` — Menu de maintenance

### Linux
Scripts dans : `/opt/smart-attendance/scripts/`

- `sudo backup-database.sh` — Sauvegarder
- `sudo restore-database.sh` — Restaurer
- `sudo check-service.sh` — Diagnostic
- `sudo update.sh <fichier.tar.gz>` — Mettre à jour

---

## 📞 Support

- **Site** : https://entreprise-1.smart-haouala.com
- **Email** : iot.sahnoun@gmail.com
- **Tél** : +216 29 328 870

---

*Généré le 28/09/2026 19:11:59*
