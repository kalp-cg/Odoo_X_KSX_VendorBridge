import { readFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, type AppConfig } from './env.config';

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const envCfg = loadConfig();
  // Eagerly load keys so we fail fast if they're missing.
  const cfg: AppConfig = {
    ...envCfg,
    jwtPrivateKey: readKey(envCfg.JWT_PRIVATE_KEY_PATH, 'JWT private'),
    jwtPublicKey: readKey(envCfg.JWT_PUBLIC_KEY_PATH, 'JWT public'),
  };
  cached = cfg;
  return cfg;
}

function readKey(p: string, label: string): string {
  try {
    return readFileSync(join(process.cwd(), p), 'utf-8');
  } catch {
    throw new Error(`${label} key not found at ${p}. Run: pnpm keygen`);
  }
}

export { loadConfig, type AppConfig, type EnvConfig } from './env.config';
