const { getAuth } = require('firebase/auth');
const {collection, addDoc, updateDoc, getDocs, doc, query, where, arrayUnion, getDoc} = require('firebase/firestore');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

const addPlan = async (req, res) => {
    try {
        // console.log('Request to add plan received');
        // if (!req.body.uid) {
        //     res.status(400).send('uid is required');
        //     return;
        // }

        const uid = req.body.user.uid; // Unique identifier for the user
        const destination = req.body.destination; // Destination from request body
        const arrivalDate = req.body.arrivalDate; // Arrival date from request body
        const departureDate = req.body.departureDate; // Departure date from request body
        const social = req.body.social; // Social from request body

        // Check if user exists in 'users' collection
        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            res.status(404).send('User not found');
            return;
        }

        // Create new plan document in 'plans' collection
        const planDocRef = await addDoc(collection(db, 'plans'), {
            uid,
            destination,
            arrivalDate,
            departureDate,
            social
        });
        const planUid = planDocRef.id;

        // Get user document reference and data
        const userDocRef = userQuerySnapshot.docs[0].ref;
        const userData = userQuerySnapshot.docs[0].data();

        // Update user's document with the new plan UID
        if (userData.plans) {
            await updateDoc(userDocRef, {
                plans: arrayUnion(planUid)
            });
        } else {
            await updateDoc(userDocRef, {
                plans: [planUid]
            });
        }

        // Fetch preferences using preferences_uid from userData
        const preferencesDocRef = doc(db, 'preferences', userData.preferences_uid);
        const preferencesDoc = await getDoc(preferencesDocRef);
        const preferencesData = preferencesDoc.data();

        // Generate plan content and update the plan document
        const planContent = await generatePlan({
            uid: uid,
            gender: userData.gender,
            age: userData.age,
            preferences: preferencesData.preferences,
            destination: destination,
            arrivalDate: arrivalDate,
            departureDate: departureDate,
            social: social
        });
        

        if (Object.keys(planContent).length === 0) {
            console.error('Plan content generation failed or returned empty.');
            return res.status(500).send('Error generating plan content.');
        }
        
        await updateDoc(doc(db, 'plans', planUid), planContent);

        res.status(200).send('Plan added and generated successfully');
    } catch (error) {
        console.error('Error adding plan:', error);
        res.status(500).send('Error adding plan');
    }
};


const generatePlan = async ({ uid, gender, age, preferences, destination, arrivalDate, departureDate, social }) => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `I am ${gender} aged ${age}, I really like ${preferences.preferences}. // Ensure preferences are correctly accessed
  I am planning a vacation in ${destination} ${social}. I will be at the destination on ${arrivalDate} - ${departureDate}. 
  Create a travel plan for me for each day separately based on the ratings of the places on google maps 
  especially from users with the same age range and consider the seasons. 
      Please do not recommend me what to do and give me only place names for each day. 
      Make sure the names of the places are clear so that I can later find the places on Google Maps Places API. 
      Please do it in JSON format and send the JSON only!!! 
      Your response should follow the following template: 
      {
        "travelPlan": [
          {
            "day": "dd/mm/yy",
            "activities": [
              "PLACE NAME",
              "…",
              "…"
      `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    console.log(text);
    const fetchOrganizedData = await organizeData(text); // Now correctly waits for place IDs
    return fetchOrganizedData; // Make sure this returns the correct structure for Firestore
};
  
// This function now becomes async to handle fetching place IDs
async function organizeData(response) {
    const startIndex = response.indexOf("{");
    const endIndex = response.lastIndexOf("}") + 1;
    if (startIndex === -1 || endIndex === -1) {
      console.error("JSON data not found in response");
      return {};
    }

    const jsonData = response.substring(startIndex, endIndex);
  
    try {
      const data = JSON.parse(jsonData);
      // Assume data.travelPlan is an array of day objects with activities
      for (const day of data.travelPlan) {
        // Fetch place IDs for each activity asynchronously
        const activitiesWithPlaceIds = await Promise.all(day.activities.map(async (activity) => {
          return await getActivityPlaceId(activity);
        }));
        day.activities = activitiesWithPlaceIds.filter(id => id !== null); // Filter out null IDs
      }
  
      return data; // Now includes place IDs instead of names
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return {};
    }
}

  
  async function getActivityPlaceId(activity) {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      activity
    )}&key=${apiKey}`;
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].place_id;
      } else {
        console.error(`No place found for activity: ${activity}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching activity place ID:", error);
      return null;
    }
  }
  
  async function getTravelPlanPlaceIds(travelPlan) {
    const activitiesWithPlaceIds = [];
    for (const day of travelPlan) {
      const activities = day.activities;
      const placeIds = await Promise.all(activities.map(getActivityPlaceId));
      activitiesWithPlaceIds.push({ date: day.date, activities: placeIds });
    }
    console.log(activitiesWithPlaceIds);
    return activitiesWithPlaceIds;
  }

  const getUserPlanIds = async (req, res) => {
    try {
        // if (!req.body.uid) {
        //     return res.status(400).send('uid is required');
        // }

        const uid = req.body.user.uid;

        const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (userQuerySnapshot.empty) {
            return res.status(404).send('User not found');
        }

        const userData = userQuerySnapshot.docs[0].data();
        if (!userData.plans || userData.plans.length === 0) {
            return res.status(404).send('No plans found');
        }

        res.status(200).json({ planIds: userData.plans });
    } catch (error) {
        console.error('Error getting plan IDs:', error);
        res.status(500).send('Error getting plan IDs');
    }
};

const getPlanById = async (req, res) => {
    try {
        const  planId  = req.body.planId; 
        console.log("planId: ",planId);

        if (!planId) {
            return res.status(400).send('planId is required');
        }

        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (!planDoc.exists()) {
            return res.status(404).send('Plan not found');
        }

        res.status(200).json(planDoc.data());
    } catch (error) {
        console.error('Error getting plan:', error);
        res.status(500).send('Error getting plan');
    }
};

  module.exports = {addPlan, getUserPlanIds, getPlanById};