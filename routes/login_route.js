const express = require('express');
const router = express.Router();
const signup_controller = require('../controllers/login_controller.js');

router.post("/login", signup_controller.LoginWithEmailAndPassword);
router.post("/signInGoogle", signup_controller.signInGoogle);
router.post("/resetPass", signup_controller.resetPassword);

module.exports = router;

