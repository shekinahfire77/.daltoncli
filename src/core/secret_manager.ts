import * as dotenv from 'dotenv';
import * as keytar from 'keytar';

dotenv.config();

/**
 * Service name identifier for OS keychain storage
 */
const SERVICE_NAME = 'dalton-cli';

/**
 * Registry of secret keys to redact from logs
 */
const knownSecrets: string[] = [];

/**
 * Retrieves a secret from environment variables or OS keychain
 * Checks .env first, then falls back to OS keychain
 * @param key - The secret key identifier
 * @returns The secret value or undefined if not found
 */
export async function getSecret(key: string): Promise<string | undefined> {
  const envSecret = process.env[key];
  if (envSecret) {
    return envSecret;
  }

  const keychainSecret = await keytar.getPassword(SERVICE_NAME, key);
  return keychainSecret || undefined;
}

/**
 * Stores a secret in the OS keychain
 * @param key - The secret key identifier
 * @param value - The secret value to store
 */
export async function setSecret(key: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
  console.log(`Secret '${key}' set in OS keychain.`);
}

/**
 * Deletes a secret from the OS keychain
 * @param key - The secret key identifier
 */
export async function deleteSecret(key: string): Promise<void> {
  const success = await keytar.deletePassword(SERVICE_NAME, key);
  if (success) {
    console.log(`Secret '${key}' deleted from OS keychain.`);
  } else {
    console.warn(`Secret '${key}' not found in OS keychain.`);
  }
}

/**
 * Redacts registered secrets from log messages
 * @param logMessage - The log message to redact
 * @returns The log message with secrets replaced with [REDACTED]
 */
export async function redactSecrets(logMessage: string): Promise<string> {
  let redactedMessage = logMessage;
  for (const secretKey of knownSecrets) {
    const envSecret = process.env[secretKey];
    let secretValue: string | null | undefined;
    if (envSecret) {
      secretValue = envSecret;
    } else {
      secretValue = await keytar.getPassword(SERVICE_NAME, secretKey);
    }

    if (secretValue && typeof secretValue === 'string') {
      redactedMessage = redactedMessage.replace(new RegExp(secretValue, 'g'), '[REDACTED]');
    }
  }
  return redactedMessage;
}

/**
 * Registers a secret key to be redacted from logs
 * @param key - The secret key identifier to register
 */
export function registerSecretForRedaction(key: string): void {
  if (!knownSecrets.includes(key)) {
    knownSecrets.push(key);
  }
}

/**
 * Clears all registered secrets (useful for testing)
 */
export function clearRegisteredSecrets(): void {
  knownSecrets.length = 0;
}
