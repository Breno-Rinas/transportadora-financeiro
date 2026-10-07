import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDiskStorage, inspectImage, MAX_UPLOAD_BYTES } from './storage.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x10, 0, 0, 0]),
  Buffer.from('WEBPVP8 ', 'latin1'),
]);

const invalidFile = expect.objectContaining({ code: 'VALIDATION_ERROR' });

describe('inspectImage', () => {
  it.each([
    [PNG, 'image/png', 'png'],
    [JPEG, 'image/jpeg', 'jpg'],
    [WEBP, 'image/webp', 'webp'],
  ])('reconhece o tipo pelo conteúdo (%#)', (buffer, mimeType, extension) => {
    const image = inspectImage({ buffer, originalName: 'foto' });
    expect(image).toMatchObject({ mimeType, extension, sizeBytes: buffer.length });
    expect(image.sha256).toBe(createHash('sha256').update(buffer).digest('hex'));
  });

  it('recusa o que não é JPEG, PNG ou WEBP, mesmo com extensão de imagem', () => {
    const gif = Buffer.from('GIF89a', 'latin1');
    expect(() => inspectImage({ buffer: gif, originalName: 'foto.png' })).toThrow(invalidFile);
  });

  it('recusa arquivo vazio e arquivo acima de 10 MB', () => {
    expect(() => inspectImage({ buffer: Buffer.alloc(0), originalName: 'a.png' })).toThrow(
      invalidFile,
    );
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(() => inspectImage({ buffer: big, originalName: 'a.png' })).toThrow(invalidFile);
  });
});

describe('createDiskStorage', () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  it('grava como <uuid>.<extensão> e remove', async () => {
    directory = mkdtempSync(join(tmpdir(), 'transportadora-storage-'));
    const storage = createDiskStorage(directory);

    const storagePath = await storage.save(inspectImage({ buffer: PNG, originalName: 'x.png' }));
    expect(storagePath).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(readFileSync(join(directory, storagePath)).equals(PNG)).toBe(true);

    await storage.remove(storagePath);
    expect(existsSync(join(directory, storagePath))).toBe(false);
  });
});
