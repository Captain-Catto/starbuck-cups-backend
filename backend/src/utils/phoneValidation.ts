/**
 * Phone number validation utilities
 */

/**
 * Validate phone number - simplified to only check if input exists
 * @param phone Phone number string
 * @returns Boolean indicating if phone is valid
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove common formatting characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Only check if phone has content (at least 1 character)
  return cleanPhone.length > 0;
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
  return 'Số điện thoại là bắt buộc';
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