
import serverless from "serverless-http";

import { app, connectDatabase } from "../../index.js";

// Convert Express app into a Netlify-compatible handler
const expressHandler = serverless(app);

// Netlify Function Handler
export const handler = async (event, context) => {
  // Allow MongoDB connections to remain reusable
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Ensure MongoDB is connected before handling requests
    await connectDatabase();

    return await expressHandler(event, context);
  } catch (error) {
    console.error("Netlify API Function Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        message: "Internal server error.",
      }),
    };
  }
};
