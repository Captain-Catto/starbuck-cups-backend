import winston from "winston";
import Transport from "winston-transport";
import DailyRotateFile from "winston-daily-rotate-file";
import { AsyncLocalStorage } from "async_hooks";
import * as Sentry from "@sentry/node";

export const loggerContext = new AsyncLocalStorage<{ requestId: string }>();

const toGMT7 = () => {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
};

const LEVEL_COLORS: Record<string, string> = {
  error: "\x1b[31m",
  warn:  "\x1b[33m",
  info:  "\x1b[32m",
  debug: "\x1b[36m",
};
const RESET = "\x1b[0m";

const buildLine = (level: string, message: string, timestamp: unknown, meta: Record<string, unknown>, colored: boolean) => {
  const store = loggerContext.getStore();
  const requestId = store?.requestId ? `[${store.requestId}] ` : "";
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${timestamp}] ${level.toUpperCase()} ${requestId}${message}${metaStr}`;
  return colored ? `${LEVEL_COLORS[level] ?? ""}${line}${RESET}` : line;
};

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) =>
  buildLine(level, message as string, timestamp, meta, false)
);

const coloredFormat = winston.format.printf(({ level, message, timestamp, ...meta }) =>
  buildLine(level, message as string, timestamp, meta, true)
);

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
    winston.format.timestamp({ format: toGMT7 }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: toGMT7 }),
        coloredFormat
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
