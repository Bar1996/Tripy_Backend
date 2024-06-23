const express = require('express');
const router = express.Router();
const plans_controller = require('../controllers/plans_controller.js');
const auth = require('../common/auth_middleware');

router.post("/addPlan",auth, plans_controller.addPlan);
router.get("/getUserPlanIds",auth, plans_controller.getUserPlanIds);
router.post("/getPlanById", plans_controller.getPlanById);
router.delete("/deletePlan",auth, plans_controller.deletePlan);


module.exports = router;