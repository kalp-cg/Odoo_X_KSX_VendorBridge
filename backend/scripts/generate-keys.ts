// Generates RS256 keypair for JWT signing/verification.
import { generateKeyPairSync } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(__dirname, '..', 'keys');
const PRIV_PATH = join(KEYS_DIR, 'jwt_private.pem');
const PUB_PATH = join(KEYS_DIR, 'jwt_public.pem');

if (!existsSync(KEYS_DIR)) {
  mkdirSync(KEYS_DIR, { recursive: true });
}

if (existsSync(PRIV_PATH) && existsSync(PUB_PATH)) {
  console.log(`Keys already exist at ${KEYS_DIR}. Delete them first to regenerate.`);
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(PRIV_PATH, privateKey, { mode: 0o600 });
writeFileSync(PUB_PATH, publicKey, { mode: 0o644 });
console.log(`Wrote ${PRIV_PATH} and ${PUB_PATH}`);
