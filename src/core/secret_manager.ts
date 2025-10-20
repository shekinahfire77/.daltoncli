import * as dotenv from 'dotenv';
import * as keytar from 'keytar'; // keytar needs to be installed: npm install keytar @types/keytar

dotenv.config(); // Load .env file

const SERVICE_NAME = 'dalton-cli';

// Function to get a secret from .env or keychain
export async function getSecret(key: string): Promise<string | undefined> {
  // Try .env first
  const envSecret = process.env[key];
  if (envSecret) {
    return envSecret;
  }

  // Then try OS keychain
  const keychainSecret = await keytar.getPassword(SERVICE_NAME, key);
  return keychainSecret || undefined;
}

// Function to set a secret in the OS keychain
export async function setSecret(key: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
  console.log(`Secret '${key}' set in OS keychain.`);
}

// Function to delete a secret from the OS keychain
export async function deleteSecret(key: string): Promise<void> {
  const success = await keytar.deletePassword(SERVICE_NAME, key);
  if (success) {
    console.log(`Secret '${key}' deleted from OS keychain.`);
  } else {
    console.warn(`Secret '${key}' not found in OS keychain.`);
  }
}

// Simple redaction function for logs
const knownSecrets: string[] = []; // This would be populated with keys of sensitive info
export async function redactSecrets(logMessage: string): Promise<string> {
  let redactedMessage = logMessage;
  for (const secretKey of knownSecrets) {
    const envSecret = process.env[secretKey];
    let secretValue: string | undefined;
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

// Function to register a secret key for redaction
export function registerSecretForRedaction(key: string): void {
  if (!knownSecrets.includes(key)) {
    knownSecrets.push(key);
  }
}

// Function to clear registered secrets (mainly for testing)
export function clearRegisteredSecrets(): void {
  knownSecrets.length = 0;
}
