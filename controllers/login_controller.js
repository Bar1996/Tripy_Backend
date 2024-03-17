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
      console.log('userRecord:', userRecord.user.uid);
      // const token = await userRecord.user.getIdToken();
      // const refreshToken = userRecord.user.refreshToken;
      
  
      if (!auth2.currentUser.emailVerified) {
        console.log('Need to verify email');
        res.send('You need to verify your email');
      } else {
        // console.log(`Baruch Haba Ya Malshin!${auth2.currentUser.email.toString()}`);
        // console.log('Transfer to Home page');
        // res.json({ token, refreshToken});
        haveDetails = await CheckDetails();
        havePreferences = await CheckPreferences();
        if (haveDetails === '1' && havePreferences === '1') {
          console.log('Transfer to Home Page');
          res.send({ success: true });
        }else if (haveDetails === '0') {
          console.log('Transfer to DetailsScreen');
          res.send({ success: false, userId: userRecord.user.uid, tranferTo: 'DetailsScreen'});
        }
        else{
          console.log('Transfer to Preferences');
          res.send({ success: false, userId: userRecord.user.uid, tranferTo: 'Preferences'});
        }
        
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

const CheckDetails = async (req, res) => {
  try {
      // Ensure user is authenticated
      const auth2 = getAuth();
      
      // Get the UID of the authenticated user
      const uid = auth2.currentUser.uid;

      // Assuming 'users' is the collection name where your user data resides
      const usersCollection = collection(db, 'users');

      // Query the user document by uid
      const q = query(usersCollection, where('uid', '==', uid));

      // Get documents that match the query
      const querySnapshot = await getDocs(q);

      // If no documents match the query
      if (querySnapshot.empty) {
          return ({message: "No user found with the provided UID" }) ;
      }

      // Assuming there's only one document for each user
      const userData = querySnapshot.docs[0].data();
      const haveDetails = userData.haveDetails;

      if (haveDetails === '1' || haveDetails === '0') {
          // 'haveDetails' field is either '1' or '0'
          return haveDetails;
      } else {
          // 'haveDetails' field is neither '1' nor '0'
          return ({message: "Invalid value for 'haveDetails' field" }) ;
      }
  } catch (error) {
      // Handle errors
      console.error('Error checking details:', error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const CheckPreferences = async (req, res) => {
  try {
      // Ensure user is authenticated
      const auth2 = getAuth();
      
      // Get the UID of the authenticated user
      const uid = auth2.currentUser.uid;

      // Assuming 'users' is the collection name where your user data resides
      const usersCollection = collection(db, 'users');

      // Query the user document by uid
      const q = query(usersCollection, where('uid', '==', uid));

      // Get documents that match the query
      const querySnapshot = await getDocs(q);

      // If no documents match the query
      if (querySnapshot.empty) {
          return ({message: "No user found with the provided UID" }) ;
      }

      // Assuming there's only one document for each user
      const userData = querySnapshot.docs[0].data();
      const havePreferences = userData.havePreferences;

      if (havePreferences === '1' || havePreferences === '0') {
          // 'haveDetails' field is either '1' or '0'
          return havePreferences;
      } else {
          // 'haveDetails' field is neither '1' nor '0'
          return ({message: "Invalid value for 'haveDetails' field" }) ;
      }
  } catch (error) {
      // Handle errors
      console.error('Error checking details:', error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};






module.exports = {LoginWithEmailAndPassword, signInGoogle, resetPassword, Maps, CheckDetails};