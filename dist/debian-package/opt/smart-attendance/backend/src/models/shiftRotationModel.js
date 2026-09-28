// backend/src/models/shiftRotationModel.js
const shiftCycles = {
  "continu": {
    name: "Cycle Continu 3x8",
    pattern: [
      { week: 1, shift: "Shift Matin" },
      { week: 2, shift: "Shift Après-midi" },
      { week: 3, shift: "Shift Nuit" },
      // La semaine 4 retourne au Matin (cycle de 3 semaines)
    ],
    cycleLength: 3 // 3 semaines, puis répète
  }
};// JavaScript source code
