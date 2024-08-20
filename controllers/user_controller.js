const { getAuth, signInWithEmailAndPassword, deleteUser, updatePassword  } = require('firebase/auth');
const { collection, addDoc, updateDoc, getDocs, doc, query, where, getDoc, deleteDoc } = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const jwt = require("jsonwebtoken");
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const tokens = {}; 

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD, 
    },
  });


  const SendMail = async (req, res) => {
    const uid = req.body.user.uid; 
    const email = req.body.email;
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
  
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
  

        const uid = req.body.user.uid; // Unique identifier for the user
        const name = req.body.name;
        const gender = req.body.gender;
        const dateString = req.body.birthday;
        const haveDetails = '1';
        
      

        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        // Fetch the user document from Firestore by uid
        const q = query(collection(db, 'users'), where('uid', '==', uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userDoc = querySnapshot.docs[0].ref;

        // Update the user document with the new information
        await updateDoc(userDoc, {
            name: name,
            gender: gender,
            dateOfBirth: dateString, 
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
  


        const uid = req.body.user.uid; 
        const preferences = req.body.preferences; 
        const havePreferences = '1';

        
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userQuerySnapshot.docs[0].data();
        const preferencesUid = userData.preferences_uid;

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
      

        const uid = req.body.user.uid;

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


        const uid = req.body.user.uid; 

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
    console.log("Checking token validity"); 
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
        const uid = req.body.user.uid; 
        const verifynumber = req.body.verifynumber; 

        // Check if user exists in 'users' collection
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        const userDoc = userQuerySnapshot.docs[0].ref;
        const userData = userQuerySnapshot.docs[0].data();


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

const changePassword = async (req, res) => {
    try {
        const uid = req.body.user.uid; 
        const { currentPassword, newPassword } = req.body;

        // Fetch user document from Firestore
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userDoc = userQuerySnapshot.docs[0];
        const userData = userDoc.data();
        const email = userData.email;

        // Authenticate user with current password
        const auth = getAuth();
        const userCredential = await signInWithEmailAndPassword(auth, email, currentPassword);
        const user = userCredential.user;

        // Update password
        await updatePassword(user, newPassword);

        return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);

        if (error.code === 'auth/invalid-credential') {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        } else if (error.code === 'auth/weak-password') {
            return res.status(400).json({ success: false, message: 'New password is too weak' });
        } else if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        } else if (error.code === 'auth/too-many-requests') {
            return res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
        }

        return res.status(500).json({ success: false, message: 'Error changing password' });
    }
};


    
    





module.exports = {addDetails, addPreferences, getDetails, getPreferences, CheckAuth, logout, deleteUserData, SendMail,changePassword};