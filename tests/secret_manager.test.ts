import { getSecret, setSecret, deleteSecret, redactSecrets, registerSecretForRedaction, clearRegisteredSecrets } from '../src/core/secret_manager';
import * as keytar from 'keytar';

describe('Secret Manager', () => {
  const MOCK_SERVICE_NAME = 'dalton-cli';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TEST_ENV_SECRET = undefined; // Clear env var before each test
  });

  describe('getSecret', () => {
    it('should retrieve secret from process.env if available', async () => {
      process.env.TEST_ENV_SECRET = 'env_value';
      const secret = await getSecret('TEST_ENV_SECRET');
      expect(secret).toBe('env_value');
      expect(keytar.getPassword).not.toHaveBeenCalled();
    });

    it('should retrieve secret from keytar if not in process.env', async () => {
      (keytar.getPassword as jest.Mock).mockResolvedValue('keytar_value');
      const secret = await getSecret('TEST_KEYTAR_SECRET');
      expect(secret).toBe('keytar_value');
      expect(keytar.getPassword).toHaveBeenCalledWith(MOCK_SERVICE_NAME, 'TEST_KEYTAR_SECRET');
    });

    it('should return undefined if secret not found in env or keytar', async () => {
      (keytar.getPassword as jest.Mock).mockResolvedValue(undefined);
      const secret = await getSecret('NON_EXISTENT_SECRET');
      expect(secret).toBeUndefined();
    });
  });

  describe('setSecret', () => {
    it('should set secret in keytar', async () => {
      await setSecret('NEW_SECRET', 'new_value');
      expect(keytar.setPassword).toHaveBeenCalledWith(MOCK_SERVICE_NAME, 'NEW_SECRET', 'new_value');
    });
  });

  describe('deleteSecret', () => {
    it('should delete secret from keytar if it exists', async () => {
      (keytar.deletePassword as jest.Mock).mockResolvedValue(true);
      await deleteSecret('SECRET_TO_DELETE');
      expect(keytar.deletePassword).toHaveBeenCalledWith(MOCK_SERVICE_NAME, 'SECRET_TO_DELETE');
    });

    it('should warn if secret not found in keytar', async () => {
      (keytar.deletePassword as jest.Mock).mockResolvedValue(false);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await deleteSecret('NON_EXISTENT_SECRET');
      expect(consoleWarnSpy).toHaveBeenCalledWith(`Secret 'NON_EXISTENT_SECRET' not found in OS keychain.`);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('redactSecrets', () => {
    beforeEach(() => {
      // Clear registered secrets before each test
      clearRegisteredSecrets();
    });

    it('should redact secrets from log message', async () => {
      process.env.API_KEY = 'supersecretkey';
      registerSecretForRedaction('API_KEY');

      const logMessage = 'This log contains API_KEY: supersecretkey and some other info.';
      const redacted = await redactSecrets(logMessage);
      expect(redacted).toBe('This log contains API_KEY: [REDACTED] and some other info.');
    });

    it('should redact multiple occurrences of the same secret', async () => {
      process.env.TOKEN = 'mytoken123';
      registerSecretForRedaction('TOKEN');

      const logMessage = 'Token: mytoken123. Another token: mytoken123.';
      const redacted = await redactSecrets(logMessage);
      expect(redacted).toBe('Token: [REDACTED]. Another token: [REDACTED].');
    });

    it('should redact secrets from keytar', async () => {
      (keytar.getPassword as jest.Mock).mockResolvedValue('keytar_secret_value');
      registerSecretForRedaction('KEYTAR_SECRET');

      const logMessage = 'Keytar secret is: keytar_secret_value.';
      const redacted = await redactSecrets(logMessage);
      expect(redacted).toBe('Keytar secret is: [REDACTED].');
    });

    it('should not redact unknown secrets', async () => {
      const logMessage = 'This is a normal log message.';
      const redacted = await redactSecrets(logMessage);
      expect(redacted).toBe(logMessage);
    });
  });
});
