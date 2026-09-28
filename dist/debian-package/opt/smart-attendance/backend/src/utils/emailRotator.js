// backend/src/utils/emailRotator.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ==================== CHARGEMENT FORCÉ DU .env ====================
// Chercher le fichier .env à la racine du projet
const envPaths = [
    path.join(__dirname, '../../.env'),  // backend/.env
    path.join(process.cwd(), '.env'),    // dossier courant
    '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`📧 [EmailRotator] Chargement .env depuis: ${envPath}`);
        const result = require('dotenv').config({ path: envPath });
        if (!result.error) {
            console.log(`📧 [EmailRotator] ✅ .env chargé avec succès`);
            envLoaded = true;
            break;
        } else {
            console.log(`📧 [EmailRotator] ❌ Erreur:`, result.error);
        }
    }
}

if (!envLoaded) {
    console.warn(`📧 [EmailRotator] ⚠️ Aucun fichier .env trouvé`);
}

// Afficher les variables chargées
console.log(`📧 [EmailRotator] SMTP_HOST_1: ${process.env.SMTP_HOST_1 ? '✓ PRÉSENT' : '✗ MANQUANT'}`);
console.log(`📧 [EmailRotator] SMTP_USER_1: ${process.env.SMTP_USER_1 ? '✓ PRÉSENT' : '✗ MANQUANT'}`);

class EmailRotator {
    constructor() {
        this.accounts = [];
        this.currentIndex = 0;
        this.dailyLimit = 450;
        this.batchSize = 100;
        this.batchDelay = 3000;
        this.loadAccounts();
    }

    loadAccounts() {
        console.log('\n📧 [EmailRotator] Chargement des comptes email depuis .env...');
        
        let i = 1;
        let loadedCount = 0;
        
        while (i <= 10) {
            const hostKey = `SMTP_HOST_${i}`;
            const userKey = `SMTP_USER_${i}`;
            const passKey = `SMTP_PASSWORD_${i}`;
            
            if (process.env[hostKey] && process.env[userKey] && process.env[passKey]) {
                console.log(`   ✓ Compte ${i}: ${process.env[userKey]}`);
                this.accounts.push({
                    host: process.env[hostKey],
                    port: parseInt(process.env[`SMTP_PORT_${i}`]) || 587,
                    user: process.env[userKey],
                    password: process.env[passKey],
                    from: process.env[`EMAIL_FROM_${i}`] || process.env[userKey],
                    name: process.env.EMAIL_FROM_NAME || 'Smart Attendance',
                    sentCount: 0,
                    lastReset: Date.now()
                });
                loadedCount++;
                i++;
            } else {
                if (i === 1) break;
                i++;
            }
        }
        
        console.log(`\n📧 ${this.accounts.length} comptes email chargés depuis .env`);
        if (this.accounts.length > 0) {
            console.log(`📊 Capacité: ${this.accounts.length * this.dailyLimit} emails/jour`);
            console.log(`📦 Taille des lots: ${this.batchSize} emails`);
            console.log(`⏱️  Pause entre lots: ${this.batchDelay / 1000} secondes`);
        } else {
            console.error(`❌ AUCUN compte email chargé!`);
        }
    }

    resetCounters() {
        const now = Date.now();
        this.accounts.forEach(account => {
            if (now - account.lastReset >= 24 * 60 * 60 * 1000) {
                account.sentCount = 0;
                account.lastReset = now;
            }
        });
    }

    getNextAvailableAccount() {
        if (this.accounts.length === 0) {
            throw new Error('❌ Aucun compte email configuré');
        }
        
        this.resetCounters();
        
        for (let attempt = 0; attempt < this.accounts.length; attempt++) {
            const index = (this.currentIndex + attempt) % this.accounts.length;
            const account = this.accounts[index];
            
            if (account.sentCount < this.dailyLimit) {
                this.currentIndex = (index + 1) % this.accounts.length;
                account.sentCount++;
                return account;
            }
        }
        
        const totalSent = this.accounts.reduce((sum, acc) => sum + acc.sentCount, 0);
        const totalCapacity = this.accounts.length * this.dailyLimit;
        throw new Error(`❌ Limite quotidienne atteinte: ${totalSent}/${totalCapacity} emails`);
    }

