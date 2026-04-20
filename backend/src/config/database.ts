import { logger } from "@/utils/logger";
import { Sequelize, Options } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const shouldUseSSL =
  process.env.DB_SSL === "true" ||
  process.env.DB_SSL === "1" ||
  (process.env.DATABASE_URL || "").includes("sslmode=require");

const parsePoolNumber = (rawValue: string | undefined, fallback: number): number => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const dbPoolMax = parsePoolNumber(process.env.DB_POOL_MAX, 20);
const dbPoolMin = parsePoolNumber(process.env.DB_POOL_MIN, 0);
const dbPoolAcquire = parsePoolNumber(process.env.DB_POOL_ACQUIRE_MS, 30000);
const dbPoolIdle = parsePoolNumber(process.env.DB_POOL_IDLE_MS, 10000);

const baseConfig: Options = {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? logger.info : false,
  pool: {
    max: dbPoolMax,
    min: dbPoolMin,
    acquire: dbPoolAcquire,
    idle: dbPoolIdle,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
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

export default sequelize;
export { sequelize };
