/**
 * Password utilities for hashing, comparing, and validating passwords
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare a plain password with hashed password
 */
export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters (aaa, 111)
    /123456|654321/, // Sequential numbers
    /qwerty|asdfgh/, // Keyboard patterns
    /password|admin|login/i, // Common words
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common weak patterns');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a random password
 */
export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required group
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specials = '!@#$%^&*';
  
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specials[Math.floor(Math.random() * specials.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}