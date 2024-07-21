const { getAuth } = require("firebase/auth");
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
} = require("firebase/firestore");
const admin = require("firebase-admin");
const { db } = require("../firebaseConfig.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

const addPlan = async (req, res) => {
  try {
  

    const uid = req.body.user.uid; // Unique identifier for the user
    console.log("uid in plans:", uid);
    const destination = req.body.destination; // Destination from request body
    const arrivalDate = req.body.arrivalDate; // Arrival date from request body
    const departureDate = req.body.departureDate; // Departure date from request body
    const social = req.body.social; // Social from request body
    const loadLevel = req.body.loadLevel; // Load level from request body

    // Check if user exists in 'users' collection
    const userQuerySnapshot = await getDocs(
      query(collection(db, "users"), where("uid", "==", uid))
    );
    if (userQuerySnapshot.empty) {
      res.status(404).send("User not found");
      return;
    }

    // Create new plan document in 'plans' collection
    const planDocRef = await addDoc(collection(db, "plans"), {
      uid,
      destination,
      arrivalDate,
      departureDate,
      social,
    });
    const planUid = planDocRef.id;

    // Get user document reference and data
    const userDocRef = userQuerySnapshot.docs[0].ref;
    const userData = userQuerySnapshot.docs[0].data();

    // Update user's document with the new plan UID
    if (userData.plans) {
      await updateDoc(userDocRef, {
        plans: arrayUnion(planUid),
      });
    } else {
      await updateDoc(userDocRef, {
        plans: [planUid],
      });
    }

    // Fetch preferences using preferences_uid from userData
    const preferencesDocRef = doc(db, "preferences", userData.preferences_uid);
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
      social: social,
      loadLevel: loadLevel,
    });

    if (Object.keys(planContent).length === 0) {
      console.error("Plan content generation failed or returned empty.");
      return res.status(500).send("Error generating plan content.");
    }
    

    await updateDoc(doc(db, "plans", planUid), planContent);

    res.status(200).json({ planId: planUid, message: "Plan added and generated successfully" });
  } catch (error) {
    console.error("Error adding plan:", error);
    res.status(500).send("Error adding plan");
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
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  console.log("loadLevel in generatePlan:", loadLevel, "Type:", typeof loadLevel);
  
  let numberOfActivities;
  switch (loadLevel) {
    case 2:
      numberOfActivities = 2;
      break;
    case 3:
      numberOfActivities = 3;
      break;
    case 4:
      numberOfActivities = 4;
      break;
    default:
      numberOfActivities = 3; // Default to 3 activities if loadLevel is not between 2 and 4
  }

  console.log("Number of activities:", numberOfActivities);

  const prompt = `I am ${gender} aged ${age}, I really like ${preferences.preferences}.
  I am planning a vacation in ${destination} ${social}. I will be at the destination on ${arrivalDate} - ${departureDate} (please 
  do this from the arrival Date to the departure Date without missing dates! ).
  Create a travel plan for me for each day separately based on the ratings of the places on google maps 
  especially from users with the same age range and consider the seasons.
  Please do not recommend me what to do and give me only place names for each day.
  Make sure the names of the places are clear so that I can later find the places on Google Maps Places API.
  Generate ${numberOfActivities} activities per day.
  Please do it in JSON format and send the JSON only!!!
  Your response should follow the following template:
  {
    "travelPlan": [
      {
        "day": "dd/mm/yy",
        "activities": [
          "PLACE NAME",
          "PLACE NAME",
          ...
        ]
      },
      ...
    ]
  }`;
  

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();
  const fetchOrganizedData = await organizeData(text, destination);
  return fetchOrganizedData;
};


// This function now becomes async to handle fetching place IDs
async function organizeData(response, destination) {
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
      const activitiesWithPlaceIds = await Promise.all(
        day.activities.map(async (activity) => {
          return await getActivityPlaceId(activity, destination);
        })
      );
      day.activities = activitiesWithPlaceIds.filter((id) => id !== null); // Filter out null IDs
    }

    return data; // Now includes place IDs instead of names
  } catch (error) {
    console.error("Error parsing JSON:", error);
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
    if (data.results && data.results.length > 0) {
      return data.results[0].place_id;
    } else {
      console.error(
        `No place found for activity: ${activity} in destination: ${destination}`
      );
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

    const userQuerySnapshot = await getDocs(
      query(collection(db, "users"), where("uid", "==", uid))
    );
    if (userQuerySnapshot.empty) {
      return res.status(404).send("User not found");
    }

    const userData = userQuerySnapshot.docs[0].data();
    if (!userData.plans || userData.plans.length === 0) {
      return res.status(404).send("No plans found");
    }

    res.status(200).json({ planIds: userData.plans });
  } catch (error) {
    console.error("Error getting plan IDs:", error);
    res.status(500).send("Error getting plan IDs");
  }
};

