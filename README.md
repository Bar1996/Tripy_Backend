# Tripy Backend - Smart Travel Planning API

## Overview
Tripy Backend is the server-side application that powers the Tripy mobile app, providing a **smart travel planning experience**. 
It supports user authentication, trip creation, personalized recommendations, and real-time itinerary management.

This backend service is built using **Node.js, Express.js, Firebase, and integrates with multiple external APIs** to offer a seamless and intelligent travel experience.

## Features
- 🔑 **User Authentication** – Email/password and Google OAuth authentication.
- 📍 **Trip Management** – Create, update, and delete personalized trip plans.
- 🏛 **Smart Recommendations** – AI-powered suggestions for activities and restaurants.
- 🔄 **Real-time Updates** – Adjust plans dynamically based on weather and user preferences.
- 🌍 **Google Maps & Places Integration** – Navigation and activity search powered by Google APIs.
- 🔐 **JWT-based Authorization** – Secure API endpoints with token-based authentication.
- 🗂 **Cloud Storage** – Store user trip data in Firebase Firestore.

## Technology Stack

| Component      | Technology |
|---------------|------------|
| **Backend**   | Node.js, Express.js |
| **Database**  | Firebase Firestore |
| **Authentication** | JWT, Google OAuth |
| **Infrastructure** | Render (Cloud Deployment) |
| **External APIs** | Google Maps, Google Places, Generative AI (Gemini) |
| **CI/CD** | GitHub Actions, Render Auto Deploy |

## Environment Variables

Create a `.env` file in the root directory and add:
```env
# Server Configuration
PORT=3000                                         # Port on which the backend server will run
SERVER_URL="http://localhost:3000"                # Base URL for the backend server

# API Keys
GOOGLE_MAPS_API_KEY="your_google_maps_api_key"    # Google Maps API key for location-based services
GEMINI_API_KEY="your_gemini_api_key"              # API key for AI-powered recommendations

# Authentication Secrets
TOKEN_SECRET="your_jwt_secret"                    # Secret key for signing JWT tokens
TOKEN_EXPIRES_IN="1h"                             # Expiration time for access tokens (e.g., '1h' for 1 hour)
REFRESH_TOKEN_SECRET="your_refresh_token_secret"  # Secret key for refresh tokens
REFRESH_TOKEN_EXPIRATION="7d"                     # Expiration time for refresh tokens (e.g., '7d' for 7 days)

# OAuth (Google Authentication)
GOOGLE_CLIENT_ID="your_google_client_id"          # Google OAuth Client ID for user authentication

# Email Configuration
EMAIL_ADDRESS="your_smtp_email@example.com"       # Email address used for sending system emails
EMAIL_PASSWORD="your_email_password"              # Email password or app-specific password for SMTP authentication

```

## Installation & Setup

### Prerequisites

Before setting up the project, ensure you have the following installed:
- Node.js
- npm
- Firebase CLI
- Render Account

### Local Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Bar1996/Tripy_Backend.git
   cd Tripy_Backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run the Server**
   ```bash
   npm start
   ```

4. **Test API Endpoints**
   ```bash
   curl -X GET http://localhost:3000/api/health
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/signup` | Register a new user |
| `POST` | `/post_email` | Send email verification |
| `POST` | `/post_password` | Update user password |
| `GET` | `/wake` | Wake server |
| `POST` | `/login` | Login user |
| `POST` | `/resetPass` | Reset user password |
| `GET` | `/refresh` | Refresh authentication token |
| `POST` | `/googleSignIn` | Google OAuth authentication |

### User Management

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/addDetails` | Add user details |
| `POST` | `/addPreferences` | Save user preferences |
| `GET` | `/getDetails` | Retrieve user details |
| `GET` | `/getPreferences` | Retrieve user preferences |
| `GET` | `/check` | Check authentication |
| `GET` | `/logout` | Logout user |
| `POST` | `/deleteUserData` | Delete user data |
| `POST` | `/SendMail` | Send email to user |
| `POST` | `/changePassword` | Change user password |

### Trip Management

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/addPlan` | Create a new trip |
| `GET` | `/getUserPlanIds` | Get all trip plan IDs for a user |
| `POST` | `/getPlanById` | Get details of a specific trip plan |
| `POST` | `/deletePlan` | Delete a trip |
| `POST` | `/editActivity` | Edit an activity in the plan |
| `POST` | `/replaceActivity` | Replace an activity in the plan |
| `POST` | `/deleteActivity` | Delete an activity from the plan |
| `POST` | `/FindRestaurantNearBy` | Find nearby restaurants |
| `POST` | `/addRestaurantToPlan` | Add a restaurant to the trip plan |

## Testing

- **Unit Testing**: Implemented using Jest.
- **Integration Testing**: API tested with Supertest.
- **Automated Tests Execution**
  ```bash
  npm run test
  ```

## License

This project is licensed under the **MIT License**.

## Contact

📧 **Tripy Team** – [Tripy@tech-center.com](mailto:Tripy@tech-center.com)  
🔗 **Frontend Repo** – [Tripy Frontend](https://github.com/idobe2/NetworkingApp)  
