import { createHash } from 'node:crypto';
import fsStream from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../config.ts';
import { sanitizeFileName } from './format.ts';

export async function ensureUploadRoot() {
  await fs.mkdir(config.uploadRoot, { recursive: true });
}

export async function writeUpload(folderIme: string, source: File) {
  const safeFolder = sanitizeFileName(folderIme);
  const folderPath = path.join(config.uploadRoot, safeFolder);
  await fs.mkdir(folderPath, { recursive: true });

  const base = sanitizeFileName(source.name || 'fajl');
  const fileName = `${Date.now()}-${nanoid(8)}-${base}`;
  const fullPath = path.join(folderPath, fileName);

  await Bun.write(fullPath, source);
  return fullPath;
}

export async function deleteStoredFile(serverPath: string) {
  try {
    await fs.unlink(serverPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function hashStoredFileSha256(serverPath: string) {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fsStream.createReadStream(serverPath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
