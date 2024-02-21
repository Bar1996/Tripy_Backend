const express = require('express');
const router = express.Router();
const signup_controller = require('../controllers/signup_controller.js');

router.post("/signup", signup_controller.SignUpWithEmailAndPassword);
router.post("/post_email", signup_controller.PostEmail);
router.post("/post_password", signup_controller.PostPassword);
router.post("/addDetails", signup_controller.addDetails);

module.exports = router;