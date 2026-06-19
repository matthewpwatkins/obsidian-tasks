import fs from 'fs';
import path from 'path';

export interface VaultConfig {
  vaultRoot: string;
  includeArchive: boolean;
  includeTemplates: boolean;
}

export function resolveVaultRoot(options?: { vault?: string; cwd?: string }): string {
  if (options?.vault) {
    return path.resolve(options.vault);
  }
  if (process.env.VAULT_PATH) {
    return path.resolve(process.env.VAULT_PATH);
  }
  return path.resolve(options?.cwd ?? process.cwd());
}

export function resolveDailyNotePath(vaultRoot: string, date: string): string | null {
  const [year, month] = date.split('-');
  if (!year || !month) return null;

  const monthDir = path.join(vaultRoot, 'Timeline', year, month);
  const prefix = `${date} `;
  if (!fs.existsSync(monthDir)) return null;
  const entries = fs.readdirSync(monthDir);
  const match = entries.find((name) => name.startsWith(prefix) && name.endsWith('.md'));
  return match ? path.join(monthDir, match) : null;
}

export function relativePathWithoutExt(filePath: string, vaultRoot: string): string {
  const rel = path.relative(vaultRoot, filePath).replace(/\\/g, '/');
  return rel.replace(/\.md$/i, '');
}