const getPlanById = async (req, res) => {
  try {
    const planId = req.body.planId;
    console.log("planId: ", planId);

    if (!planId) {
      return res.status(400).send("planId is required");
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    res.status(200).json(planDoc.data());
  } catch (error) {
    console.error("Error getting plan:", error);
    res.status(500).send("Error getting plan");
  }
};

const deletePlan = async (req, res) => {
  try {
    const planId = req.body.planId;

    if (!planId) {
      return res.status(400).send("planId is required");
    }

    const planDoc = await getDoc(doc(db, "plans", planId));

    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    const uid = planData.uid;

    if (!uid) {
      return res.status(400).send("Plan does not have a valid uid");
    }

    // Delete plan from the "plans" collection
    await deleteDoc(doc(db, "plans", planId));

    // Query the users collection to find the document with the given uid
    const usersCollection = collection(db, "users");
    const userQuery = query(usersCollection, where("uid", "==", uid));
    const userQuerySnapshot = await getDocs(userQuery);

    if (userQuerySnapshot.empty) {
      console.error(`User document not found for uid: ${uid}`);
      return res.status(404).send("User document not found");
    }

    // Assume there's only one document per uid
    const userDocRef = userQuerySnapshot.docs[0].ref;

    // Remove the planId from the user's plans array in the user collection
    await updateDoc(userDocRef, {
      plans: arrayRemove(planId),
    });

    res.status(200).send("Plan deleted successfully");
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(500).send("Error deleting plan");
  }
};

const editActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const day = req.body.day;
    const activity = req.body.activity;
    console.log("planId: ", planId);
    console.log("day: ", day);
    console.log("activity: ", activity);

    if (!planId || !day || !activity) {
      return res.status(400).send("planId, day, and activity are required");
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    console.log("planData: ", planData);

    // Find the user with the correct query
    const usersCollection = collection(db, "users");
    const userQuery = query(usersCollection, where("uid", "==", planData.uid));
    const userQuerySnapshot = await getDocs(userQuery);

    if (userQuerySnapshot.empty) {
      return res.status(404).send("User not found");
    }

    const userDoc = userQuerySnapshot.docs[0];
    const userData = userDoc.data();
    const preferencesDoc = await getDoc(
      doc(db, "preferences", userData.preferences_uid)
    );
    if (!preferencesDoc.exists()) {
      return res.status(404).send("Preferences not found");
    }

    const preferencesData = preferencesDoc.data();

    const activities = planData.travelPlan[day].activities;
    console.log("activities: ", activities);
    activities.push(activity);

    // Gather all activities in the plan to avoid duplicates
    const allActivities = planData.travelPlan.flatMap(
      (dayPlan) => dayPlan.activities
    );
    console.log("All activities in the plan: ", allActivities);

    // Convert place IDs to place names using Google Maps API
    const allActivityNames = await Promise.all(
      allActivities.map(async (placeId) => {
        try {
          const placeDetails = await getActivityNameFromPlaceId(placeId);
          return placeDetails.name;
        } catch (err) {
          console.error(
            `Error fetching place name for place ID ${placeId}: `,
            err
          );
          return null;
        }
      })
    );

    const filteredActivityNames = allActivityNames.filter(
      (name) => name !== null
    );
    console.log("All activity names in the plan: ", filteredActivityNames);

    // Generate 3 additional suitable activities
    const prompt = `I am editing an activity for a user. The user's preferences are: ${JSON.stringify(
      preferencesData.preferences
    )}.
    The current activities for the day are: ${activities.join(
      ", "
    )}. The destination is ${planData.destination}.
    The existing activities in the plan are: ${filteredActivityNames.join(
      ", "
    )}.
    Please suggest 3 additional activities that are suitable considering the user's preferences and the current activities.
    The format should be a JSON array of activity names.`;

    console.log("Generated prompt for Gemini: ", prompt);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    console.log("Gemini response text: ", text);

    // Extract JSON array from the response text
    const startIndex = text.indexOf("[");
    const endIndex = text.lastIndexOf("]") + 1;
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("Valid JSON array not found in response");
    }
    const jsonResponse = text.substring(startIndex, endIndex);

    const additionalActivities = JSON.parse(jsonResponse);

    console.log("Additional activities: ", additionalActivities);

    // Fetch place IDs for the new activities
    const newActivitiesWithPlaceIds = await Promise.all(
      additionalActivities.map(async (activity) => {
        try {
          return await getActivityPlaceId(activity, planData.destination);
        } catch (err) {
          console.error(
            `Error fetching place ID for activity ${activity}: `,
            err
          );
          return null;
        }
      })
    );

    const filteredNewActivities = newActivitiesWithPlaceIds.filter(
      (id) => id !== null && !allActivities.includes(id)
    );

    console.log(
      "Filtered new activities with place IDs: ",
      filteredNewActivities
    );

    res.status(200).json({ additionalActivities: filteredNewActivities });
  } catch (error) {
    console.error("Error editing activity:", error);
    res.status(500).send("Error editing activity");
  }
};

