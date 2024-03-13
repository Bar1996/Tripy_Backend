const { getAuth } = require('firebase/auth');
const admin = require('firebase-admin');
const { db } = require('../firebaseConfig.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  const generatePlan = async (req, res) => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `I am ${req.body.gender} aged ${req.body.age}, I really like ${req.body.preferences}.
  I am planning a vacation in Barcelona ${req.body.social}. I will be at the destination on ${req.body.arrivalDate} - ${req.body.departureDate}. 
  Create a travel plan for me for each day separately based on the ratings of the places on google maps 
  especially from users with the same age range and consider the seasons. 
      Please dont recommend me what to do and give me only places names for each day. 
      Make sure the names of the places are clear so that I can later find the places on google maps places Api. 
      Please do it in JSON format and send the JSON only!!! 
      Your response should follow the following template: 
      {
        "travelPlan": [
          {
            "day": "dd/mm/yy",
            "activities": [
              "FILL WITH PLACE NAME",
              "…",
              "…"
      `;
    const result = await model.generateContent(prompt);
    const respone = await result.response;
    const text = respone.text();
    res.send(organizeData(text));
  }
  
  function organizeData(response) {
    // Find the start and end index of the JSON data
    const startIndex = response.indexOf("{");
    const endIndex = response.lastIndexOf("}") + 1;
    if (startIndex === -1 || endIndex === -1) {
      console.error("JSON data not found in response");
      return null;
    }
  
    // Extract the JSON data from the response
    const jsonData = response.substring(startIndex, endIndex);
  
    try {
      // Parse the JSON data
      const data = JSON.parse(jsonData);
      const travelPlan = data.travelPlan.map((day) => ({
        date: day.day,
        activities: day.activities,
      }));
      console.log(travelPlan);
      getTravelPlanPlaceIds(travelPlan);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
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

  module.exports = {generatePlan};