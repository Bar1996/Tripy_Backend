const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const {
  collection,
  addDoc,
  getDocs,
  where,
  query,
  updateDoc,
  arrayUnion,
} = require("firebase/firestore");
const admin = require("firebase-admin");
const { db } = require("../firebaseConfig.js");
const {
  browserLocalPersistence,
  setPersistence,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} = require("firebase/auth");
const { checkEmailInUse } = require("../helpers/checkEmailInUse.js");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require('google-auth-library');

let auth2 = getAuth();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const LoginWithEmailAndPassword = async (req, res) => {
  const { email, password } = req.body;
  console.log("Email:", email, "password:", password);
  const auth2 = getAuth();

  try {
    await setPersistence(auth2, browserLocalPersistence);
    const userRecord = await signInWithEmailAndPassword(auth2, email, password);
    console.log("userRecord:", userRecord.user.uid);

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(userRecord.user.uid);

    console.log("Access Token:", jwt.decode(accessToken).uid);

    const usersQuery = query(collection(db, 'users'), where('uid', '==', userRecord.user.uid));
    const querySnapshot = await getDocs(usersQuery);


    if (querySnapshot.empty) {
      console.log("User not found in Firestore, considering adding a new document...");
      // You can choose to create a new user document here if appropriate
      // const newUserRef = doc(collection(db, 'users'));
      // await setDoc(newUserRef, { uid: uid, tokens: [refreshToken], ...otherInitialData });
    } else {
      // Assuming there's only one user with the given uid
      const userDocRef = querySnapshot.docs[0].ref;

    // Update Firestore with the new refresh token
    await updateDoc(userDocRef, {
      tokens: arrayUnion(refreshToken)
    });
  }

    // Check for email verification
    if (!auth2.currentUser.emailVerified) {
      console.log("Need to verify email");
      res.send("You need to verify your email");
    } else {
      const haveDetails = await CheckDetails();
      const havePreferences = await CheckPreferences();
      if (haveDetails === "1" && havePreferences === "1") {
        console.log("Transfer to Home Page");
        res.send({
          success: true,
          accessToken: accessToken,
          refreshToken: refreshToken,
        });
      } else if (haveDetails === "0") {
        console.log("Transfer to DetailsScreen");
        res.send({
          success: false,
          userId: userRecord.user.uid,
          accessToken: accessToken,
          refreshToken: refreshToken,
          tranferTo: "DetailsScreen",
        });
      } else if (havePreferences === "0") {
        console.log("Transfer to Preferences");
        res.send({
          success: false,
          userId: userRecord.user.uid,
          accessToken: accessToken,
          refreshToken: refreshToken,
          tranferTo: "Preferences",
        });
      }
    }
  } catch (error) {
    console.log("Incorrect details");
    console.log(error);
    res.send(`Incorrect details ${password} and url: ${email}`);
  }
};


const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    {
      uid: userId,
    },
    process.env.TOKEN_SECRET,
    {
      expiresIn: process.env.TOKEN_EXPIRES_IN,
    }
  );

  const refreshToken = jwt.sign(
    {
      uid: userId,
      salt: Math.random(),
    },
    process.env.REFRESH_TOKEN_SECRET
  );

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
  };
};

