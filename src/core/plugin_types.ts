import { ToolDefinition } from './schemas';

export interface DaltonCLICommand {
  name: string;
  description: string;
  action: (...args: any[]) => Promise<void> | void;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: any;
  }>;
}

export interface DaltonCLIPlugin {
  commands?: DaltonCLICommand[];
  tools?: ToolDefinition[];
}
