const express = require('express');
const router = express.Router();
const login_controller = require('../controllers/login_controller.js');

router.post("/login", login_controller.LoginWithEmailAndPassword);
router.post("/resetPass", login_controller.resetPassword);
router.get("/place-details/:place_id", login_controller.Maps);
router.get("/refresh", login_controller.refresh);
router.post("/googleSignIn", login_controller.googleSignIn);

module.exports = router;

