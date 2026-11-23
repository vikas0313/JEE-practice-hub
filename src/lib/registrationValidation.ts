/**
 * Student Registration Validation & Sanitization Module
 * Enforces strict client and server validation matching SRD v1.4 rules.
 */

// Common weak / compromised passwords blacklist
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '1234567890',
  '12345678',
  'qwertyuiop',
  'admin12345',
  'jeepractice',
  'student123',
  'monitor123',
  'welcome123',
  'iloveyou12',
  'passcode123',
  'testing123',
]);

export interface RegistrationPayload {
  first_name: string;
  last_name: string;
  age: number;
  email: string;
  college_name: string;
  password?: string;
  confirm_password?: string;
  consent_tracking: boolean;
  consent_guardian?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  valid: boolean;
  errors: Record<string, string>;
  sanitized: {
    first_name: string;
    last_name: string;
    age: number;
    email: string;
    college_name: string;
  };
  normalized: {
    first_name: string;
    last_name: string;
    age: number;
    email: string;
    college_name: string;
  };
}

export function validateRegistrationPayload(
  payload: Partial<RegistrationPayload>,
  options: { existingEmails?: string[]; checkPassword?: boolean } = {}
): ValidationResult {
  const errors: Record<string, string> = {};
  const { existingEmails = [], checkPassword = true } = options;

  // 1. First Name: 1 to 60 characters, letters, spaces, hyphens, apostrophes, Unicode letters
  const firstName = (payload.first_name || '').trim();
  const nameRegex = /^[A-Za-z\u00C0-\u024F\u0900-\u097F\s'\-]+$/;
  if (!firstName) {
    errors.first_name = 'First name is required.';
  } else if (firstName.length < 1 || firstName.length > 60) {
    errors.first_name = 'First name must be between 1 and 60 characters.';
  } else if (!nameRegex.test(firstName)) {
    errors.first_name = 'First name contains invalid characters.';
  }

  // 2. Last Name: 1 to 60 characters
  const lastName = (payload.last_name || '').trim();
  if (!lastName) {
    errors.last_name = 'Last name is required.';
  } else if (lastName.length < 1 || lastName.length > 60) {
    errors.last_name = 'Last name must be between 1 and 60 characters.';
  } else if (!nameRegex.test(lastName)) {
    errors.last_name = 'Last name contains invalid characters.';
  }

  // 3. Age: Integer between 10 and 99
  const age = Number(payload.age);
  if (!payload.age && payload.age !== 0) {
    errors.age = 'Age is required.';
  } else if (!Number.isInteger(age) || age < 10 || age > 99) {
    errors.age = 'Age must be a valid whole number between 10 and 99.';
  }

  // 4. Email: valid, normalized to lowercase, unique
  const rawEmail = (payload.email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!rawEmail) {
    errors.email = 'Email address is required.';
  } else if (!emailRegex.test(rawEmail)) {
    errors.email = 'Please provide a valid email address.';
  } else if (existingEmails.map(e => e.toLowerCase()).includes(rawEmail)) {
    errors.email = 'An account with this email already exists.';
  }

  // 5. College Name: 2 to 120 characters, free text, trimmed, no markup
  const rawCollege = (payload.college_name || '').trim();
  const sanitizedCollege = rawCollege
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
  if (!sanitizedCollege) {
    errors.college_name = 'College name is required.';
  } else if (sanitizedCollege.length < 2 || sanitizedCollege.length > 120) {
    errors.college_name = 'College name must be between 2 and 120 characters.';
  }

  // 6. Password checks (when creating/setting password)
  if (checkPassword) {
    const password = payload.password || '';
    const confirmPassword = payload.confirm_password || '';

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 10) {
      errors.password = 'Password must be at least 10 characters long.';
    } else if (password.toLowerCase() === rawEmail) {
      errors.password = 'Password cannot be the same as your email address.';
    } else if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.password = 'This password is too common. Please choose a stronger password.';
    }

    if (password !== confirmPassword) {
      errors.confirm_password = 'Passwords do not match.';
    }
  }

  // 7. Consent Checkboxes
  if (!payload.consent_tracking) {
    errors.consent_tracking = 'You must acknowledge time-per-question tracking.';
  }

  if (age < 18 && !payload.consent_guardian) {
    errors.consent_guardian = 'Guardian consent is required for students under 18.';
  }

  const isValid = Object.keys(errors).length === 0;
  const sanitized = {
    first_name: firstName,
    last_name: lastName,
    age,
    email: rawEmail,
    college_name: sanitizedCollege,
  };

  return {
    isValid,
    valid: isValid,
    errors,
    sanitized,
    normalized: sanitized,
  };
}
