const { getAuth, signInWithEmailAndPassword, deleteUser } = require('firebase/auth');
const { collection, addDoc, updateDoc, getDocs, doc, query, where, getDoc, deleteDoc } = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const jwt = require("jsonwebtoken");
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Middleware
const app = express();
app.use(express.json());

const tokens = {}; // In-memory storage for tokens (for simplicity, use a database in production)

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
      user: 'tripy.help@gmail.com',
      pass: 'meox rrfg jfdm shmr', // The 16-character app password
    },
  });


  const SendMail = async (req, res) => {
    // Endpoint to send verification email
    console.log('req.body:', req.body);
    const uid = req.body.user.uid; // Unique identifier for the user
    const email = req.body.email;
   

  
    // Generate a random 5-digit number
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
  
    // Store the number with an expiration time (e.g., 1 hour)
    tokens[randomNumber] = { email, expires: Date.now() + 3600000 };
  
    const mailOptions = {
      from: 'Tripy support',
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Please verify your email by entering the following code:</p>
             <h3>${randomNumber}</h3>`,
    };

    const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
    if (userQuerySnapshot.empty) {
        res.status(404).send('User not found');
        return;
    }

    const userDoc = userQuerySnapshot.docs[0].ref;


    await updateDoc(userDoc, {
        verifynumber: randomNumber,
    });
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send('Error sending verification email');
      }
      res.send('Verification email sent');
    });
  };



const addDetails = async (req, res) => {
    try {
  

        console.log('user in add deatails:', req.body.user.uid);
        const uid = req.body.user.uid; // Unique identifier for the user
        const name = req.body.name;
        const gender = req.body.gender;
        const dateString = req.body.birthday;
        const haveDetails = '1';
        
        console.log('uid:', uid);
        console.log('name:', name);
        console.log('gender:', gender);
        console.log('dateOfBirth:', dateString);

        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        console.log('age:', age);
        // Fetch the user document from Firestore by uid
        const q = query(collection(db, 'users'), where('uid', '==', uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        // Assuming there's only one user with the given uid, get its reference
        const userDoc = querySnapshot.docs[0].ref;

        // Update the user document with the new information
        await updateDoc(userDoc, {
            name: name,
            gender: gender,
            dateOfBirth: dateString, // Assuming dateOfBirth field exists in your Firestore schema
            haveDetails: haveDetails,
            age: age
        });

        res.status(200).send('Details added successfully');
    } catch (error) {
        console.error('Error adding details:', error);
        res.status(500).send('Error adding details');
    }
};

const addPreferences = async (req, res) => {
    try {
  

        console.log('user in add preferences:', req.body.user.uid);

        const uid = req.body.user.uid; // Unique identifier for the user
        const preferences = req.body.preferences; // Get preferences from request body
        const havePreferences = '1';

        // Check if user exists in 'users' collection
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userQuerySnapshot.docs[0].data();
        const preferencesUid = userData.preferences_uid;

        // Check if user has preferences_uid
        if (preferencesUid) {
            // Update preferences document in 'preferences' collection
            const preferencesDocRef = doc(db, 'preferences', preferencesUid);
            await updateDoc(preferencesDocRef, { preferences, uid });
        } else {
            // Create new preferences document
            const preferencesDocRef = await addDoc(collection(db, 'preferences'), { preferences, uid });
            const preferencesUid = preferencesDocRef.id;
            
            // Update 'users' collection with preferencesUid
            const userDocRef = userQuerySnapshot.docs[0].ref;
            await updateDoc(userDocRef, { preferences_uid: preferencesUid, havePreferences});
        }

        res.status(200).send('Preferences added successfully');
    } catch (error) {
        console.error('Error adding preferences:', error);
        res.status(500).send('Error adding preferences');
    }
};

const getDetails = async (req, res) => {
    try {
      

        const uid = req.body.user.uid; // Unique identifier for the user

        // Check if user exists in 'users' collection
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userQuerySnapshot.docs[0].data();
        const details = {
            name: userData.name,
            gender: userData.gender,
            dateOfBirth: userData.dateOfBirth,
            email: userData.email,
            userType: userData.userType,
        };

        res.status(200).send(details);
    }
    catch (error) {
        console.error('Error getting details:', error);
        res.status(500).send('Error getting details');
    }
}

const getPreferences = async (req, res) => {
    try {


        const uid = req.body.user.uid; // Unique identifier for the user

        // Check if user exists in 'users' collection and has a preferences_uid
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userQuerySnapshot.docs[0].data();
        
        // Ensure the user has a preferences_uid field
        if (!userData.preferences_uid) {
            res.status(404).send('User preferences not found');
            return;
        }

        // Fetch preferences using preferences_uid
        const preferencesDoc = await getDoc(doc(db, 'preferences', userData.preferences_uid));
        if (!preferencesDoc.exists()) {
            res.status(404).send('Preferences not found');
            return;
        }

        const preferencesData = preferencesDoc.data();
        const preferences = preferencesData.preferences;
        

        res.status(200).send( preferences );
    }
    catch (error) {
        console.error('Error getting preferences:', error);
        res.status(500).send('Error getting preferences');
    }
}

const CheckAuth = async (req, res) => {
    console.log("Checking token validity"); // Check if this gets printed
    res.status(200).json({
        message: "Authenticated",
    });
}


const logout = async (req, res) => {
    console.log("logout");
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];
  
    if (accessToken == null) {
      return res.status(401).send("missing token");
    }
  
    jwt.verify(accessToken, process.env.TOKEN_SECRET, async (err, userInfo) => {
      if (err) {
        return res.status(403).send("invalid token");
      }
  
      try {
        // Find the user in Firestore
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', userInfo.uid)));
        if (userQuerySnapshot.empty) {
          return res.status(404).send("not found");
        }
  
        const userDoc = userQuerySnapshot.docs[0];
        const userRef = doc(db, 'users', userDoc.id);
  
        // Clear tokens or relevant session fields
        await updateDoc(userRef, { tokens: [] });
  
        return res.status(200).send("logout successful");
      } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).send(error.message);
      }
    });
  };


  const deleteUserData = async (req, res) => {
    try {
        const uid = req.body.user.uid; // Unique identifier for the user
        const verifynumber = req.body.verifynumber; // Verification number

        // Check if user exists in 'users' collection
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        // Assuming there's only one user with the given uid, get its reference
        const userDoc = userQuerySnapshot.docs[0].ref;
        const userData = userQuerySnapshot.docs[0].data();

        console.log('userData:', userData.verifynumber);

        const verifyDelete = userData.verifynumber;
        
        // Number inserted by user is not equal to the number in the database
        if (verifynumber != verifyDelete) {
            res.status(403).send('Unauthorized');
            return;
        } else if (verifynumber == verifyDelete) {
            await deleteDoc(userDoc);

            // Delete the user's plans
            const plansQuerySnapshot = await getDocs(query(collection(db, 'plans'), where('uid', '==', uid)));
            const deletePlanPromises = plansQuerySnapshot.docs.map(planDoc => deleteDoc(planDoc.ref));
            await Promise.all(deletePlanPromises);
    
            // Delete the user's preferences
            if (userData.preferences_uid) {
                const preferencesDocRef = doc(db, 'preferences', userData.preferences_uid);
                await deleteDoc(preferencesDocRef);
            }
    
            // Finally, delete the user from Firebase Authentication
            await admin.auth().deleteUser(uid);
    
            res.status(200).send('User data, plans, preferences, and authentication deleted successfully');
        }
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).send('Error deleting user data');
    }
};





module.exports = {addDetails, addPreferences, getDetails, getPreferences, CheckAuth, logout, deleteUserData, SendMail};