import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { AsyncLocalStorage } from "async_hooks";

export const loggerContext = new AsyncLocalStorage<{ requestId: string }>();

// Define custom printf format
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const store = loggerContext.getStore();
  const requestId = store?.requestId ? `[${store.requestId}] ` : "";

  // Append meta (like objects passed to logger) if they exist
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  
  return `[${timestamp}] ${level.toUpperCase()} ${requestId}${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      ),
    }),
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});
