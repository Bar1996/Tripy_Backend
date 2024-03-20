const express = require('express');
const router = express.Router();
const user_controller = require('../controllers/user_controller');


router.post("/addDetails", user_controller.addDetails);
router.post("/addPreferences", user_controller.addPreferences);
router.get("/getDetails", user_controller.getDetails);
router.get("/getPreferences", user_controller.getPreferences);

module.exports = router;