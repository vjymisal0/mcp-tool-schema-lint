# mcp-tool-schema-lint

Lint your MCP server's tool definitions against the JSON Schema rules of **Claude**, **OpenAI** and **Gemini**, so a schema that one provider rejects is caught in CI instead of at runtime.

## CLI

```sh
npx mcp-tool-schema-lint tools.json
npx mcp-tool-schema-lint tools.json --providers gemini --json
```

Input can be a tools array, `{ "tools": [...] }`, or a raw JSON-RPC `tools/list` response (`-` reads stdin). Exits `1` on errors, or on warnings too with `--strict`.

## API

```js
import { lintTools } from 'mcp-tool-schema-lint';
const issues = lintTools(tools, { providers: ['openai', 'gemini'] });
```

Each issue: `{ tool, path, rule, severity, providers, message }`.

## Rules

| Rule | Providers | Checks |
|---|---|---|
| tool-name, duplicate-name | all | name matches `^[a-zA-Z0-9_-]{1,64}$` and is unique |
| missing-description | all | description is present |
| description-length | openai | description ≤ 1024 chars |
| root-object | all | root schema is `type: "object"` |
| root-combinator | claude, openai | no anyOf/oneOf/allOf/enum/not at the root |
| required-unknown | all | every `required` key is defined |
| array-items | openai, gemini | arrays declare `items` |
| gemini-unsupported-keyword, type-array, enum-strings, gemini-format | gemini | keywords Gemini function declarations reject |
| strict-all-required, strict-additional-properties, max-depth | openai | OpenAI strict-mode requirements |

Provider rules change often; issues and PRs are welcome.

## License

MIT
