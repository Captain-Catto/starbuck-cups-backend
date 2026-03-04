const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, "");

const parseOrigins = (raw?: string): string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
};

export const getAllowedOrigins = (): string[] => {
  const envOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
  const explicitOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL]
    .filter(Boolean)
    .map((origin) => normalizeOrigin(origin as string));
  const includeLocalDevOrigins =
    process.env.NODE_ENV !== "production" ||
    process.env.INCLUDE_LOCAL_ORIGINS === "true";

  const combinedOrigins = includeLocalDevOrigins
    ? [...envOrigins, ...explicitOrigins, ...LOCAL_DEV_ORIGINS]
    : [...envOrigins, ...explicitOrigins];

  return Array.from(new Set(combinedOrigins));
};

export const isAllowedOrigin = (
  origin: string | undefined,
  allowedOrigins: string[]
): boolean => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(normalizeOrigin(origin));
};
