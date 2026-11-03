
import { createRemoteJWKSet, jwtVerify } from "jose";

// Better Auth server URL
const AUTH_BASE_URL = (
  process.env.AUTH_BASE_URL || "http://localhost:10000"
).replace(/\/+$/, "");

// Better Auth public keys endpoint
const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_BASE_URL}/api/auth/jwks`)
);

// JWT Verification Middleware
export async function verifyToken(req, res, next) {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    // Check Bearer token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    // Extract JWT
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing.",
      });
    }

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_BASE_URL,
      audience: AUTH_BASE_URL,
    });

    // Validate user identity
    if (!payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    // Attach authenticated user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
      image: typeof payload.image === "string" ? payload.image : "",
    };

    // Continue to protected route
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token. Please login again.",
    });
  }
}