async function getActivityNameFromPlaceId(placeId) {
  const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  if (data.result && data.result.name) {
    return { name: data.result.name };
  } else {
    throw new Error(`No place found for place ID: ${placeId}`);
  }
}

const replaceActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const dayIndex = req.body.dayIndex;
    const activityIndex = req.body.activityIndex;
    const newActivityName = req.body.newActivity;
    console.log("planId: ", planId);
    console.log("dayIndex: ", dayIndex);
    console.log("activityIndex: ", activityIndex);
    console.log("newActivityName: ", newActivityName);

    if (
      !planId ||
      dayIndex === undefined ||
      activityIndex === undefined ||
      !newActivityName
    ) {
      return res
        .status(400)
        .send(
          "planId, dayIndex, activityIndex, and newActivityName are required"
        );
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    console.log("planData: ", planData);

    const travelPlan = planData.travelPlan;
    if (!travelPlan[dayIndex]) {
      return res.status(404).send("Day not found in travel plan");
    }

    if (
      !travelPlan[dayIndex].activities ||
      !travelPlan[dayIndex].activities[activityIndex]
    ) {
      return res.status(404).send("Activity not found in travel plan");
    }

    // Replace the old activity with the new one
    console.log("Before: ", travelPlan[dayIndex].activities[activityIndex]);
    travelPlan[dayIndex].activities[activityIndex] = newActivityName;
    console.log("After: ", travelPlan);

    // Update the plan in the database
    await updateDoc(doc(db, "plans", planId), { travelPlan });

    res.status(200).send("Activity replaced successfully");
  } catch (error) {
    console.error("Error replacing activity:", error);
    res.status(500).send("Error replacing activity");
  }
};

