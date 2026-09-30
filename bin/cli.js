#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { lintTools, extractTools } from '../src/index.js';

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log(`Usage: mcp-tool-schema-lint <tools.json | -> [--providers claude,openai,gemini] [--json] [--strict]

  <file>       JSON file: tools array, { tools }, or a tools/list response ("-" reads stdin)
  --providers  Comma-separated providers to check (default: all)
  --json       Print issues as JSON
  --strict     Exit non-zero on warnings too`);
  process.exit(args.length ? 0 : 2);
}
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => (a === '-' || !a.startsWith('-')) && args[i - 1] !== '--providers');
const providers = opt('--providers')?.split(',').map((s) => s.trim().toLowerCase());

let tools;
try { tools = extractTools(JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'))); }
catch (e) { console.error(`error: ${e.message}`); process.exit(2); }

const issues = lintTools(tools, providers ? { providers } : undefined);
if (args.includes('--json')) console.log(JSON.stringify(issues, null, 2));
else {
  for (const i of issues) console.log(`${i.severity === 'error' ? '✖' : '⚠'} ${i.tool}  ${i.path}  ${i.message}  [${i.rule}; ${i.providers.join(', ')}]`);
  const errs = issues.filter((i) => i.severity === 'error').length;
  console.log(`\n${tools.length} tools, ${errs} errors, ${issues.length - errs} warnings`);
}
process.exit(issues.some((i) => i.severity === 'error') || (args.includes('--strict') && issues.length) ? 1 : 0);
