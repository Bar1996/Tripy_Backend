const express = require('express');
const router = express.Router();
const ai_controller = require('../controllers/ai_controller.js');

router.post("/generatePlan", ai_controller.generatePlan);

module.exports = router;