async function getActivityPlaceId(activityName, destination) {
  const query = `${activityName} in ${destination}`;
  const apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${apiKey}`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].place_id;
    } else {
      console.error(
        `No place found for activity: ${activityName} in destination: ${destination}`
      );
      return null;
    }
  } catch (error) {
    console.error("Error fetching activity place ID:", error);
    return null;
  }
}

//delete activity
const deleteActivity = async (req, res) => {
  try {
    const planId = req.body.planId;
    const dayIndex = req.body.dayIndex;
    const activityIndex = req.body.activityIndex;
    console.log("planId: ", planId);
    console.log("dayIndex: ", dayIndex);
    console.log("activityIndex: ", activityIndex);

    if (!planId || dayIndex === undefined || activityIndex === undefined) {
      return res
        .status(400)
        .send("planId, dayIndex, and activityIndex are required");
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;
    if (!travelPlan[dayIndex]) {
      return res.status(404).send("Day not found in travel plan");
    }

    if (
      !travelPlan[dayIndex].activities ||
      !travelPlan[dayIndex].activities[activityIndex]
    ) {
      return res.status(404).send("Activity not found in travel plan");
    }

    // Delete the activity from the travel plan
    travelPlan[dayIndex].activities.splice(activityIndex, 1);

    // Function to convert date strings to Date objects for comparison
    const parseDate = (dateStr) => {
      if (dateStr.includes("/")) {
        // For "29/07/24" format
        const [day, month, year] = dateStr.split("/");
        return new Date(`20${year}-${month}-${day}`);
      } else {
        // For "2024-07-28" format
        return new Date(dateStr);
      }
    };

    const dayDate = parseDate(travelPlan[dayIndex].day);
    const arrivalDate = parseDate(planData.arrivalDate);
    const departureDate = parseDate(planData.departureDate);
    console.log('dayDate:', dayDate, 'arrivalDate: ', arrivalDate, 'departureDate: ', departureDate);

    // Check if the day has no activities left, and if so, delete the day
    if (travelPlan[dayIndex].activities.length === 0) {
      console.log('arrivalDate in if:', arrivalDate.getTime(), 'dayDate in if:', dayDate.getTime());
      if (dayDate.getTime() === arrivalDate.getTime()) {
        planData.arrivalDate = travelPlan.length > 1
          ? travelPlan[1]?.day
            ? parseDate(travelPlan[1].day).toISOString().split("T")[0]
            : null
          : null;
      }
      console.log('departureDate in if:', departureDate.getTime(), 'dayDate in if:', dayDate.getTime());
      if (dayDate.getTime() === departureDate.getTime()) {
        planData.departureDate = travelPlan.length > 0
          ? travelPlan[travelPlan.length - 1]?.day
            ? parseDate(travelPlan[travelPlan.length - 1].day).toISOString().split("T")[0]
            : null
          : null;
        console.log('departureDate in if222222:', planData.departureDate);
      }
      travelPlan.splice(dayIndex, 1);
    }

    // Update the plan in the database
    await updateDoc(doc(db, "plans", planId), {
      travelPlan,
      arrivalDate: planData.arrivalDate,
      departureDate: planData.departureDate,
    });

    res.status(200).send("Activity deleted successfully");
  } catch (error) {
    console.error("Error deleting activity:", error);
    res.status(500).send("Error deleting activity");
  }
};





const FindRestaurantNearBy = async (req, res) => {
  try {
    const { planId, day, activity, mealType } = req.body;

    if (!planId || !day || !activity || !mealType) {
      return res
        .status(400)
        .send("planId, day, activity, and mealType are required");
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;

    if (!travelPlan[day]) {
      return res.status(404).send("Day not found in travel plan");
    }

    if (!travelPlan[day].activities || !travelPlan[day].activities[activity]) {
      return res.status(404).send("Activity not found in travel plan");
    }

    const activityLocation = travelPlan[day].activities[activity].location;

    // Find the next activity (if exists) and get its location
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

    // Generate a restaurant suggestion using Gemini
    const prompt = `I am finding 3 restaurants near ${activity} for a user (Max of 25 minutes of walk). The destination is ${
      planData.destination
    }. The meal type is ${mealType}. 
    Please suggest 3 restaurants that are suitable considering the activity location ${activityLocation}${
      nextActivityLocation
        ? ` and the next activity location ${nextActivityLocation}`
        : ""
    }. 
    Please give restaurants with high rating.
    The format should be a JSON array of restaurant names.`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    console.log("Gemini response text: ", text);

    // Extract JSON array from the response text
    const startIndex = text.indexOf("[");
    const endIndex = text.lastIndexOf("]") + 1;
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("Valid JSON array not found in response");
    }
    const jsonResponse = text.substring(startIndex, endIndex);

    const restaurantNames = JSON.parse(jsonResponse);

    console.log("Restaurant names: ", restaurantNames);

    // Fetch place IDs for the restaurant names
    const restaurantsWithPlaceIds = await Promise.all(
      restaurantNames.map(async (restaurantName) => {
        try {
          const placeId = await getActivityPlaceId(restaurantName, planData.destination);
          return placeId ? { name: restaurantName, placeId } : null;
        } catch (err) {
          console.error(`Error fetching place ID for restaurant ${restaurantName}: `, err);
          return null;
        }
      })
    );

    const validRestaurants = restaurantsWithPlaceIds.filter((restaurant) => restaurant !== null);

    console.log("Restaurants with place IDs: ", validRestaurants);

    res.status(200).json(validRestaurants);
  } catch (error) {
    console.error("Error in FindRestaurantNearBy:", error.message);
    console.error(error.stack);
    res.status(500).send("Internal Server Error");
  }
};


// Add the Restaurant that the user pick to the activities
const addRestaurantToPlan = async (req, res) => {
  try {
    const { planId, dayIndex, activityIndex, restaurantName, placeId } = req.body;

    if (!planId || dayIndex === undefined || activityIndex === undefined || !restaurantName || !placeId) {
      return res.status(400).send(
        "planId, dayIndex, activityIndex, restaurantName, and placeId are required"
      );
    }

    const planDoc = await getDoc(doc(db, "plans", planId));
    if (!planDoc.exists()) {
      return res.status(404).send("Plan not found");
    }

    const planData = planDoc.data();
    const travelPlan = planData.travelPlan;

    console.log("Received travelPlan: ", travelPlan);
    console.log("Looking for day index: ", dayIndex);

    if (!travelPlan[dayIndex]) {
      console.log(`Day index "${dayIndex}" not found in travel plan`);
      return res.status(404).send("Day not found in travel plan");
    }

    if (!travelPlan[dayIndex].activities || travelPlan[dayIndex].activities[activityIndex] === undefined) {
      return res.status(404).send("Activity not found in travel plan");
    }

    // Insert the restaurant place ID after the specified activity index
    travelPlan[dayIndex].activities.splice(activityIndex + 1, 0, placeId);

    console.log("Updated travelPlan after adding restaurant: ", travelPlan);

    // Update the plan in the database
    await updateDoc(doc(db, "plans", planId), { travelPlan });

    res.status(200).send("Restaurant added to plan successfully");
  } catch (error) {
    console.error("Error in addRestaurantToPlan:", error);
    res.status(500).send("Internal Server Error");
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


