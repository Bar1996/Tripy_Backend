const { getAuth, createUserWithEmailAndPassword, sendEmailVerification } = require('firebase/auth');
const {collection, addDoc} = require('firebase/firestore');
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
            res.send('yes');
            try {
                console.log('checkpoint email: ', email, 'uid:', userObj.uid );
                // Save the post data to Firestore
                await addDoc(collection(db, "users"), {
                    email: email,
                    uid: userObj.uid,
                });

                console.log('Post data saved:');
            } catch (error) {
                console.error('Error sending email verification:', error);
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

module.exports = { SignUpWithEmailAndPassword, PostEmail, PostPassword};