import { createHash, randomBytes } from 'crypto';

/** Generates a cryptographically random string (base64url). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 of a token, suitable for storage (so DB leak != token compromise). */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
