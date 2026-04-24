import winston from "winston";
import Transport from "winston-transport";
import DailyRotateFile from "winston-daily-rotate-file";
import { AsyncLocalStorage } from "async_hooks";
import * as Sentry from "@sentry/node";

export const loggerContext = new AsyncLocalStorage<{ requestId: string }>();

// Define custom printf format
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const store = loggerContext.getStore();
  const requestId = store?.requestId ? `[${store.requestId}] ` : "";

  // Append meta (like objects passed to logger) if they exist
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  
  return `[${timestamp}] ${level.toUpperCase()} ${requestId}${message}${metaStr}`;
});

class SentryTransport extends Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => this.emit("logged", info));

    const splat = (info[Symbol.for("splat")] as unknown[]) ?? [];
    const error = splat[0];

    if (error instanceof Error) {
      Sentry.withScope((scope) => {
        scope.setExtra("logger_message", info.message);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureMessage(
        splat.length ? `${info.message} ${JSON.stringify(splat)}` : info.message,
        "error"
      );
    }

    callback();
  }
}

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
    new SentryTransport({ level: "error" }),
  ],
});
