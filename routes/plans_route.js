const express = require('express');
const router = express.Router();
const plans_controller = require('../controllers/plans_controller.js');
const auth = require('../common/auth_middleware');

router.post("/addPlan",auth, plans_controller.addPlan);
router.get("/getUserPlanIds",auth, plans_controller.getUserPlanIds);
router.get("/getPlanById",auth, plans_controller.getPlanById);


module.exports = router;