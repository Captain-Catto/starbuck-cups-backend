/**
 * JWT utilities for token generation and verification
 */
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { AdminRole } from "../models/AdminUser";

// JWT Configuration
const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || "your-access-token-secret-key";
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-token-secret-key";
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES || "7d";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: AdminRole;
  username: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

export interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

/**
 * Generate access token for authenticated user
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  try {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    } as jwt.SignOptions);
  } catch (error) {
    console.error("Access token generation error:", error);
    throw new Error("Failed to generate access token");
  }
}

/**
 * Generate refresh token for token renewal
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  try {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    } as jwt.SignOptions);
  } catch (error) {
    console.error("Refresh token generation error:", error);
    throw new Error("Failed to generate refresh token");
  }
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): DecodedAccessToken {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    }) as DecodedAccessToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Access token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid access token");
    } else {
      console.error("Access token verification error:", error);
      throw new Error("Token verification failed");
    }
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): DecodedRefreshToken {
  try {
    console.log("Verifying refresh token:", {
      tokenPresent: !!token,
      tokenLength: token?.length,
      tokenStart: token?.substring(0, 20) + "...",
    });

    return jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    }) as DecodedRefreshToken;
  } catch (error) {
    console.log("Refresh token verification failed:", {
      errorType: error instanceof Error ? error.constructor.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Refresh token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid refresh token");
    } else {
      console.error("Refresh token verification error:", error);
      throw new Error("Token verification failed");
    }
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    console.error("Token expiration extraction error:", error);
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expirationDate = getTokenExpiration(token);
  if (!expirationDate) {
    return true;
  }
  return expirationDate < new Date();
}

/**
 * Hash refresh token for database storage
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Get refresh token expiration date (7 days from now)
 */
export function getRefreshTokenExpiration(): Date {
  const expirationMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  return new Date(Date.now() + expirationMs);
}
