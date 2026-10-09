export type Provider = 'claude' | 'openai' | 'gemini';

export interface Issue {
  /** Tool name, or `<unnamed>` when missing. */
  tool: string;
  /** Dotted path to the offending node, e.g. `inputSchema.properties.q`. */
  path: string;
  rule: string;
  severity: 'error' | 'warning';
  providers: Provider[];
  message: string;
}

export interface McpTool {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LintOptions {
  /** Providers to check against. Defaults to all three. */
  providers?: Provider[];
}

/** Lint an array of MCP tool definitions. */
export function lintTools(tools: McpTool[], options?: LintOptions): Issue[];

/** Extract tools from a tools/list response, `{ tools: [...] }`, or a bare array. Throws otherwise. */
export function extractTools(json: unknown): McpTool[];
