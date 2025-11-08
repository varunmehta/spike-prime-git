/**
 * PKCE (Proof Key for Code Exchange) utilities for secure OAuth flow
 * Used for GitHub App authentication without client_secret
 */

/**
 * Base64 URL encode without padding
 * @param {ArrayBuffer} buffer - Buffer to encode
 * @returns {string} Base64 URL encoded string
 */
function base64URLEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random code verifier (43-128 characters)
 * @returns {string} Random code verifier
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32); // 32 bytes = 43 chars when base64url encoded
  crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

/**
 * Generate a code challenge from a verifier using SHA-256
 * @param {string} verifier - Code verifier
 * @returns {Promise<string>} Code challenge
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(hash);
}

/**
 * Generate both verifier and challenge for PKCE flow
 * @returns {Promise<{verifier: string, challenge: string}>}
 */
export async function generatePKCECodes() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return { verifier, challenge };
}

/**
 * Generate a random state parameter for OAuth security
 * @returns {string} Random state string
 */
export function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}
