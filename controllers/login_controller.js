const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {collection, addDoc, getDocs, where, query} = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { browserLocalPersistence, setPersistence } = require('firebase/auth');

let auth2 = getAuth();


const LoginWithEmailAndPassword = async (req, res) => {
    const { email, password } = req.body;
    console.log('Email:', email, 'password:', password);
    auth2 = getAuth();
  
    try {
      await setPersistence(auth2, browserLocalPersistence);
      await signInWithEmailAndPassword(auth2, email, password);
  
      if (!auth2.currentUser.emailVerified) {
        console.log('Need to verify email');
        res.send('You need to verify your email');
      } else {
        console.log(`Baruch Haba Ya Malshin!${auth2.currentUser.email.toString()}`);
        console.log('Transfer to Home page');
        res.send('Welcome !');
      }
    } catch (error) {
      console.log('Incorrect details');
      console.log(error);
      res.send(`Incorrect details ${password} and url: ${email}`);
    }
  };

  const signInGoogle = async (req, res) => {
    try {
        const { user } = req.body;
        const userUid = user.uid;
        const email = user.email;

        // Check if the user already exists in the database
        const usersCollection = collection(db, 'users');
        const userQuery = query(usersCollection, where('uid', '==', userUid));
        const userQuerySnapshot = await getDocs(userQuery);

        if (userQuerySnapshot.empty) {
            // User does not exist, add them to the database
            await addDoc(usersCollection, {
                email: email,
                uid: userUid,
            });

            res.status(200).json({ success: true });
        } else {
            // User already exists, handle it accordingly
            res.status(200).json({ success: false, message: 'User already exists' });
        }
    } catch (error) {
        console.error('Error signing in with Google', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {LoginWithEmailAndPassword, signInGoogle};


