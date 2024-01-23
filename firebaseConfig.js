// const admin = require('firebase-admin');
//
//
// const serviceAccount = require('./server-firebase-keys.json');
//
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });
//
// module.exports = admin;



import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use

const firebaseConfig = {
    apiKey: "AIzaSyAL0c1rZ9JLMIcobBeuc8YpZPP-AC_GE84",
    authDomain: "tripy-e6333.firebaseapp.com",
    projectId: "tripy-e6333",
    storageBucket: "tripy-e6333.appspot.com",
    messagingSenderId: "551607313233",
    appId: "1:551607313233:web:055f2cd3ab1e7916f36970",
    measurementId: "G-6MPNKQGPBX"
};

const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

export {firebaseConfig};
