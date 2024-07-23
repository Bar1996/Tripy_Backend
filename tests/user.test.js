const request = require('supertest');
const appInit = require('../App');
const { collection, getDocs, query, where, doc, deleteDoc, updateDoc } = require('firebase/firestore');
const { db } = require('../firebaseConfig');
const admin = require('firebase-admin');

// Initialize Firebase Admin


const testUser = {
  uid: "test-uid",
  email: "test@example.com",
  password: "password1234",
  verifynumber: "12345",
  name: "Test User",
  gender: "Male",
  birthday: "1990-01-01"
};

let app;
let accessToken = "";
let refreshToken = "";

beforeAll(async () => {
    jest.setTimeout(30000);
    // Initialize the Express app
    app = await appInit();
    console.log('beforeAll');
    // Clean up any existing test data
    const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
    if (!userQuerySnapshot.empty) {
      const userDoc = userQuerySnapshot.docs[0].ref;
      await deleteDoc(userDoc);
    }
  
    // Validate email
    const emailRes = await request(app).post('/post_email').send({
      email: testUser.email
    });
    expect(emailRes.statusCode).toBe(200);
    expect(emailRes.text).toBe('Email is available');
  
    // Validate password
    const passwordRes = await request(app).post('/post_password').send({
      password: testUser.password
    });
    expect(passwordRes.statusCode).toBe(200);
    expect(passwordRes.text).toBe('Password received');
  
    // Register the test user
    const signupRes = await request(app).post('/signup').send({
      email: testUser.email,
      password: testUser.password,
      name: testUser.name,
      gender: testUser.gender,
      birthday: testUser.birthday
    });
    expect(signupRes.statusCode).toBe(200);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.userId).toBeDefined();
  
    // Manually verify the user's email
    await admin.auth().updateUser(signupRes.body.userId, {
      emailVerified: true
    });
  
    // Check that the user is in the database
    const newUserQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
    expect(newUserQuerySnapshot.empty).toBe(false);
  
    // Login the test user
    const loginRes = await request(app).post('/login').send({
      email: testUser.email,
      password: testUser.password
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
    accessToken = loginRes.body.accessToken;
    refreshToken = loginRes.body.refreshToken;
  }, 30000);

afterAll(async () => {
  console.log('afterAll');
  // Clean up any test data
  const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
  if (!userQuerySnapshot.empty) {
    const userDoc = userQuerySnapshot.docs[0].ref;
    await deleteDoc(userDoc);
  }
});

describe('User Controller Tests', () => {
  test('POST /SendMail', async () => {
    const res = await request(app)
      .post('/SendMail')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid }, email: testUser.email });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Verification email sent');
  });

  test('POST /addDetails', async () => {
    const res = await request(app)
      .post('/addDetails')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        user: { uid: testUser.uid },
        name: 'Test User',
        gender: 'Male',
        birthday: '1990-01-01'
      });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Details added successfully');
  });

  test('POST /addPreferences', async () => {
    const res = await request(app)
      .post('/addPreferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        user: { uid: testUser.uid },
        preferences: { likes: ['coding', 'reading'] }
      });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Preferences added successfully');
  });

  test('GET /getDetails', async () => {
    const res = await request(app)
      .get('/getDetails')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      name: 'Test User',
      gender: 'Male',
      dateOfBirth: '1990-01-01',
      email: testUser.email,
      userType: 'local' // Adjust according to your schema
    });
  });

  test('GET /getPreferences', async () => {
    const res = await request(app)
      .get('/getPreferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual( { likes: ['coding', 'reading'] } );
  });

  test('GET /check', async () => {
    const res = await request(app)
      .get('/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Authenticated' });
  });
  test('POST /changePassword', async () => {
    const res = await request(app)
      .post('/changePassword')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        user: { uid: testUser.uid },
        currentPassword: 'password1234',
        newPassword: 'new-password'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Password updated successfully' });
  });

  test('GET /logout', async () => {
    const res = await request(app)
      .get('/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('logout successful');
    //login again after logout and apdate the tokens for the next tests
    const loginRes = await request(app).post('/login').send({
      email: testUser.email,
      password: 'new-password'
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
    accessToken = loginRes.body.accessToken;
    refreshToken = loginRes.body.refreshToken;
  });



  test('POST /deleteUserData', async () => {
    // Update the verifynumber in the database before running the test
    const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
    if (!userQuerySnapshot.empty) {
      const userDoc = userQuerySnapshot.docs[0].ref;
      await updateDoc(userDoc, { verifynumber: testUser.verifynumber });
    }

    const res = await request(app)
      .post('/deleteUserData')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid }, verifynumber: testUser.verifynumber });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('User data, plans, preferences, and authentication deleted successfully');
  });


});
