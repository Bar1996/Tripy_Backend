const express = require('express');
const router = express.Router();
const user_controller = require('../controllers/user_controller');
const auth = require('../common/auth_middleware');


router.post("/addDetails", auth,  user_controller.addDetails);
router.post("/addPreferences", auth, user_controller.addPreferences);
router.get("/getDetails",auth, user_controller.getDetails);
router.get("/getPreferences",auth, user_controller.getPreferences);
router.get("/check",auth, user_controller.CheckAuth);

module.exports = router;