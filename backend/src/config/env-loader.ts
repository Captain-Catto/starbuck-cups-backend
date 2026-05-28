import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Loads environment variables from the appropriate .env files based on NODE_ENV.
 * Emulates the Next.js load order:
 * 1. .env.[mode].local (highest priority)
 * 2. .env.local (omitted in test mode)
 * 3. .env.[mode]
 * 4. .env (lowest priority)
 */
export const loadEnv = (): void => {
  // 1. Detect active environment
  let nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    if (process.env.TS_NODE_DEV === "true" || process.env.TS_NODE === "true") {
      nodeEnv = "development";
    } else {
      nodeEnv = "production";
    }
    process.env.NODE_ENV = nodeEnv;
  }

  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.local`,
    `.env.${nodeEnv}`,
    ".env"
  ];

  envFiles.forEach((file) => {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
    }
  });
};

// Run immediately when imported
loadEnv();
