import { ToolDefinition } from './schemas';

type CommandActionArg = string | number | boolean | Record<string, unknown>;

export interface DaltonCLICommand {
  name: string;
  description: string;
  action: (...args: CommandActionArg[]) => Promise<void> | void;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: CommandActionArg;
  }>;
}

export interface DaltonCLIPlugin {
  commands?: DaltonCLICommand[];
  tools?: ToolDefinition[];
}
