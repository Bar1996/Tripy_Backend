const request = require('supertest');
const appInit = require('../App');
const { collection, getDocs, query, where, doc, deleteDoc } = require('firebase/firestore');
const { db } = require('../firebaseConfig');
const admin = require('firebase-admin');
const { checkEmailInUse } = require('../helpers/checkEmailInUse');



const testUser = {
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
  jest.setTimeout(30000); 
  app = await appInit();
  console.log('beforeAll');
  // Clean up any existing test data
  const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
  if (!userQuerySnapshot.empty) {
    const userDoc = userQuerySnapshot.docs[0].ref;
    await deleteDoc(userDoc);
  }
});

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

describe('Signup Controller Tests', () => {
  test('POST /post_email', async () => {
    const res = await request(app).post('/post_email').send({
      email: testUser.email
    });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Email is available');
  }, 30000); 

  test('POST /post_password', async () => {
    const res = await request(app).post('/post_password').send({
      password: testUser.password
    });
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Password received');
  }, 30000); 

  test('POST /signup', async () => {
    const res = await request(app).post('/signup').send({
      email: testUser.email,
      password: testUser.password,
      name: testUser.name,
      gender: testUser.gender,
      birthday: testUser.birthday
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.userId).toBeDefined();

    const newUserQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', testUser.email)));
    expect(newUserQuerySnapshot.empty).toBe(false);
  }, 30000); 

  test('GET /wake', async () => {
    const res = await request(app).get('/wake').send();
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('awake');
  }, 30000); 
});
