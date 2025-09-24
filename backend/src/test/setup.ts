import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

// Set NODE_ENV to test
process.env.NODE_ENV = "test";

// Global test setup
beforeAll(async () => {
  // Setup test database connection if needed
});

afterAll(async () => {
  // Cleanup test resources
});

// Global test utilities
declare global {
  var testTimeout: number;
}

global.testTimeout = 30000;
