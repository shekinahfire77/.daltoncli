import { list_render_services } from '../src/tools/render_tools';
import axios from 'axios';
import { getSecret } from '../src/core/secret_manager';

// Mock axios
jest.mock('axios');

// Mock getSecret
jest.mock('../src/core/secret_manager', () => ({
  getSecret: jest.fn(),
}));

describe('Render Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list_render_services', () => {
    it('should successfully list Render services', async () => {
      (getSecret as jest.Mock).mockResolvedValue('mock-render-api-key');
      (axios.get as jest.Mock).mockResolvedValue({
        data: [
          { id: 'srv-1', name: 'service-1' },
          { id: 'srv-2', name: 'service-2' },
        ],
      });

      const result = await list_render_services.func();
      expect(getSecret).toHaveBeenCalledWith('RENDER_API_KEY');
      expect(axios.get).toHaveBeenCalledWith('https://api.render.com/v1/services', {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-render-api-key',
        },
      });
      expect(result).toBe(JSON.stringify([
        { id: 'srv-1', name: 'service-1' },
        { id: 'srv-2', name: 'service-2' },
      ], null, 2));
    });

    it('should throw error if RENDER_API_KEY is not found', async () => {
      (getSecret as jest.Mock).mockResolvedValue(undefined);

      await expect(list_render_services.func()).rejects.toThrow(
        "RENDER_API_KEY not found. Please set it via 'dalton-cli configure secret set RENDER_API_KEY <your_key>' or in your .env file."
      );
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      (getSecret as jest.Mock).mockResolvedValue('mock-render-api-key');
      (axios.get as jest.Mock).mockRejectedValue({
        message: 'Network Error',
        response: { data: { message: 'Render API is down' } },
      });

      await expect(list_render_services.func()).rejects.toThrow(
        'Failed to list Render services: Render API is down'
      );
      expect(axios.get).toHaveBeenCalled();
    });
  });
});
