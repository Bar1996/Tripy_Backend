const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');


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

module.exports = {checkEmailInUse};