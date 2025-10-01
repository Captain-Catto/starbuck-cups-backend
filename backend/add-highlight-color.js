const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "starbucks_shop",
  logging: console.log,
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
        after: "highlight_text",
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
