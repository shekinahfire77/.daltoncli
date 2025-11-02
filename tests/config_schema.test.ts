import { configSchema } from '../src/core/schemas';
import * as fs from 'fs';
import * as path from 'path';

describe('Repository config.json schema validation', () => {
  it('validates config.json against configSchema', () => {
    const configPath = path.join(__dirname, '..', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = configSchema.safeParse(parsed);
    if (!result.success) {
      // Provide errors in test output for easier debugging
      // eslint-disable-next-line no-console
      console.error('Config schema validation errors:', result.error.format());
    }
    expect(result.success).toBe(true);
  });
});
