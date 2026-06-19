#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import {
  getCatchUpDates,
  logCompletionsForDate,
  syncCompletionsForChangedFile,
  yesterday,
} from './completions.js';
import { resolveVaultRoot } from './config.js';
import { getToday, scanVault } from './parse.js';
import { queryTasks } from './query/execute.js';
import { renderFile, renderTasksToMarkdown } from './render.js';

const program = new Command();

program
  .name('obsidian-tasks')
  .description('Parse and execute Obsidian Tasks queries outside Obsidian')
  .option('--vault <path>', 'Path to Obsidian vault');

async function loadTasks(vaultRoot: string) {
  return scanVault({ vaultRoot, includeArchive: true });
}

program
  .command('render')
  .argument('<file>', 'Markdown file to render')
  .option('--no-backlinks', 'Omit origin backlinks')
  .action(async (file: string, opts: { backlinks?: boolean }, cmd) => {
    const vaultRoot = resolveVaultRoot({ vault: cmd.parent?.opts().vault });
    const filePath = path.isAbsolute(file) ? file : path.join(vaultRoot, file);
    const markdown = fs.readFileSync(filePath, 'utf8');
    const tasks = await loadTasks(vaultRoot);
    const today = getToday();

    const output = renderFile(markdown, (queryText) => {
      const result = queryTasks(tasks, queryText, { today, vaultRoot });
      return renderTasksToMarkdown(result, {
        vaultRoot,
        includeBacklinks: opts.backlinks !== false,
      });
    });

    process.stdout.write(output);
  });

program
  .command('query')
  .argument('<query>', 'Query text (use quotes)')
  .option('--no-backlinks', 'Omit origin backlinks')
  .action(async (query: string, opts: { backlinks?: boolean }, cmd) => {
    const vaultRoot = resolveVaultRoot({ vault: cmd.parent?.opts().vault });
    const tasks = await loadTasks(vaultRoot);
    const today = getToday();
    const result = queryTasks(tasks, query, { today, vaultRoot });
    const output = renderTasksToMarkdown(result, {
      vaultRoot,
      includeBacklinks: opts.backlinks !== false,
    });
    process.stdout.write(output + (output.length > 0 ? '\n' : ''));
  });

program
  .command('log-completions')
  .option('--date <date>', 'Date to log (YYYY-MM-DD)')
  .option('--dry-run', 'Print changes without writing')
  .option('--catch-up', 'Process missed days since last run')
  .option('--state-file <path>', 'State file for catch-up tracking')
  .action(async (opts, cmd) => {
    const vaultRoot = resolveVaultRoot({ vault: cmd.parent?.opts().vault });
    const today = getToday();
    const targetDate = opts.date ?? yesterday(today);
    const stateFile =
      opts.stateFile ?? path.join(vaultRoot, '.scripts', '.completions-state.json');

    const dates: string[] = [targetDate];

    if (opts.catchUp) {
      let lastRun: string | null = null;
      if (fs.existsSync(stateFile)) {
        try {
          const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as { lastRun?: string };
          lastRun = state.lastRun ?? null;
        } catch {
          lastRun = null;
        }
      }
      dates.length = 0;
      dates.push(...getCatchUpDates(lastRun, targetDate));
      if (dates.length === 0) dates.push(targetDate);
    }

    let anyChanged = false;
    for (const date of dates) {
      const result = logCompletionsForDate({
        vaultRoot,
        date,
        dryRun: opts.dryRun,
      });
      if (result) {
        if (result.changed) anyChanged = true;
        if (opts.dryRun) {
          process.stderr.write(`Would update ${path.relative(vaultRoot, result.filePath)} for ${date}\n`);
        } else {
          process.stderr.write(`Updated ${path.relative(vaultRoot, result.filePath)} for ${date}\n`);
        }
      } else {
        process.stderr.write(`No daily note found for ${date}\n`);
      }
    }

    if (!opts.dryRun && anyChanged) {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({ lastRun: targetDate }, null, 2));
    }
  });

program
  .command('sync-completions')
  .description('Sync daily note task logs after a file change (or for a date)')
  .option('--file <path>', 'Markdown file that changed')
  .option('--date <date>', 'Sync all completions for this date (YYYY-MM-DD)')
  .option('--dry-run', 'Print changes without writing')
  .action(async (opts, cmd) => {
    const vaultRoot = resolveVaultRoot({ vault: cmd.parent?.opts().vault });

    if (opts.file) {
      const filePath = path.isAbsolute(opts.file) ? opts.file : path.join(vaultRoot, opts.file);
      const result = syncCompletionsForChangedFile(vaultRoot, filePath, opts.dryRun);
      for (const rel of result.updated) {
        process.stderr.write(`${opts.dryRun ? 'Would update' : 'Updated'} ${rel}\n`);
      }
      return;
    }

    if (opts.date) {
      const outcome = logCompletionsForDate({ vaultRoot, date: opts.date, dryRun: opts.dryRun });
      if (outcome) {
        process.stderr.write(
          `${opts.dryRun ? 'Would update' : 'Updated'} ${path.relative(vaultRoot, outcome.filePath)} for ${opts.date}\n`,
        );
      } else {
        process.stderr.write(`No daily note found for ${opts.date}\n`);
      }
      return;
    }

    process.stderr.write('Provide --file or --date\n');
    process.exit(1);
  });

program.parse();
