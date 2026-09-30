const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const GEMINI_UNSUPPORTED = ['$ref', '$defs', 'definitions', 'oneOf', 'allOf', 'not', 'patternProperties', 'additionalProperties', 'const', 'if', 'then', 'else', '$schema'];

/** @typedef {{ tool: string, path: string, rule: string, severity: 'error'|'warning', providers: string[], message: string }} Issue */

function walk(schema, path, visit) {
  if (!schema || typeof schema !== 'object') return;
  visit(schema, path);
  for (const [k, v] of Object.entries(schema.properties || {})) walk(v, `${path}.properties.${k}`, visit);
  if (schema.items && !Array.isArray(schema.items)) walk(schema.items, `${path}.items`, visit);
  for (const key of ['anyOf', 'oneOf', 'allOf']) (schema[key] || []).forEach((s, i) => walk(s, `${path}.${key}[${i}]`, visit));
  for (const key of ['$defs', 'definitions']) for (const [k, v] of Object.entries(schema[key] || {})) walk(v, `${path}.${key}.${k}`, visit);
}

function depth(schema) {
  if (!schema || typeof schema !== 'object') return 0;
  const kids = [...Object.values(schema.properties || {}), ...(schema.items && !Array.isArray(schema.items) ? [schema.items] : [])];
  return 1 + Math.max(0, ...kids.map(depth));
}

/**
 * Lint an array of MCP tool definitions ({ name, description, inputSchema }).
 * @param {Array<object>} tools
 * @param {{ providers?: string[] }} [opts]
 * @returns {Issue[]}
 */
export function lintTools(tools, { providers = ['claude', 'openai', 'gemini'] } = {}) {
  const issues = [];
  const add = (tool, path, rule, severity, provs, message) => {
    const ps = provs.filter((p) => providers.includes(p));
    if (ps.length) issues.push({ tool, path, rule, severity, providers: ps, message });
  };
  const ALL = ['claude', 'openai', 'gemini'];
  const seen = new Set();

  for (const t of tools) {
    const name = t?.name ?? '<unnamed>';
    if (!NAME_RE.test(name)) add(name, 'name', 'tool-name', 'error', ALL, 'Tool name must match ^[a-zA-Z0-9_-]{1,64}$.');
    if (seen.has(name)) add(name, 'name', 'duplicate-name', 'error', ALL, 'Duplicate tool name.');
    seen.add(name);

    if (!t?.description?.trim()) add(name, 'description', 'missing-description', 'warning', ALL, 'Missing description; models pick tools largely from it.');
    else if (t.description.length > 1024) add(name, 'description', 'description-length', 'error', ['openai'], `Description is ${t.description.length} chars; OpenAI limits it to 1024.`);

    const s = t?.inputSchema;
    if (!s) { add(name, 'inputSchema', 'missing-schema', 'error', ALL, 'Missing inputSchema.'); continue; }
    if (s.type !== 'object') add(name, 'inputSchema.type', 'root-object', 'error', ALL, 'Root inputSchema must have type "object".');
    for (const k of ['anyOf', 'oneOf', 'allOf', 'enum', 'not'])
      if (k in s) add(name, `inputSchema.${k}`, 'root-combinator', 'error', ['openai', 'claude'], `"${k}" is not allowed at the root of a tool schema.`);
    const d = depth(s);
    if (d > 5) add(name, 'inputSchema', 'max-depth', 'warning', ['openai'], `Schema nests ${d} levels; OpenAI strict mode allows 5.`);

    walk(s, 'inputSchema', (node, path) => {
      for (const k of GEMINI_UNSUPPORTED)
        if (k in node) add(name, `${path}.${k}`, 'gemini-unsupported-keyword', 'error', ['gemini'], `Gemini function declarations do not support "${k}".`);
      if (Array.isArray(node.type)) add(name, `${path}.type`, 'type-array', 'warning', ['gemini'], 'Gemini does not accept type arrays; use "nullable": true.');
      if (node.type === 'object' && node.properties) {
        const req = new Set(node.required || []);
        for (const r of req) if (!(r in node.properties)) add(name, `${path}.required`, 'required-unknown', 'error', ALL, `"${r}" is required but not defined in properties.`);
        const optional = Object.keys(node.properties).filter((p) => !req.has(p));
        if (optional.length) add(name, `${path}.required`, 'strict-all-required', 'warning', ['openai'], `OpenAI strict mode requires every property in "required" (optional: ${optional.join(', ')}).`);
        if (node.additionalProperties !== false) add(name, path, 'strict-additional-properties', 'warning', ['openai'], 'OpenAI strict mode requires "additionalProperties": false.');
      }
      if (node.type === 'array' && !node.items) add(name, path, 'array-items', 'error', ['openai', 'gemini'], 'Array schema is missing "items".');
      if (node.enum && node.enum.some((v) => typeof v !== 'string')) add(name, `${path}.enum`, 'enum-strings', 'warning', ['gemini'], 'Gemini only supports string enums.');
      if (node.format && !['date-time', 'enum'].includes(node.format)) add(name, `${path}.format`, 'gemini-format', 'warning', ['gemini'], `Gemini ignores or rejects format "${node.format}".`);
    });
  }
  return issues;
}

/** Extract tools from a tools/list response, `{ tools: [...] }`, or a bare array. */
export function extractTools(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.tools)) return json.tools;
  if (Array.isArray(json?.result?.tools)) return json.result.tools;
  throw new Error('Expected an array of tools, { tools: [...] }, or a JSON-RPC tools/list response.');
}
