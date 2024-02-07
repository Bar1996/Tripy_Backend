const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
const admin = require('firebase-admin');


const firebaseConfig = {
    apiKey: "AIzaSyAL0c1rZ9JLMIcobBeuc8YpZPP-AC_GE84",
    authDomain: "tripy-e6333.firebaseapp.com",
    projectId: "tripy-e6333",
    storageBucket: "tripy-e6333.appspot.com",
    messagingSenderId: "551607313233",
    appId: "1:551607313233:web:055f2cd3ab1e7916f36970",
    measurementId: "G-6MPNKQGPBX"
};

admin.initializeApp({
    credential: admin.credential.cert("./server-firebase-keys.json"),
    projectId: 'tripy-e6333',

});
const firestore_app = initializeApp(firebaseConfig);
const db = getFirestore(firestore_app);
const auth = getAuth(firestore_app);


module.exports =  {firestore_app, firebaseConfig, db, auth};
