import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// MySQL connection configuration
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "starbucks_shop",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    // Enable multiple statements for migrations
    multipleStatements: true,
    // Timezone configuration
    timezone: '+00:00',
  },
  timezone: '+00:00',
});

export default sequelize;
export { sequelize };