const { getAuth } = require('firebase/auth');
const {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  arrayUnion,
  getDoc,
  deleteDoc,
  arrayRemove,
} = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

const addPlan = async (req, res) => {
  try {
    const uid = req.body.user.uid;
    const destination = req.body.destination;
    const arrivalDate = req.body.arrivalDate;
    const departureDate = req.body.departureDate;
    const social = req.body.social;
    const loadLevel = req.body.loadLevel;
    const userQuerySnapshot = await getDocs(
      query(collection(db, 'users'), where('uid', '==', uid))
    );
    if (userQuerySnapshot.empty) {
      return res.status(404).send('User not found');
    }
    const planDocRef = await addDoc(collection(db, 'plans'), {
      uid,
      destination,
      arrivalDate,
      departureDate,
      social,
    });
    const planUid = planDocRef.id;
    const userDocRef = userQuerySnapshot.docs[0].ref;
    const userData = userQuerySnapshot.docs[0].data();
    if (userData.plans) {
      await updateDoc(userDocRef, {
        plans: arrayUnion(planUid),
      });
    } else {
      await updateDoc(userDocRef, {
        plans: [planUid],
      });
    }
    const preferencesDocRef = doc(db, 'preferences', userData.preferences_uid);
    const preferencesDoc = await getDoc(preferencesDocRef);
    const preferencesData = preferencesDoc.data();
    const planContent = await generatePlan({
      uid,
      gender: userData.gender,
      age: userData.age,
      preferences: preferencesData.preferences,
      destination,
      arrivalDate,
      departureDate,
      social,
      loadLevel,
    });
    if (Object.keys(planContent).length === 0) {
      return res.status(500).send('Error generating plan content.');
    }
    await updateDoc(doc(db, 'plans', planUid), planContent);
    res
      .status(200)
      .json({
        planId: planUid,
        message: 'Plan added and generated successfully',
      });
  } catch (error) {
    res.status(500).send('Error adding plan');
  }
};

const generatePlan = async ({
  gender,
  age,
  preferences,
  destination,
  arrivalDate,
  departureDate,
  social,
  loadLevel,
}) => {
  const model = genAI.getTextModel('models/text-bison-001');
  let numberOfActivities = loadLevel === 2 ? 2 : loadLevel === 4 ? 4 : 3;
  const prompt = `I am ${gender} aged ${age}, I really like ${preferences.preferences}.
I am planning a vacation in ${destination} ${social}. I will be at the destination from ${arrivalDate} to ${departureDate}.
Create a travel plan for me for each day separately based on the ratings of the places on Google Maps,
especially from users with the same age range and consider the seasons.
Please do not recommend me what to do and give me only place names for each day.
Make sure the names of the places are clear so that I can later find the places on Google Maps Places API.
Generate ${numberOfActivities} activities per day.
Ensure that the plan includes both the day of arrival and the day of departure.
Please provide the response in JSON format as follows:
{ "travelPlan": [ { "day": "dd/mm/yy", "activities": [ "PLACE NAME", "PLACE NAME" ] } ] }`;
  const response = await model.generateText({ prompt });
  if (!response.candidates || !response.candidates.length) {
    return {};
  }
  const text = response.candidates[0].output;
  return await organizeData(text, destination);
};

async function organizeData(response, destination) {
  const startIndex = response.indexOf('{');
  const endIndex = response.lastIndexOf('}') + 1;
  if (startIndex === -1 || endIndex === -1) {
    return {};
  }
  try {
    const data = JSON.parse(response.substring(startIndex, endIndex));
    for (const day of data.travelPlan) {
      const activitiesWithPlaceIds = await Promise.all(
        day.activities.map(
          async (activity) => await getActivityPlaceId(activity, destination)
        )
      );
      day.activities = activitiesWithPlaceIds.filter((id) => id !== null);
    }
    return data;
  } catch {
    return {};
  }
}

