const { initializeApp } = require('firebase/app');
const express = require('express');
const app = express();
const admin = require('firebase-admin');
const {
    createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword,
    fetchSignInMethodsForEmail, sendEmailVerification, sendPasswordResetEmail, setPersistence, browserLocalPersistence,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider, signInWithCredential, GoogleAuthProvider
} = require('firebase/auth');
const {
    getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, where, query, updateDoc,
} = require('firebase/firestore');
const cors = require("cors");
app.use(cors());
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const { db, firestore_app, auth, firebaseConfig } = require('./firebaseConfig.js');
 

const signupRoute = require('./routes/signup_route.js');


const PORT = process.env.PORT || 3000;
const serverURL = "https://backend-app-jbun.onrender.com";




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/signup', signupRoute);
app.use('/post_email', signupRoute);
app.use('/post_password', signupRoute);

// let emailValid = false;
// let passwordValid = false;
// let mail = null;
// let pass = null;
// let auth2 = getAuth();


// // app.post('/signup', async (req, res) => {
// //     const { email, password } = req.body;
// //     auth2 = getAuth();
// //     if (passwordValid && emailValid ) {
// //         const user = {
// //             email: email,
// //             password: password,
// //         };

// //         const adduser = {
// //             email: email,
// //         };
// //         try {
// //             const docRef = await createUserWithEmailAndPassword(auth2, user.email, user.password);
// //             const userObj = docRef.user;
// //             try {
// //                 console.log('sending mail');
// //                 await sendEmailVerification(userObj);
// //                 console.log('Email verification sent');
// //             } catch (error) {
// //                 console.error('Error sending email verification:', error);
// //             }

// //             console.log('Transfer to Home Page');
// //             res.send('yes');
// //             try {
// //                 console.log('checkpoint email: ', email, 'uid:', userObj.uid );
// //                 // Save the post data to Firestore
// //                 await addDoc(collection(db, "users"), {
// //                     email: email,
// //                     uid: userObj.uid,
// //                 });

// //                 console.log('Post data saved:');
// //             } catch (error) {
// //                 console.error('Error sending email verification:', error);
// //             }
// //         } catch (e) {
// //             if (e.code === 'auth/email-already-in-use') {
// //                 // Handle the case where the email is already in use
// //                 console.log('Email is already in use. Please choose a different email.');
// //                 res.send('Email already in use');
// //             } else console.error('Error adding document: ', e);
// //         }
// //     } else {
// //         console.log('Not valid signup');
// //         res.send('no');
// //     }
// // });

// // app.post('/post_email', async (req, res) => {
// //     console.log("req.body: ", req.body);
// //     const { email } = req.body;
// //     const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// //     if (!emailPattern.test(email)) {
// //         res.send('Please enter a valid email');
// //     } else {
// //         try {
// //             const isEmailInUse = await checkEmailInUse(email);

// //             if (isEmailInUse) {
// //                 res.send('Email is already in use');
// //                 console.log('Email is already in use')
// //             } else {
// //                 res.send('Email is available');
// //                 mail = email;
// //                 emailValid = true;
// //             }
// //         } catch (error) {
// //             console.error('Error checking email:', error);
// //             res.status(500).send('An error occurred while checking the email');
// //         }
// //     }

// //     console.log(email);
// // });

// // app.post('/post_password', async (req, res) => {
// //     const { password } = req.body;
// //     passwordValid = false;
// //     if (password.length < 10) {
// //         res.send('Password must be at least 10 characters long');
// //     } else if (!password.match(/[a-zA-Z]/)) {
// //         res.send('Password must contain at least one letter');
// //     } else {
// //         pass = password;
// //         passwordValid = true;
// //         res.send('Password received');
// //     }
// //     console.log(password);
// // });


// app.post('/signInGoogle', async (req, res) => {
//     try {
//         const { user } = req.body;
//         const userUid = user.uid;
//         const email = user.email;

//         // Check if the user already exists in the database
//         const usersCollection = collection(db, 'users');
//         const userQuery = query(usersCollection, where('uid', '==', userUid));
//         const userQuerySnapshot = await getDocs(userQuery);

//         if (userQuerySnapshot.empty) {
//             // User does not exist, add them to the database
//             await addDoc(usersCollection, {
//                 email: email,
//                 uid: userUid,
//             });

//             res.status(200).json({ success: true });
//         } else {
//             // User already exists, handle it accordingly
//             res.status(200).json({ success: false, message: 'User already exists' });
//         }
//     } catch (error) {
//         console.error('Error signing in with Google', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

// async function checkEmailInUse(email) {
//     try {
//         const user = await admin.auth().getUserByEmail(email);
//         return user.providerData.length > 0; // Returns true if email is already in use
//     } catch (error) {
//         // If the user is not found, it means the email is not in use
//         if (error.code === 'auth/user-not-found') {
//             return false;
//         }

//         console.error('Error checking email:', error);
//         throw error;
//     }
// }

// app.post('/post_signin', async (req, res) => {
//     const { email, password } = req.body.credentials;
//     auth2 = getAuth();
  
//     try {
//       await setPersistence(auth2, browserLocalPersistence);
//       await signInWithEmailAndPassword(auth2, email, password);
  
//       if (!auth2.currentUser.emailVerified) {
//         console.log('Need to verify email');
//         res.send('You need to verify your email');
//       } else {
//         console.log(`Baruch Haba Ya Malshin!${auth2.currentUser.email.toString()}`);
//         console.log('Transfer to Home page');
//         res.send('Welcome !');
//       }
//     } catch (error) {
//       console.log('Incorrect details');
//       console.log(error);
//       res.send(`Incorrect details ${password} and url: ${email}`);
//     }
//   });


  
// app.get('/', (req, res) => {
//     res.send('Server is running');
// });



app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT} and url: ${serverURL}`);
});