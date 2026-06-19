# obsidian-tasks

Standalone TypeScript library and CLI that parses [Obsidian Tasks](https://publish.obsidian.md/tasks) emoji syntax and executes query blocks outside Obsidian — materializing results as plain markdown to stdout.

Built by [Matthew Watkins](https://www.watkins.dev/).

## Why this exists

The [Obsidian Tasks plugin](https://publish.obsidian.md/tasks) stores tasks as plain markdown on disk — but **query results are not**. Tasks query blocks in your vault are only query *definitions*; the plugin evaluates them in JavaScript when Obsidian renders the note. On the filesystem you see filters like `not done` and `sort by urgency`, not the matching task lines.

That works fine inside Obsidian. It breaks down for everything else:

- **Scripts and cron jobs** cannot read "what's due today" without reimplementing the query engine.
- **`grep`, git, and CI** see query source, not answers.
- **AI agents and automation** can edit task lines but cannot evaluate dashboards, urgency ordering, blocked-task graphs, or dynamic dates like `today`.

This package closes that gap. It parses the Tasks emoji task format, executes the query language your vault actually uses, and prints materialized markdown to stdout — without mutating your source files. Tasks stay where you wrote them (area files, project notes, daily notes); automation reads the same `TASKS.md` query blocks you use in Obsidian, with `today` and date math resolved at execution time.

Typical uses: render a vault dashboard from the shell, sync completed tasks into daily notes on file save, nightly completion logging, and building agent or MCP tooling on top of a real library API.

## Install

```bash
npm install -g @watkins-dev/obsidian-tasks
```

Or use locally in a project:

```bash
npm install @watkins-dev/obsidian-tasks
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
import { scanVault, queryTasks, renderTasksToMarkdown } from '@watkins-dev/obsidian-tasks';

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
