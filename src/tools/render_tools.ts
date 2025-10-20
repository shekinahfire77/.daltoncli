import axios from 'axios';
import { getSecret } from '../core/secret_manager';
import { ToolDefinition } from '../core/schemas';

export const list_render_services: ToolDefinition = {
  name: 'list_render_services',
  description: 'Lists all services deployed on Render.com.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  isNetworkTool: true,
  func: async () => {
    const renderApiKey = await getSecret('RENDER_API_KEY');
    if (!renderApiKey) {
      throw new Error("RENDER_API_KEY not found. Please set it via 'dalton-cli configure secret set RENDER_API_KEY <your_key>' or in your .env file.");
    }

    try {
      const response = await axios.get('https://api.render.com/v1/services', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${renderApiKey}`,
        },
      });
      return JSON.stringify(response.data, null, 2);
    } catch (error: any) {
      console.error("Error listing Render services:", error.message);
      throw new Error(`Failed to list Render services: ${error.response?.data?.message || error.message}`);
    }
  },
};