async function getActivityPlaceId(activity, destination) {
  const query = `${activity} in ${destination}`;
  const apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${apiKey}`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data.results && data.results.length > 0
      ? data.results[0].place_id
      : null;
  } catch {
    return null;
  }
}

const getUserPlanIds = async (req, res) => {
  try {
    const uid = req.body.user.uid;
    const userQuerySnapshot = await getDocs(
      query(collection(db, 'users'), where('uid', '==', uid))
    );
    if (userQuerySnapshot.empty) {
      return res.status(404).send('User not found');
    }
    const userData = userQuerySnapshot.docs[0].data();
    if (!userData.plans || userData.plans.length === 0) {
      return res.status(404).send('No plans found');
    }
    res.status(200).json({ planIds: userData.plans });
  } catch {
    res.status(500).send('Error getting plan IDs');
  }
};

const getPlanById = async (req, res) => {
  try {
    const planId = req.body.planId;
    if (!planId) {
      return res.status(400).send('planId is required');
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    res.status(200).json(planDoc.data());
  } catch {
    res.status(500).send('Error getting plan');
  }
};

const deletePlan = async (req, res) => {
  try {
    const planId = req.body.planId;
    if (!planId) {
      return res.status(400).send('planId is required');
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const uid = planData.uid;
    if (!uid) {
      return res.status(400).send('Plan does not have a valid uid');
    }
    await deleteDoc(doc(db, 'plans', planId));
    const usersCollection = collection(db, 'users');
    const userQuerySnapshot = await getDocs(
      query(usersCollection, where('uid', '==', uid))
    );
    if (userQuerySnapshot.empty) {
      return res.status(404).send('User document not found');
    }
    const userDocRef = userQuerySnapshot.docs[0].ref;
    await updateDoc(userDocRef, {
      plans: arrayRemove(planId),
    });
    res.status(200).send('Plan deleted successfully');
  } catch {
    res.status(500).send('Error deleting plan');
  }
};

const editActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const day = req.body.day;
    const activity = req.body.activity;
    if (!planId || !day || !activity) {
      return res.status(400).send('planId, day, and activity are required');
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const usersCollection = collection(db, 'users');
    const userQuerySnapshot = await getDocs(
      query(usersCollection, where('uid', '==', planData.uid))
    );
    if (userQuerySnapshot.empty) {
      return res.status(404).send('User not found');
    }
    const userDoc = userQuerySnapshot.docs[0];
    const userData = userDoc.data();
    const preferencesDoc = await getDoc(
      doc(db, 'preferences', userData.preferences_uid)
    );
    if (!preferencesDoc.exists()) {
      return res.status(404).send('Preferences not found');
    }
    const preferencesData = preferencesDoc.data();
    const activities = planData.travelPlan[day].activities;
    activities.push(activity);
    const allActivities = planData.travelPlan.flatMap(
      (dayPlan) => dayPlan.activities
    );
    const allActivityNames = await Promise.all(
      allActivities.map(async (placeId) => {
        try {
          const placeDetails = await getActivityNameFromPlaceId(placeId);
          return placeDetails.name;
        } catch {
          return null;
        }
      })
    );
    const filteredActivityNames = allActivityNames.filter(
      (name) => name !== null
    );
    const model = genAI.getTextModel('models/text-bison-001');
    const prompt = `I am editing an activity for a user. The user's preferences are: ${JSON.stringify(
      preferencesData.preferences
    )}.
The current activities for the day are: ${activities.join(
      ', '
    )}. The destination is ${planData.destination}.
The existing activities in the plan are: ${filteredActivityNames.join(', ')}.
Please suggest 3 additional activities that are suitable considering the user's preferences and the current activities.
The format should be a JSON array of activity names.`;
    const response = await model.generateText({ prompt });
    if (!response.candidates || !response.candidates.length) {
      return res.status(500).send('No text candidates returned');
    }
    const text = response.candidates[0].output;
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']') + 1;
    if (startIndex === -1 || endIndex === -1) {
      return res.status(500).send('Valid JSON array not found');
    }
    const jsonResponse = text.substring(startIndex, endIndex);
    const additionalActivities = JSON.parse(jsonResponse);
    const newActivitiesWithPlaceIds = await Promise.all(
      additionalActivities.map(async (act) => {
        try {
          return await getActivityPlaceId(act, planData.destination);
        } catch {
          return null;
        }
      })
    );
    const filteredNewActivities = newActivitiesWithPlaceIds.filter(
      (id) => id !== null && !allActivities.includes(id)
    );
    res.status(200).json({ additionalActivities: filteredNewActivities });
  } catch {
    res.status(500).send('Error editing activity');
  }
};

async function getActivityNameFromPlaceId(placeId) {
  const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  if (data.result && data.result.name) {
    return { name: data.result.name };
  } else {
    throw new Error();
  }
}

const replaceActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const dayIndex = req.body.dayIndex;
    const activityIndex = req.body.activityIndex;
    const newActivityName = req.body.newActivity;
    if (
      !planId ||
      dayIndex === undefined ||
      activityIndex === undefined ||
      !newActivityName
    ) {
      return res
        .status(400)
        .send(
          'planId, dayIndex, activityIndex, and newActivityName are required'
        );
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;
    if (!travelPlan[dayIndex]) {
      return res.status(404).send('Day not found in travel plan');
    }
    if (
      !travelPlan[dayIndex].activities ||
      !travelPlan[dayIndex].activities[activityIndex]
    ) {
      return res.status(404).send('Activity not found in travel plan');
    }
    travelPlan[dayIndex].activities[activityIndex] = newActivityName;
    await updateDoc(doc(db, 'plans', planId), { travelPlan });
    res.status(200).send('Activity replaced successfully');
  } catch {
    res.status(500).send('Error replacing activity');
  }
};

const deleteActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const dayIndex = req.body.dayIndex;
    const activityIndex = req.body.activityIndex;
    if (!planId || dayIndex === undefined || activityIndex === undefined) {
      return res
        .status(400)
        .send('planId, dayIndex, and activityIndex are required');
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;
    if (!travelPlan[dayIndex]) {
      return res.status(404).send('Day not found in travel plan');
    }
    if (
      !travelPlan[dayIndex].activities ||
      !travelPlan[dayIndex].activities[activityIndex]
    ) {
      return res.status(404).send('Activity not found in travel plan');
    }
    travelPlan[dayIndex].activities.splice(activityIndex, 1);
    const parseDate = (dateStr) => {
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return new Date(`20${y}-${m}-${d}`);
      } else {
        return new Date(dateStr);
      }
    };
    const dayDate = parseDate(travelPlan[dayIndex].day);
    const arrivalDate = parseDate(planData.arrivalDate);
    const departureDate = parseDate(planData.departureDate);
    if (travelPlan[dayIndex].activities.length === 0) {
      if (dayDate.getTime() === arrivalDate.getTime()) {
        planData.arrivalDate =
          travelPlan.length > 1
            ? travelPlan[1]?.day
              ? parseDate(travelPlan[1].day).toISOString().split('T')[0]
              : null
            : null;
      }
      if (dayDate.getTime() === departureDate.getTime()) {
        planData.departureDate =
          travelPlan.length > 0
            ? travelPlan[travelPlan.length - 2]?.day
              ? parseDate(travelPlan[travelPlan.length - 2].day)
                  .toISOString()
                  .split('T')[0]
              : null
            : null;
      }
      travelPlan.splice(dayIndex, 1);
    }
    await updateDoc(doc(db, 'plans', planId), {
      travelPlan,
      arrivalDate: planData.arrivalDate,
      departureDate: planData.departureDate,
    });
    res.status(200).send('Activity deleted successfully');
  } catch {
    res.status(500).send('Error deleting activity');
  }
};

const FindRestaurantNearBy = async (req, res) => {
  try {
    const { planId, day, activity, mealType } = req.body;
    if (!planId || !day || !activity || !mealType) {
      return res
        .status(400)
        .send('planId, day, activity, and mealType are required');
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;
    if (!travelPlan[day]) {
      return res.status(404).send('Day not found in travel plan');
    }
    if (!travelPlan[day].activities || !travelPlan[day].activities[activity]) {
      return res.status(404).send('Activity not found in travel plan');
    }
    const activityLocation = travelPlan[day].activities[activity].location;
    const activities = Object.keys(travelPlan[day].activities);
    const currentActivityIndex = activities.indexOf(activity);
    let nextActivityLocation = null;
    if (
      currentActivityIndex !== -1 &&
      currentActivityIndex < activities.length - 1
    ) {
      const nextActivity = activities[currentActivityIndex + 1];
      nextActivityLocation = travelPlan[day].activities[nextActivity].location;
    }
    const model = genAI.getTextModel('models/text-bison-001');
    const prompt = `I am finding 3 restaurants near ${activity} for a user (Max of 25 minutes of walk). The destination is ${
      planData.destination
    }. The meal type is ${mealType}.
