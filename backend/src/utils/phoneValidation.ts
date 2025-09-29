/**
 * Phone number validation utilities
 */

// International phone number regex (7-16 digits, optional + prefix)
export const INTERNATIONAL_PHONE_REGEX = /^[\+]?[1-9][\d]{6,15}$/;

/**
 * Validate international phone number
 * @param phone Phone number string
 * @returns Boolean indicating if phone is valid
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove common formatting characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  return INTERNATIONAL_PHONE_REGEX.test(cleanPhone);
};

/**
 * Clean and format phone number for storage
 * @param phone Phone number string
 * @returns Cleaned phone number
 */
export const cleanPhoneNumber = (phone: string): string => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-digit and non-plus characters
  return phone.replace(/[^\d\+]/g, '');
};

/**
 * Get phone validation error message
 * @returns Error message string
 */
export const getPhoneValidationErrorMessage = (): string => {
  return 'Số điện thoại không hợp lệ (phải có 7-16 chữ số)';
};

/**
 * Validate and format phone number
 * @param phone Phone number string
 * @returns Object with isValid boolean and formatted phone
 */
export const validateAndFormatPhone = (phone: string): {
  isValid: boolean;
  formatted: string;
  error?: string;
} => {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      formatted: '',
      error: 'Số điện thoại là bắt buộc'
    };
  }

  const cleaned = cleanPhoneNumber(phone);
  const isValid = isValidPhoneNumber(cleaned);

  return {
    isValid,
    formatted: cleaned,
    error: isValid ? undefined : getPhoneValidationErrorMessage()
  };
};