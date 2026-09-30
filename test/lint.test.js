import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintTools, extractTools } from '../src/index.js';

const good = { name: 'get_weather', description: 'Get weather', inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false } };

test('clean tool has no issues for claude/openai', () => assert.deepEqual(lintTools([good], { providers: ['claude', 'openai'] }), []));
test('bad name', () => assert.ok(lintTools([{ ...good, name: 'get weather!' }]).some((i) => i.rule === 'tool-name')));
test('gemini $ref only flagged for gemini', () => {
  const t = { ...good, inputSchema: { ...good.inputSchema, properties: { city: { $ref: '#/$defs/c' } } } };
  assert.ok(lintTools([t], { providers: ['gemini'] }).some((i) => i.rule === 'gemini-unsupported-keyword'));
  assert.deepEqual(lintTools([t], { providers: ['claude'] }), []);
});
test('required unknown', () => assert.ok(lintTools([{ ...good, inputSchema: { ...good.inputSchema, required: ['x', 'city'] } }]).some((i) => i.rule === 'required-unknown')));
test('root combinator', () => assert.ok(lintTools([{ ...good, inputSchema: { type: 'object', anyOf: [] } }]).some((i) => i.rule === 'root-combinator')));
test('extract from tools/list', () => assert.equal(extractTools({ result: { tools: [good] } }).length, 1));
