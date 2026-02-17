// src/utils/ProfessionalPayslipPDF.jsx
import { jsPDF } from 'jspdf';

export const generateProfessionalPayslipPDF = (payslip) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // ==================== EN-TÊTE PROFESSIONNEL (IDENTIQUE) ====================
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Smart Attendance', margin, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Système de Gestion de Paie Professionnel', margin, 27);
  
  // Numéro de fiche
  doc.setFontSize(12);
  doc.text(`Fiche N°: ${payslip.id || 'N/A'}`, pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(9);
  doc.text('Document confidentiel', pageWidth - margin, 26, { align: 'right' });
  
  // ==================== ENTREPRISE ====================
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 45, contentWidth, 30, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREPRISE', margin + 5, 55);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Smart Attendance SARL', margin + 5, 61);
  doc.text('Capital social: 100.000 DT', margin + 5, 66);
  doc.text('SIRET: 123 456 789 00012', margin + 5, 71);
  doc.text('123 Avenue Habib Bourguiba, Tunis', margin + contentWidth / 2, 61);
  doc.text('Tél: +216 71 234 567', margin + contentWidth / 2, 66);
  doc.text('contact@smart-attendance.tn', margin + contentWidth / 2, 71);
  
  // ==================== INFORMATIONS EMPLOYÉ ====================
  let y = 80;
  
  doc.setFillColor(230, 242, 255);
  doc.rect(margin, y, contentWidth, 35, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('INFORMATIONS EMPLOYÉ', margin + 5, y + 10);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  doc.text(`Nom: ${payslip.first_name || ''} ${payslip.last_name || ''}`, margin + 5, y + 18);
  doc.text(`Matricule: ${payslip.employee_id || 'N/A'}`, margin + contentWidth / 2, y + 18);
  
  doc.text(`Département: ${payslip.department || 'N/A'}`, margin + 5, y + 24);
  doc.text(`Poste: ${payslip.position || 'N/A'}`, margin + contentWidth / 2, y + 24);
  
  doc.text(`Date embauche: ${formatDate(payslip.hire_date)}`, margin + 5, y + 30);
  doc.text(`N° Sécurité sociale: ${payslip.social_security || 'N/A'}`, margin + contentWidth / 2, y + 30);
  
  // ==================== PÉRIODE DE PAIE ====================
  y += 45;
  
  doc.setFillColor(255, 248, 225);
  doc.rect(margin, y, contentWidth, 20, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(230, 126, 34);
  doc.text('PÉRIODE DE PAIE', margin + 5, y + 10);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Mois: ${payslip.month_name || payslip.month_year || 'N/A'}`, margin + contentWidth / 4, y + 10);
  doc.text(`Date paiement: ${payslip.payment_date ? formatDate(payslip.payment_date) : 'À payer'}`, margin + contentWidth / 2, y + 10);
  doc.text(`Méthode: ${payslip.payment_method || 'Virement bancaire'}`, margin + (contentWidth * 3/4), y + 10);
  
  // ==================== TABLEAU DES GAINS ====================
  y += 30;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(39, 174, 96);
  doc.text('GAINS', margin, y);
  
  // Tableau gains (similaire au relevé)
  const earningsData = [
    ['Salaire de base', `${payslip.base_salary?.toFixed(3) || '0.000'} DT`],
    ['Bonus performance', `${payslip.bonus_amount?.toFixed(3) || '0.000'} DT`],
    ['Heures supplémentaires', `${payslip.overtime_amount?.toFixed(3) || '0.000'} DT`],
    ['TOTAL GAINS', `${payslip.total_earnings?.toFixed(3) || '0.000'} DT`]
  ];
  
  drawTable(doc, margin, y + 5, contentWidth, earningsData);
  
  // ==================== TABLEAU DES DÉDUCTIONS ====================
  y += 50;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(231, 76, 60);
  doc.text('DÉDUCTIONS', margin, y);
  
  const deductionsData = [
    [`Impôt sur le revenu (${payslip.tax_rate || '0'}%)`, `${payslip.tax_amount?.toFixed(3) || '0.000'} DT`],
    [`Sécurité sociale (${payslip.social_security_rate || '0'}%)`, `${payslip.social_security_amount?.toFixed(3) || '0.000'} DT`],
    ['Autres déductions', `${payslip.other_deductions?.toFixed(3) || '0.000'} DT`],
    ['TOTAL DÉDUCTIONS', `${payslip.total_deductions?.toFixed(3) || '0.000'} DT`]
  ];
  
  drawTable(doc, margin, y + 5, contentWidth, deductionsData);
  
  // ==================== RÉCAPITULATIF (MÊME DESIGN) ====================
  y += 50;
  
  doc.setFillColor(52, 152, 219);
  doc.rect(margin, y, contentWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉCAPITULATIF DU PAIEMENT', margin + contentWidth / 2, y + 10, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text('Salaire brut:', margin + 5, y + 20);
  doc.text('Total déductions:', margin + 5, y + 26);
  
  doc.text(`${payslip.total_earnings?.toFixed(3) || '0.000'} DT`, margin + contentWidth - 5, y + 20, { align: 'right' });
  doc.text(`${payslip.total_deductions?.toFixed(3) || '0.000'} DT`, margin + contentWidth - 5, y + 26, { align: 'right' });
  
  // Net à payer
  doc.setFontSize(16);
  doc.text('NET À PAYER:', margin + 5, y + 35);
  doc.text(`${payslip.net_salary?.toFixed(3) || '0.000'} DT`, margin + contentWidth - 5, y + 35, { align: 'right' });
  
  // ==================== INFORMATIONS BANCAIRES ====================
  y += 45;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Coordonnées bancaires: ${payslip.bank_account || 'N/A'}`, margin + 5, y);
  
  // ==================== PIED DE PAGE (IDENTIQUE) ====================
  const footerY = doc.internal.pageSize.height - 20;
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Document généré automatiquement par Smart Attendance System', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('Ce document est confidentiel et destiné uniquement à l\'employé concerné', pageWidth / 2, footerY + 10, { align: 'center' });
  
  // Signature
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Signature et cachet:', margin, footerY - 5);
  doc.line(margin + 40, footerY - 3, margin + 120, footerY - 3);
  doc.text('Le Responsable Paie', margin + 80, footerY + 2, { align: 'center' });
  
  // Sauvegarder
  return doc;
};

// Fonction utilitaire pour les tableaux
const drawTable = (doc, x, y, width, data) => {
  const rowHeight = 8;
  const col2Width = 50;
  
  data.forEach((row, index) => {
    const isTotal = index === data.length - 1;
    
    if (isTotal) {
      doc.setFillColor(240, 255, 244);
      doc.rect(x, y, width, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, width, rowHeight, 'F');
      doc.setFont('helvetica', 'normal');
    }
    
    doc.setTextColor(0, 0, 0);
    doc.text(row[0], x + 5, y + 6);
    doc.text(row[1], x + width - 5, y + 6, { align: 'right' });
    
    y += rowHeight;
  });
};

// Fonction de formatage de date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Export pour utilisation dans d'autres composants
export const downloadPayslipPDF = (payslip) => {
  const doc = generateProfessionalPayslipPDF(payslip);
  const fileName = `fiche_paie_${payslip.employee_id}_${payslip.month_year}.pdf`;
  doc.save(fileName);
  return fileName;
};
