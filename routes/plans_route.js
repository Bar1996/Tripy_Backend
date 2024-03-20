const express = require('express');
const router = express.Router();
const plans_controller = require('../controllers/plans_controller.js');

router.post("/addPlan", plans_controller.addPlan);
router.get("/getUserPlanIds", plans_controller.getUserPlanIds);
router.get("/getPlanById", plans_controller.getPlanById);


module.exports = router;