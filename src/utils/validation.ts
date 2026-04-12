export const SPECIAL_CHARS_REGEX = /[<>{}[\]|\\^`~]/;

export const SPECIAL_CHARS_LABEL = '< > { } [ ] | \\ ^ ` ~';

/**
 * Returns an error message if the value contains disallowed special characters,
 * otherwise returns an empty string.
 */
export const validateSpecialChars = (value: string): string => {
    if (SPECIAL_CHARS_REGEX.test(value)) {
        return `Invalid characters detected. Avoid using: ${SPECIAL_CHARS_LABEL}`;
    }
    return '';
};

/** Returns an error if the value is empty/whitespace-only. */
export const validateRequired = (value: string, fieldName = 'This field'): string => {
    if (!value.trim()) return `${fieldName} is required.`;
    return '';
};

/** Returns an error if the value exceeds maxLen characters. */
export const validateMaxLength = (value: string, maxLen: number, fieldName = 'This field'): string => {
    if (value.trim().length > maxLen) return `${fieldName} must be under ${maxLen} characters.`;
    return '';
};

/** Returns an error if the value is not a valid URL (http/https). */
export const validateUrl = (value: string): string => {
    if (value.trim() && !/^https?:\/\/.+/.test(value.trim())) {
        return 'Must be a valid URL starting with http:// or https://';
    }
    return '';
};

/** Returns an error if the value is not a valid email address. */
export const validateEmail = (value: string): string => {
    if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Invalid email address.';
    }
    return '';
};

/**
 * Runs validateSpecialChars and, optionally, validateRequired.
 * Returns the first error found or an empty string.
 */
export const validateTextField = (
    value: string,
    fieldName = 'This field',
    options: { required?: boolean; maxLength?: number } = {}
): string => {
    if (options.required) {
        const req = validateRequired(value, fieldName);
        if (req) return req;
    }
    const special = validateSpecialChars(value);
    if (special) return special;
    if (options.maxLength) {
        const len = validateMaxLength(value, options.maxLength, fieldName);
        if (len) return len;
    }
    return '';
};
