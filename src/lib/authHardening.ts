/**
 * Phase 5 Auth Hardening & Password Policy
 * Enforces strong password rules, invite token expiration, and Monitor TOTP MFA.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Validates password against enterprise-grade complexity requirements:
 * - At least 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit (0-9)');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether an account invite link or setup token is within the 24-hour expiration window.
 */
export function validateInviteToken(
  tokenCreatedAt: string | Date,
  now: string | Date = new Date(),
  maxAgeHours: number = 24
): { valid: boolean; reason?: string } {
  const createdMs = typeof tokenCreatedAt === 'string' ? new Date(tokenCreatedAt).getTime() : tokenCreatedAt.getTime();
  const currentMs = typeof now === 'string' ? new Date(now).getTime() : now.getTime();

  if (isNaN(createdMs)) {
    return { valid: false, reason: 'Invalid token creation timestamp' };
  }

  const ageMs = currentMs - createdMs;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  if (ageMs < 0) {
    return { valid: false, reason: 'Token timestamp is in the future' };
  }

  if (ageMs > maxAgeMs) {
    return {
      valid: false,
      reason: `Invite link expired (valid for ${maxAgeHours} hours, issued ${Math.round(ageMs / (60 * 60 * 1000))} hours ago)`,
    };
  }

  return { valid: true };
}

/**
 * Verifies that Monitor accounts satisfy the Multi-Factor Authentication (TOTP MFA) requirement.
 */
export function verifyMfaRequirement(user: {
  role: 'monitor' | 'student';
  is_mfa_enabled?: boolean;
}): { compliant: boolean; actionRequired?: string } {
  if (user.role === 'monitor') {
    if (!user.is_mfa_enabled) {
      return {
        compliant: false,
        actionRequired: 'Monitor account requires TOTP Multi-Factor Authentication (MFA) to access administrative controls.',
      };
    }
  }

  return { compliant: true };
}

