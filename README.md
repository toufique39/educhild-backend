  # EduChild 
The backend service for EduChild, a community-driven social development events platform. It provides event management, event joining, user-specific event data, MongoDB persistence, and JWT-protected endpoints.
# Live Services
- Backend API: https://educhild-api.netlify.app
- Frontend Website: https://fancy-bienenstitch-f8f9d5.netlify.app
# Tech Stack
- Runtime: Node.js
- Framework: Express.js
- Language: JavaScript (ES Modules)
- Database: MongoDB
- Authentication / API Authorization: Better Auth-issued JWT verification with jose
- Serverless Adapter: serverless-http
- Hosting: Netlify Functions
# Features
- Retrieve upcoming events from MongoDB.
- Retrieve an individual event by its MongoDB ID.
- Create events for authenticated users.
- Retrieve events created by the authenticated user.
- Update and delete only events owned by the authenticated user.
- Allow authenticated users to join future events.
- Prevent duplicate event registrations.
- Retrieve events joined by the authenticated user.
- Validate JWTs against the Better Auth JWKS endpoint.
- Restrict browser requests through configurable CORS origins.
- Provide API and database health-check endpoints.
# API Base URL
https://educhild-api.netlify.app
# API Endpoints
[Protected] means the request must include a valid Bearer JWT in the Authorization header.
Method	Endpoint	Access	Description
GET	/api/health	Public	Check API availability.
GET	/api/health/db	Public	Check the MongoDB connection.
GET	/upcomming-events	Public	Get upcoming events. Supports an optional limit query parameter.
GET	/upcomming-events/:id	Public	Get one event by ID.
POST	/upcomming-events	Protected	Create an event.
GET	/my-events	Protected	Get events created by the current user.
PATCH	/upcomming-events/:id	Protected	Update an event owned by the current user.
DELETE	/upcomming-events/:id	Protected	Delete an event owned by the current user.
POST	/upcomming-events/:id/join	Protected	Join a future event.
GET	/joined-events	Protected	Get events joined by the current user.


# Example Requests
Get upcoming events:
curl https://educhild-api.netlify.app/upcomming-events
Get up to six upcoming events:
curl "https://educhild-api.netlify.app/upcomming-events?limit=6"
Call a protected endpoint:
curl https://educhild-api.netlify.app/my-events \
  -H "Authorization: Bearer YOUR_BETTER_AUTH_JWT"
Do not place a real JWT in source code, a public README, or a shared screenshot.
Database
The service uses the edu_child MongoDB database and these application collections:
- upcomming-events — event documents.
- joined-events — user-to-event registrations.
A unique compound index on eventId and userId helps prevent duplicate registrations.
# Getting Started
1. Clone the repository
git clone https://github.com/toufique39/educhild-backend
cd dir 
2. Install dependencies
npm install
3. Configure environment variables
Create a .env file in the backend project root:
MONGO_URI=your_mongodb_connection_string
MONGO_DB=edu_child

# Frontend origin allowed by CORS
CLIENT_URL=http://localhost:10000

# Better Auth origin used to retrieve JWKS and verify JWT issuer/audience
AUTH_BASE_URL=http://localhost:10000
For production, configure these variables in the Netlify backend site's environment-variable settings. Set CLIENT_URL and AUTH_BASE_URL to:
https://fancy-bienenstitch-f8f9d5.netlify.app
MONGO_URI must contain your MongoDB connection string. Keep it private and never commit .env.
4. Run locally
This project is adapted for Netlify Functions. Start the local Netlify development environment with:
npx netlify dev
Netlify CLI runs the function locally (by default at http://localhost:8888). For local frontend testing, set NEXT_PUBLIC_EVENTS_API_URL to http://localhost:8888/upcomming-events.
5. Deploy to Netlify
This backend is adapted to run as a Netlify Function using serverless-http.
netlify login
netlify deploy
Test the draft deployment before publishing it. When the API checks pass, deploy to production:
netlify deploy --prod
The Netlify configuration uses the function in netlify/functions and rewrites incoming API requests to that function.
Authentication Notes
Protected routes validate the Bearer token using the Better Auth JWKS endpoint:
https://fancy-bienenstitch-f8f9d5.netlify.app/api/auth/jwks
The AUTH_BASE_URL must match the Better Auth production base URL so that the JWT issuer and audience checks use the expected origin.
Related Project
- Frontend README: See README-frontend.md in the frontend repository.
- Frontend Live Website: https://fancy-bienenstitch-f8f9d5.netlify.app
