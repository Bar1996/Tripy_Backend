const { getAuth, createUserWithEmailAndPassword, sendEmailVerification } = require('firebase/auth');
const {collection, addDoc, updateDoc, getDocs, doc, query, where} = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { checkEmailInUse } = require('../helpers/checkEmailInUse.js');

let emailValid = false;
let passwordValid = false;
let mail = null;
let pass = null;
let auth2 = getAuth();

const SignUpWithEmailAndPassword = async (req, res) => {
    const { email, password } = req.body;   
    const haveDetails = '0';
    const havePreferences = '0';
    auth2 = getAuth();
    if (passwordValid && emailValid ) {
        const user = {
            email: email,
            password: password,
        };

        const adduser = {
            email: email,
        };
        try {
            const docRef = await createUserWithEmailAndPassword(auth2, user.email, user.password);
            const userObj = docRef.user;
            try {
                console.log('sending mail');
                await sendEmailVerification(userObj);
                console.log('Email verification sent');
            } catch (error) {
                console.error('Error sending email verification:', error);
            }

            console.log('Transfer to Home Page');
            // Return user ID along with the response
            res.send({ success: true, userId: userObj.uid });
            try {
                console.log('checkpoint email: ', email, 'uid:', userObj.uid );
                // Save the post data to Firestore
                await addDoc(collection(db, "users"), {
                    email: email,
                    uid: userObj.uid,
                    haveDetails: haveDetails,
                    havePreferences: havePreferences
                });

                console.log('Post data saved:');
            } catch (error) {
                console.error('Error saving user data:', error);
            }
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                // Handle the case where the email is already in use
                console.log('Email is already in use. Please choose a different email.');
                res.send('Email already in use');
            } else console.error('Error adding document: ', e);
        }
    } else {
        console.log('Not valid signup');
        res.send('no');
    }
};

const PostEmail = async (req, res) => {
    console.log("req.body: ", req.body);
    const { email } = req.body;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        res.send('Please enter a valid email');
    } else {
        try {
            const isEmailInUse = await checkEmailInUse(email);

            if (isEmailInUse) {
                res.send('Email is already in use');
                console.log('Email is already in use')
            } else {
                res.send('Email is available');
                mail = email;
                emailValid = true;
            }
        } catch (error) {
            console.error('Error checking email:', error);
            res.status(500).send('An error occurred while checking the email');
        }
    }

    console.log(email);
};

const PostPassword = async (req, res) => {
    const { password } = req.body;
    passwordValid = false;
    if (password.length < 10) {
        res.send('Password must be at least 10 characters long');
    } else if (!password.match(/[a-zA-Z]/)) {
        res.send('Password must contain at least one letter');
    } else {
        pass = password;
        passwordValid = true;
        res.send('Password received');
    }
    console.log(password);
};

const addDetails = async (req, res) => {
    try {
        // Check if userId exists in request body
        if (!req.body.uid) {
            res.status(400).send('uid is required');
            return;
        }

        const uid = req.body.uid; // Unique identifier for the user
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
        // Check if userId exists in request body
        if (!req.body.uid) {
            res.status(400).send('uid is required');
            return;
        }

        const uid = req.body.uid; // Unique identifier for the user
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




module.exports = { 
    SignUpWithEmailAndPassword,
    PostEmail,
    PostPassword,
    addDetails,
    addPreferences 
};