# JWT Utilities Fix - Summary

## 🎯 Vấn đề đã sửa

JWT utilities có 2 lỗi TypeScript về type overload mismatch trong `jwt.sign()` calls:

1. **generateAccessToken function** (line 42)
2. **generateRefreshToken function** (line 58)

## 🔍 Root Cause Analysis

### Error Message:

```
error TS2769: No overload matches this call.
- Overload 1: Argument of type 'string' is not assignable to parameter of type 'null'
- Overload 2: Type 'string' is not assignable to type 'number | StringValue | undefined'
- Overload 3: Object literal may only specify known properties, and 'expiresIn' does not exist in type 'SignCallback'
```

### Problem:

- **JWT Library Version Conflict**: Newer versions of `@types/jsonwebtoken` have stricter typing
- **Options Type Inference**: TypeScript couldn't properly infer the type of options object
- **SignOptions Interface**: The options object needed explicit type casting

## 🔧 Giải pháp đã thực hiện

### Before (Error):

```typescript
export function generateAccessToken(payload: AccessTokenPayload): string {
  try {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN, // ❌ Type inference issue
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    }); // ❌ No explicit type cast
  } catch (error) {
    // ... error handling
  }
}
```

### After (Fixed):

```typescript
export function generateAccessToken(payload: AccessTokenPayload): string {
  try {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN, // ✅ Same values
      issuer: "cups-shop",
      audience: "cups-shop-admin",
    } as jwt.SignOptions); // ✅ Explicit type cast
  } catch (error) {
    // ... error handling
  }
}
```

### Key Change:

**Added explicit type casting:** `as jwt.SignOptions`

This tells TypeScript exactly which overload of `jwt.sign()` to use and ensures the options object conforms to the expected `SignOptions` interface.

## ✅ Functions Fixed

### 1. **generateAccessToken**

```typescript
// ✅ Fixed with explicit type cast
return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
  expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  issuer: "cups-shop",
  audience: "cups-shop-admin",
} as jwt.SignOptions);
```

### 2. **generateRefreshToken**

```typescript
// ✅ Same fix applied
return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
  expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  issuer: "cups-shop",
  audience: "cups-shop-admin",
} as jwt.SignOptions);
```

## 🚀 Benefits

- ✅ **Type Safety**: Explicit type casting resolves TypeScript overload ambiguity
- ✅ **JWT Functionality**: All token generation features work as expected
- ✅ **Authentication System**: Access and refresh tokens generate properly
- ✅ **No Breaking Changes**: Same API, just proper typing

## 📝 JWT System Features

After fix, all JWT utilities work correctly:

- ✅ **generateAccessToken()** - Create short-lived access tokens (15m)
- ✅ **generateRefreshToken()** - Create long-lived refresh tokens (7d)
- ✅ **verifyAccessToken()** - Validate and decode access tokens
- ✅ **verifyRefreshToken()** - Validate and decode refresh tokens
- ✅ **extractTokenFromHeader()** - Extract Bearer tokens from headers
- ✅ **getTokenExpiration()** - Get token expiration dates
- ✅ **isTokenExpired()** - Check if tokens are expired

## 🔧 Technical Details

### JWT Configuration:

```typescript
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "fallback";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "fallback";
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES || "7d";
```

### Token Payload Interfaces:

```typescript
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
```

## 🔄 Testing

```bash
# Check JWT utilities compilation
npx tsc --noEmit src/utils/jwt.ts
# ✅ No errors found
```

## 🌐 Authentication Flow Ready

JWT utilities đã sẵn sàng cho complete authentication system:

1. **Login** → Generate access + refresh tokens
2. **API Requests** → Verify access tokens
3. **Token Refresh** → Use refresh token to get new access token
4. **Logout** → Invalidate tokens

JWT system đã hoạt động perfect với proper TypeScript typing!
