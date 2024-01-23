import { initializeApp } from 'firebase/app';
import express from 'express';
import admin from 'firebase-admin';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, setPersistence,signInWithEmailAndPassword, browserLocalPersistence } from "firebase/auth";
import {firebaseConfig} from "./firebaseConfig.js";
import cors from "cors";
import bodyParser from "body-parser";





admin.initializeApp({
    credential: admin.credential.cert("./server-firebase-keys.json"),
    projectId: 'tripy-e6333',

});

const app = express();
const port = process.env.PORT || 3000;
const serverURL = "https://backend-app-jbun.onrender.com";
const firestore_app = initializeApp(firebaseConfig);
const auth = getAuth(firestore_app);
// app.use(cors({ origin: 'https://localhost:19006' }));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());



let dateValid = false;
let emailValid = false;
let passwordValid = false;
let fullName = null;
let date = null;
let mail = null;
let pass = null;
let phone = null;

app.post('/signup', async (req, res) => {
    console.log('enter');
    const { email, password } = req.body;
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            // You can add more properties here if needed (displayName, etc.)
        });

        console.log('Successfully created new user:', userRecord.uid);
        res.send('User signed up successfully');
        console.log('check');
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error signing up');
    }
});


app.post('/post_email', async (req, res) => {
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
});

app.post('/post_password', async (req, res) => {
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
});


app.post('/signInGoogle', async (req, res) => {
    try{
        console.log('Received a request to /signInGoogle:', req.body);
        console.log("google enter")
        const {id_token} = req.body;
        const credential = GoogleAuthProvider.credential(id_token);
        await signInWithCredential(auth, credential);
        res.status(200).send('Sign in successful');
    } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send('Internal Server Error');
}
});

async function checkEmailInUse(email) {
    try {
        const user = await admin.auth().getUserByEmail(email);
        return user.providerData.length > 0; // Returns true if email is already in use
    } catch (error) {
        // If the user is not found, it means the email is not in use
        if (error.code === 'auth/user-not-found') {
            return false;
        }

        console.error('Error checking email:', error);
        throw error;
    }
}

app.post('/post_signin', async (req, res) => {
    const { email, password } = req.body.credentials;
  
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
  
      if (!auth.currentUser.emailVerified) {
        console.log('Need to verify email');
        res.send('You need to verify your email');
      } else {
        console.log(`Baruch Haba Ya Malshin!${auth.currentUser.email.toString()}`);
        console.log('Transfer to Home page');
        res.send('Welcome !');
      }
    } catch (error) {
      console.log('Incorrect details');
      console.log(error);
      res.send(`Incorrect details ${password} and url: ${email}`);
    }
  });


  
app.get('/', (req, res) => {
    res.send('Server is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port} and url: ${serverURL}`);
});