const signInGoogle = async (req, res) => {
  try {
    const { user } = req.body;
    const userUid = user.uid;
    const email = user.email;

    // Check if the user already exists in the database
    const usersCollection = collection(db, "users");
    const userQuery = query(usersCollection, where("uid", "==", userUid));
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
      res.status(200).json({ success: false, message: "User already exists" });
    }
  } catch (error) {
    console.error("Error signing in with Google", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const googleSignIn = async (req, res) => {
  try {
    console.log("Google sign in request received", req.body.credentialResponse);
    console.log("Google client ID:", process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: req.body.credentialResponse,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload?.email;

    if (email) {
      const usersCollection = collection(db, "users");
      const userQuery = query(usersCollection, where("email", "==", email));
      const userQuerySnapshot = await getDocs(userQuery);

      let user;
      if (userQuerySnapshot.empty) {
        user = {
          email: email,
          imgUrl: payload?.picture,
          name: payload?.name,
          userType: "google",
          tokens: []
        };
        const userDoc = await addDoc(usersCollection, user);
        user._id = userDoc.id; // Set the user ID to the document ID
      } else {
        user = userQuerySnapshot.docs[0].data();
        user._id = userQuerySnapshot.docs[0].id; // Get the document ID
      }

      const { accessToken, refreshToken } = generateTokens(user._id);

      // Update the user's tokens in the database
      await addDoc(usersCollection, user);

      return res.status(200).send({
        accessToken: accessToken,
        refreshToken: refreshToken,
        email: email,
        _id: user._id,
        imgUrl: user.imgUrl,
        message: "Login successful"
      });
    }
  } catch (error) {
    return res.status(400).send(error.message);
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.body;
  auth2 = getAuth();
  console.log("Email:", email);
  try {
    const isEmailInUse = await checkEmailInUse(email);
    console.log("isEmailInUse:", isEmailInUse);

    if (isEmailInUse) {
      sendPasswordResetEmail(auth2, email)
        .then(() => {
          // Password reset email sent successfully
          console.log(
            "If the email address exists in our system, a password reset email will be sent"
          );
          res.send(
            "If the email address exists in our system, a password reset email will be sent"
          );
        })
        .catch((error) => {
          // An error occurred while sending the password reset email
          console.error(error);
        });
    } else {
      res.send(
        "If the email address exists in our system, a password reset email will be sent"
      );
    }
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).send("An error occurred while checking the email");
  }
  console.log(email);
};

const refresh = async (req, res) => {
  // Extract token from HTTP header
  console.log("Refresh token request received");
  const authHeader = req.headers["authorization"];
  const refreshTokenOrig = authHeader && authHeader.split(" ")[1];

  if (refreshTokenOrig == null) {
    return res.status(401).send("Missing token");
  }

  // Verify token
  jwt.verify(
    refreshTokenOrig,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, userInfo) => {
      if (err) {
        return res.status(403).send("Invalid token");
      }

      try {
        // Query Firestore for the user document using the UID
        const usersQuery = query(collection(db, 'users'), where('uid', '==', userInfo.uid));
        const querySnapshot = await getDocs(usersQuery);

        if (querySnapshot.empty) {
          return res.status(403).send("User not found");
        }

        // Assuming there's only one user with the given UID
        const userDocRef = querySnapshot.docs[0].ref;
        const userDoc = querySnapshot.docs[0].data();

        if (!userDoc.tokens || !userDoc.tokens.includes(refreshTokenOrig)) {
          // If the specific refresh token isn't in the array, clear all tokens (optional)
          await updateDoc(userDocRef, { tokens: [] });
          return res.status(403).send("Invalid token");
        }

        // Generate new access token and refresh token
        const { accessToken, refreshToken } = generateTokens(userInfo.uid);

        // Update Firestore with the new refresh token, removing the old one
        const newTokens = userDoc.tokens
          .filter(token => token !== refreshTokenOrig)
          .concat(refreshToken);
        await updateDoc(userDocRef, { tokens: newTokens });

        // Return new access token & refresh token
        return res.status(200).send({
          accessToken: accessToken,
          refreshToken: refreshToken,
        });
      } catch (error) {
        console.log(error);
        return res.status(400).send(error.message);
      }
    }
  );
};


//TODO: Add the Maps function
const Maps = async (req, res) => {
  const { place_id } = req.params;
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = response.data;
    res.json(data);
  } catch (error) {
    console.error("Error fetching place details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const CheckDetails = async (req, res) => {
  try {
    // Ensure user is authenticated
    const auth2 = getAuth();

    // Get the UID of the authenticated user
    const uid = auth2.currentUser.uid;

    // Assuming 'users' is the collection name where your user data resides
    const usersCollection = collection(db, "users");

    // Query the user document by uid
    const q = query(usersCollection, where("uid", "==", uid));

    // Get documents that match the query
    const querySnapshot = await getDocs(q);

    // If no documents match the query
    if (querySnapshot.empty) {
      return { message: "No user found with the provided UID" };
    }

    // Assuming there's only one document for each user
    const userData = querySnapshot.docs[0].data();
    const haveDetails = userData.haveDetails;

    if (haveDetails === "1" || haveDetails === "0") {
      // 'haveDetails' field is either '1' or '0'
      return haveDetails;
    } else {
      // 'haveDetails' field is neither '1' nor '0'
      return { message: "Invalid value for 'haveDetails' field" };
    }
  } catch (error) {
    // Handle errors
    console.error("Error checking details:", error);
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
    const usersCollection = collection(db, "users");

    // Query the user document by uid
    const q = query(usersCollection, where("uid", "==", uid));

    // Get documents that match the query
    const querySnapshot = await getDocs(q);

    // If no documents match the query
    if (querySnapshot.empty) {
      return { message: "No user found with the provided UID" };
    }

    // Assuming there's only one document for each user
    const userData = querySnapshot.docs[0].data();
    const havePreferences = userData.havePreferences;

    if (havePreferences === "1" || havePreferences === "0") {
      // 'haveDetails' field is either '1' or '0'
      return havePreferences;
    } else {
      // 'haveDetails' field is neither '1' nor '0'
      return { message: "Invalid value for 'haveDetails' field" };
    }
  } catch (error) {
    // Handle errors
    console.error("Error checking details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  LoginWithEmailAndPassword,
  signInGoogle,
  resetPassword,
  Maps,
  refresh,
  googleSignIn,
};
