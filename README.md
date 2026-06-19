# obsidian-tasks

Standalone TypeScript library and CLI that parses [Obsidian Tasks](https://publish.obsidian.md/tasks) emoji syntax and executes query blocks outside Obsidian — materializing results as plain markdown to stdout.

Built by [Matthew Watkins](https://www.watkins.dev/).

## Install

```bash
npm install -g @mpwatkins/obsidian-tasks
```

Or use locally in a project:

```bash
npm install @mpwatkins/obsidian-tasks
```

## Setup (development)

```bash
git clone https://github.com/matthewpwatkins/obsidian-tasks.git
cd obsidian-tasks
npm install
npm run build
npm link   # optional: expose `obsidian-tasks` CLI globally
```

Set `VAULT_PATH` to your Obsidian vault root, or pass `--vault`.

## CLI

```bash
# Render TASKS.md with all tasks query fences materialized
obsidian-tasks render TASKS.md --vault /path/to/vault

# Ad-hoc query
obsidian-tasks query "not done\nsort by urgency desc" --vault /path/to/vault

# Sync completions into a daily note after a file change
obsidian-tasks sync-completions --file Areas/Finance/Finance.md --vault /path/to/vault

# Log completions for a date (nightly backstop)
obsidian-tasks log-completions --date 2026-06-17 --vault /path/to/vault
obsidian-tasks log-completions --catch-up --vault /path/to/vault
```

## Library

```typescript
import { scanVault, queryTasks, renderTasksToMarkdown } from '@mpwatkins/obsidian-tasks';

const tasks = await scanVault({ vaultRoot: '/path/to/vault' });
const result = queryTasks(tasks, 'not done\nsort by urgency desc', { today: '2026-06-18' });
console.log(renderTasksToMarkdown(result, { vaultRoot: '/path/to/vault' }));
```

## Tests

```bash
npm test
```

## License

MIT © [Matthew Watkins](https://www.watkins.dev/)
