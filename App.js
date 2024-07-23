const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const { db } = require("./firebaseConfig.js");

const signupRoute = require("./routes/signup_route.js");
const loginRoute = require("./routes/login_route.js");
const plansRoute = require("./routes/plans_route.js");
const userRoute = require("./routes/user_route.js");

const initApp = () => {
  const promise = new Promise(async (resolve, reject) => {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use("/", signupRoute);
    app.use("/", loginRoute);
    app.use("/", plansRoute);
    app.use("/", userRoute);
    resolve(app);
  });
  return promise;
};

module.exports = initApp;
