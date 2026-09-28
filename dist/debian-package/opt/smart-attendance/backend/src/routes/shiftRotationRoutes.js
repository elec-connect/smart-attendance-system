// backend/src/routes/shiftRotationRoutes.js - Ajouter

// Initialiser les positions de départ (à faire une seule fois)
router.post('/initialize-starts', authorizeRoles('admin'), async (req, res) => {
  try {
    const { department } = req.body;
    
    const result = await shiftRotationService.initializeEmployeeStarts(department);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtenir le calendrier prévisionnel
router.get('/forecast/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const { department } = req.query;
    
    const calendar = await shiftRotationService.generateYearlyCalendar(
      parseInt(year), 
      department
    );
    
    // Grouper par semaine pour faciliter l'affichage
    const grouped = {};
    calendar.forEach(item => {
      if (!grouped[item.weekNumber]) {
        grouped[item.weekNumber] = [];
      }
      grouped[item.weekNumber].push(item);
    });
    
    res.json({
      success: true,
      data: grouped
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});// JavaScript source code
