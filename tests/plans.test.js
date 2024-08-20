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
  jest.setTimeout(30000); 
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
}, 30000); 

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
  }, 30000); 

  test('GET /getUserPlanIds', async () => {
    const res = await request(app)
      .get('/getUserPlanIds')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user: { uid: testUser.uid } });
    console.log('getUserPlanIds response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.planIds).toContain(planId);
  }, 30000); 

  test('POST /getPlanById', async () => {
    const res = await request(app)
      .post('/getPlanById')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: planId });
    console.log('getPlanById response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.destination).toBe(testPlan.destination);
  }, 30000); 


  test('POST /editActivity - valid data', async () => {
    const editActivityRes = await request(app)
      .post('/editActivity')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: planId, 
        day: "0", 
        activity: "0" 
      });
  
    console.log('editActivity response:', editActivityRes.body);
  
    expect(editActivityRes.statusCode).toBe(200);
    expect(editActivityRes.body.additionalActivities).toBeDefined();
    expect(Array.isArray(editActivityRes.body.additionalActivities)).toBe(true);
  }, 30000); 
  

  
  test('POST /replaceActivity', async () => {
    const replaceActivityRes = await request(app)
      .post('/replaceActivity')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: planId,
        dayIndex: 0, 
        activityIndex: 0, 
        newActivity: "Eiffel Tower Visit"
      });
    console.log('replaceActivity response:', replaceActivityRes.body);
    expect(replaceActivityRes.statusCode).toBe(200);
  }, 30000);

  // Add test for deleteActivity
  test('POST /deleteActivity', async () => {
    const deleteActivityRes = await request(app)
      .post('/deleteActivity')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: planId,
        dayIndex: 0, 
        activityIndex: 0 
      });
    console.log('deleteActivity response:', deleteActivityRes.body);
    expect(deleteActivityRes.statusCode).toBe(200);
    expect(deleteActivityRes.text).toBe("Activity deleted successfully");
  }, 30000);

  test('POST /FindRestaurantNearBy', async () => {
    const findRestaurantRes = await request(app)
      .post('/FindRestaurantNearBy')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: planId,
        day: "0", 
        activity: "0", 
        mealType: "Lunch"
      });
    console.log('FindRestaurantNearBy response:', findRestaurantRes.body);
    expect(findRestaurantRes.statusCode).toBe(200);
    expect(Array.isArray(findRestaurantRes.body)).toBe(true);
    expect(findRestaurantRes.body.length).toBeGreaterThan(0);
  }, 30000);

  test('POST /addRestaurantToPlan', async () => {
    const addRestaurantRes = await request(app)
      .post('/addRestaurantToPlan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: planId,
        dayIndex: 0, 
        activityIndex: 0, 
        restaurantName: "Le Jules Verne",
        placeId: "ChIJAQquYc1v5kcRLKslDuENAxg" 
      });
    console.log('addRestaurantToPlan response:', addRestaurantRes.body);
    expect(addRestaurantRes.statusCode).toBe(200);
    expect(addRestaurantRes.text).toBe("Restaurant added to plan successfully");
  }, 30000);

  test('POST /deletePlan', async () => {
    const res = await request(app)
      .post('/deletePlan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: planId });
    console.log('deletePlan response:', res.body);
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Plan deleted successfully");
  }, 30000); 
});
