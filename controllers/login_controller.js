const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {collection, addDoc, getDocs, where, query} = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { browserLocalPersistence, setPersistence, sendPasswordResetEmail, fetchSignInMethodsForEmail } = require('firebase/auth');
const { checkEmailInUse } = require('../helpers/checkEmailInUse.js');
const axios = require('axios');


let auth2 = getAuth();


const LoginWithEmailAndPassword = async (req, res) => {
    const { email, password } = req.body;
    console.log('Email:', email, 'password:', password);
    auth2 = getAuth();
  
    try {
      await setPersistence(auth2, browserLocalPersistence);
      const userRecord = await signInWithEmailAndPassword(auth2, email, password);
      // const token = await userRecord.user.getIdToken();
      // const refreshToken = userRecord.user.refreshToken;
      
  
      if (!auth2.currentUser.emailVerified) {
        console.log('Need to verify email');
        res.send('You need to verify your email');
      } else {
        console.log(`Baruch Haba Ya Malshin!${auth2.currentUser.email.toString()}`);
        console.log('Transfer to Home page');
        // res.json({ token, refreshToken});
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


const resetPassword = async (req, res) => {
  const { email } = req.body;
  auth2 = getAuth();
  console.log('Email:', email);
    try {
      const isEmailInUse = await checkEmailInUse(email);
      console.log('isEmailInUse:', isEmailInUse);

      if (isEmailInUse) {
        sendPasswordResetEmail(auth2, email)
          .then(() => {
            // Password reset email sent successfully
            console.log('If the email address exists in our system, a password reset email will be sent');
            res.send('If the email address exists in our system, a password reset email will be sent');
          })
          .catch((error) => {
            // An error occurred while sending the password reset email
            console.error(error);
          });
      } else {
        res.send('If the email address exists in our system, a password reset email will be sent');
      }
    } catch (error) {
      console.error('Error checking email:', error);
      res.status(500).send('An error occurred while checking the email');
    }
  console.log(email);
};



//TODO: Add the Maps function
const Maps =  async (req, res) => {
  const { place_id } = req.params;
  try {
      const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
      const data = response.data;
      res.json(data);
  } catch (error) {
      console.error('Error fetching place details:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
};
module.exports = {LoginWithEmailAndPassword, signInGoogle, resetPassword, Maps};