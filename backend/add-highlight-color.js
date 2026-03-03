const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

const shouldUseSSL =
  process.env.DB_SSL === "true" ||
  process.env.DB_SSL === "1" ||
  (process.env.DATABASE_URL || "").includes("sslmode=require");

const baseConfig = {
  dialect: "postgres",
  logging: console.log,
  ...(shouldUseSSL
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {}),
};

// Create Sequelize instance
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, baseConfig)
  : new Sequelize({
      ...baseConfig,
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres123",
      database: process.env.DB_NAME || "starbucks_shop",
    });

async function addHighlightColorColumn() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Add highlight_color column
    await sequelize
      .getQueryInterface()
      .addColumn("promotional_banners", "highlight_color", {
        type: Sequelize.STRING(50),
        allowNull: true,
      });

    console.log(
      "highlight_color column added successfully to promotional_banners table."
    );
  } catch (error) {
    console.error("Error adding column:", error);
  } finally {
    await sequelize.close();
  }
}

addHighlightColorColumn();
