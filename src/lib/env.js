/**
 * Environment validation utility
 */

function validateEnv() {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Add to .env.local`,
    );
  }

  // Validate MONGODB_URI format
  const uri = process.env.MONGODB_URI;
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      "MONGODB_URI must be valid (mongodb:// or mongodb+srv://). For Atlas: get from Network Access.",
    );
  }

  // JWT_SECRET should be >32 chars
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long. Generate securely.",
    );
  }

  // For Atlas: Warn about common IP issue
  if (uri.includes("atlas.net")) {
    console.warn(
      "Atlas detected. Ensure your IP is whitelisted (0.0.0.0/0 for dev) or VPN matches: https://www.mongodb.com/docs/atlas/security-ip-access-list/",
    );
  }
}

export default validateEnv;