    createTransporter(account) {
        return nodemailer.createTransport({
            host: account.host,
            port: account.port,
            secure: account.port === 465,
            auth: {
                user: account.user,
                pass: account.password
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendEmailWithAccount(account, to, subject, html, attachments = []) {
        const transporter = this.createTransporter(account);
        
        const mailOptions = {
            from: `"${account.name}" <${account.from}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments
        };
        
        return await transporter.sendMail(mailOptions);
    }

    async sendBatchByLots(employees, subject, getHtmlFunction, onProgress = null) {
        if (this.accounts.length === 0) {
            throw new Error('❌ Impossible d\'envoyer des emails: aucun compte configuré');
        }
        
        const startTime = Date.now();
        const results = {
            sent: [],
            failed: [],
            total: employees.length,
            stats: null,
            startTime: startTime,
            endTime: null
        };
        
        const batches = [];
        for (let i = 0; i < employees.length; i += this.batchSize) {
            batches.push(employees.slice(i, i + this.batchSize));
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 DÉBUT ENVOI DES EMAILS`);
        console.log(`${'='.repeat(60)}`);
        console.log(`📧 Total employés: ${employees.length}`);
        console.log(`📦 Nombre de lots: ${batches.length} (${this.batchSize} emails/lot)`);
        console.log(`⏱️  Pause entre lots: ${this.batchDelay / 1000} secondes`);
        console.log(`${'='.repeat(60)}\n`);
        
        let processedCount = 0;
        let batchNumber = 0;
        
        for (const batch of batches) {
            batchNumber++;
            const batchStartTime = Date.now();
            
            console.log(`\n📦 LOT ${batchNumber}/${batches.length}`);
            console.log(`   ├─ Employés: ${batch.length}`);
            console.log(`   ├─ Début: ${new Date().toLocaleTimeString()}`);
            
            const promises = batch.map(async (employee) => {
                try {
                    const account = this.getNextAvailableAccount();
                    const html = getHtmlFunction(employee);
                    await this.sendEmailWithAccount(account, employee.email, subject, html);
                    
                    return { 
                        success: true, 
                        email: employee.email, 
                        employee: employee,
                        account: account.user
                    };
                } catch (error) {
                    console.error(`   ❌ Échec ${employee.email}:`, error.message);
                    return { 
                        success: false, 
                        email: employee.email, 
                        error: error.message, 
                        employee: employee 
                    };
                }
            });
            
            const batchResults = await Promise.all(promises);
            
            let batchSent = 0;
            let batchFailed = 0;
            
            for (const result of batchResults) {
                if (result.success) {
                    results.sent.push(result.email);
                    batchSent++;
                } else {
                    results.failed.push({ 
                        email: result.email, 
                        error: result.error,
                        employeeName: `${result.employee?.first_name} ${result.employee?.last_name}`
                    });
                    batchFailed++;
                }
                processedCount++;
            }
            
            const batchDuration = Date.now() - batchStartTime;
            
            console.log(`   ├─ Succès: ${batchSent}`);
            console.log(`   ├─ Échecs: ${batchFailed}`);
            console.log(`   ├─ Durée: ${(batchDuration / 1000).toFixed(1)} secondes`);
            console.log(`   └─ Progression totale: ${processedCount}/${employees.length} (${Math.round(processedCount/employees.length*100)}%)`);
            
            if (onProgress) {
                onProgress(processedCount, employees.length, results);
            }
            
            if (batchNumber < batches.length) {
                console.log(`\n⏳ Pause de ${this.batchDelay / 1000} secondes avant le lot suivant...`);
                await this.sleep(this.batchDelay);
            }
        }
        
        results.endTime = Date.now();
        results.stats = this.getStats();
        const totalDuration = (results.endTime - results.startTime) / 1000;
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 ENVOI TERMINÉ`);
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ Succès: ${results.sent.length}`);
        console.log(`❌ Échecs: ${results.failed.length}`);
        console.log(`⏱️  Durée totale: ${totalDuration.toFixed(1)} secondes`);
        console.log(`${'='.repeat(60)}\n`);
        
        return results;
    }

    getStats() {
        return {
            accounts: this.accounts.map(acc => ({
                user: acc.user,
                sent: acc.sentCount,
                remaining: this.dailyLimit - acc.sentCount,
                limit: this.dailyLimit
            })),
            totalSent: this.accounts.reduce((sum, acc) => sum + acc.sentCount, 0),
            totalCapacity: this.accounts.length * this.dailyLimit,
            accountsCount: this.accounts.length,
            batchSize: this.batchSize,
            batchDelay: this.batchDelay
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new EmailRotator();