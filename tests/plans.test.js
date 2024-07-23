const request = require('supertest');
const appInit = require('../App');
const { collection, getDocs, query, where, doc, deleteDoc } = require('firebase/firestore');
const { db } = require('../firebaseConfig');
const admin = require('firebase-admin');

const testUser = {
  uid: "test-uid",
  email: "test@example.com",
  password: "password1234",
  name: "Test User",
  gender: "Male",
  birthday: "1990-01-01"
};

const testPlan = {
  destination: "Paris",
  arrivalDate: "2024-08-01",
  departureDate: "2024-08-10",
  social: "Family",
  loadLevel: 3
};

const testPreferences = {
  preferences: ["museum", "park", "restaurant"]
};

let app;
let accessToken = "";
let planId = "";

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

  // Add preferences for the test user
  const addPreferencesRes = await request(app)
    .post('/addPreferences')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      user: { uid: testUser.uid },
      preferences: testPreferences.preferences
    });
  expect(addPreferencesRes.statusCode).toBe(200);
  expect(addPreferencesRes.text).toBe('Preferences added successfully');
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
  const userRecord = await admin.auth().getUserByEmail(testUser.email).catch(() => null);
  if (userRecord) {
    await admin.auth().deleteUser(userRecord.uid);
  }
});

describe('Plans Controller Tests', () => {
  test('POST /addPlan', async () => {
    const res = await request(app)
      .post('/addPlan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        user: { uid: testUser.uid },
        destination: testPlan.destination,
        arrivalDate: testPlan.arrivalDate,
        departureDate: testPlan.departureDate,
        social: testPlan.social,
        loadLevel: testPlan.loadLevel
      });
    console.log('addPlan response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.planId).toBeDefined();
    expect(res.body.message).toBe("Plan added and generated successfully");
    planId = res.body.planId;
  }, 30000); // Set timeout to 30 seconds

  test('GET /getUserPlanIds', async () => {
    const res = await request(app)
      .get('/getUserPlanIds')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid } });
    console.log('getUserPlanIds response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.planIds).toContain(planId);
  }, 30000); // Set timeout to 30 seconds

  test('POST /getPlanById', async () => {
    const res = await request(app)
      .post('/getPlanById')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: planId });
    console.log('getPlanById response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.destination).toBe(testPlan.destination);
  }, 30000); // Set timeout to 30 seconds

  test('POST /deletePlan', async () => {
    const res = await request(app)
      .post('/deletePlan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: planId });
    console.log('deletePlan response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Plan deleted successfully");
  }, 30000); // Set timeout to 30 seconds
});
