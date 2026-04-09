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
