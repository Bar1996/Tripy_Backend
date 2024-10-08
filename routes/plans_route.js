const express = require('express');
const router = express.Router();
const plans_controller = require('../controllers/plans_controller.js');
const auth = require('../common/auth_middleware');

router.post("/addPlan",auth, plans_controller.addPlan);
router.get("/getUserPlanIds",auth, plans_controller.getUserPlanIds);
router.post("/getPlanById",auth, plans_controller.getPlanById);
router.post("/deletePlan",auth, plans_controller.deletePlan);
router.post("/editActivity",auth, plans_controller.editActivity);
router.post("/replaceActivity",auth, plans_controller.replaceActivity);
router.post("/deleteActivity",auth, plans_controller.deleteActivity);
router.post("/FindRestaurantNearBy",auth, plans_controller.FindRestaurantNearBy);
router.post("/addRestaurantToPlan",auth, plans_controller.addRestaurantToPlan);

module.exports = router;