Please suggest 3 restaurants that are suitable considering the activity location ${activityLocation}${
      nextActivityLocation
        ? ` and the next activity location ${nextActivityLocation}`
        : ''
    }.
Please give restaurants with high rating.
The format should be a JSON array of restaurant names.`;
    const responseModel = await model.generateText({ prompt });
    if (!responseModel.candidates || !responseModel.candidates.length) {
      return res.status(500).send('No text candidates returned');
    }
    const text = responseModel.candidates[0].output;
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']') + 1;
    if (startIndex === -1 || endIndex === -1) {
      return res.status(500).send('Valid JSON array not found in response');
    }
    const jsonResponse = text.substring(startIndex, endIndex);
    const restaurantNames = JSON.parse(jsonResponse);
    const restaurantsWithPlaceIds = await Promise.all(
      restaurantNames.map(async (restaurantName) => {
        try {
          const placeId = await getActivityPlaceId(
            restaurantName,
            planData.destination
          );
          return placeId ? { name: restaurantName, placeId } : null;
        } catch {
          return null;
        }
      })
    );
    const validRestaurants = restaurantsWithPlaceIds.filter((r) => r !== null);
    res.status(200).json(validRestaurants);
  } catch {
    res.status(500).send('Internal Server Error');
  }
};

const addRestaurantToPlan = async (req, res) => {
  try {
    const { planId, dayIndex, activityIndex, restaurantName, placeId } =
      req.body;
    if (
      !planId ||
      dayIndex === undefined ||
      activityIndex === undefined ||
      !restaurantName ||
      !placeId
    ) {
      return res
        .status(400)
        .send(
          'planId, dayIndex, activityIndex, restaurantName, and placeId are required'
        );
    }
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return res.status(404).send('Plan not found');
    }
    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;
    if (!travelPlan[dayIndex]) {
      return res.status(404).send('Day not found in travel plan');
    }
    if (
      !travelPlan[dayIndex].activities ||
      travelPlan[dayIndex].activities[activityIndex] === undefined
    ) {
      return res.status(404).send('Activity not found in travel plan');
    }
    travelPlan[dayIndex].activities.splice(activityIndex + 1, 0, placeId);
    await updateDoc(doc(db, 'plans', planId), { travelPlan });
    res.status(200).send('Restaurant added to plan successfully');
  } catch {
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  addPlan,
  getUserPlanIds,
  getPlanById,
  deletePlan,
  editActivity,
  replaceActivity,
  deleteActivity,
  FindRestaurantNearBy,
  addRestaurantToPlan,
};
