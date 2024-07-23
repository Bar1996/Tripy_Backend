const request = require('supertest');
const appInit = require('../App');
const { collection, getDocs, query, where, doc, deleteDoc, updateDoc } = require('firebase/firestore');
const { db } = require('../firebaseConfig');
const admin = require('firebase-admin');



let testUser = {
  email: "test@example.com",
  password: "password1234",
  name: "Test User",
  gender: "Male",
  birthday: "1990-01-01"
};

let app;
let accessToken = "";
let refreshToken = "";

beforeAll(async () => {
  jest.setTimeout(30000); // Set timeout to 30 seconds
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
  console.log('signupRes:', signupRes.body);

  // update testUser with the uid 
  testUser.uid = signupRes.body.userId;

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
}, 30000); // Set timeout to 30 seconds

afterAll(async () => {
  console.log('afterAll');
  // Clean up any test data
  const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
  if (!userQuerySnapshot.empty) {
    const userDoc = userQuerySnapshot.docs[0].ref;
    await deleteDoc(userDoc);
  }
  // Delete the user from Firebase Auth
  console.log('Deleting user:', testUser.uid);
  await admin.auth().deleteUser(testUser.uid);
});

describe('Auth Controller Tests', () => {
  test('POST /login', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  }, 30000); // Set timeout to 30 seconds

  test('POST /resetPass', async () => {
    const res = await request(app)
      .post('/resetPass')
      .send({ email: testUser.email });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('If the email address exists in our system, a password reset email will be sent');
  }, 30000); // Set timeout to 30 seconds

  test('GET /refresh', async () => {
    const res = await request(app)
      .get('/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  }, 30000); // Set timeout to 30 seconds
});