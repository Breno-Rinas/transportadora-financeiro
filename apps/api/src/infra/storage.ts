import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DomainError } from '../domain/errors.js';

/** Limite de tamanho dos arquivos enviados (o multipart do Fastify usa o mesmo valor). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageUpload {
  buffer: Buffer;
  originalName: string;
}

/** Imagem validada, ainda não gravada. O sha256 é o que o R6 compara no reenvio da foto. */
export interface InspectedImage extends ImageUpload {
  mimeType: ImageMimeType;
  extension: string;
  sizeBytes: number;
  sha256: string;
}

export interface FileStorage {
  /** Valida tipo e tamanho e calcula o sha256, sem gravar nada. */
  inspectImage(upload: ImageUpload): InspectedImage;
  /** Grava o arquivo com nome `<uuid>.<extensão>` e devolve esse nome (o `storagePath`). */
  save(image: InspectedImage): Promise<string>;
  /** Remove um arquivo gravado (ex.: a transação que o registraria falhou). */
  remove(storagePath: string): Promise<void>;
}

interface ImageSignature {
  mimeType: ImageMimeType;
  extension: string;
  matches: (bytes: Buffer) => boolean;
}

// O tipo vem do conteúdo (assinatura do arquivo), não do mimetype declarado pelo navegador.
const IMAGE_SIGNATURES: readonly ImageSignature[] = [
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (bytes) =>
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (bytes) =>
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

function invalidFile(message: string): DomainError {
  return new DomainError('VALIDATION_ERROR', message, [{ path: 'file', message }]);
}

export function inspectImage(upload: ImageUpload): InspectedImage {
  const sizeBytes = upload.buffer.length;
  if (sizeBytes === 0) throw invalidFile('O arquivo enviado está vazio.');
  if (sizeBytes > MAX_UPLOAD_BYTES) throw invalidFile('A foto deve ter no máximo 10 MB.');

  const signature = IMAGE_SIGNATURES.find((candidate) => candidate.matches(upload.buffer));
  if (signature === undefined) {
    throw invalidFile('A foto deve ser uma imagem JPEG, PNG ou WEBP.');
  }

  return {
    ...upload,
    mimeType: signature.mimeType,
    extension: signature.extension,
    sizeBytes,
    sha256: createHash('sha256').update(upload.buffer).digest('hex'),
  };
}

/** Arquivos em disco, na pasta servida em `/uploads/*`. */
export function createDiskStorage(directory: string): FileStorage {
  return {
    inspectImage,
    async save(image) {
      const storagePath = `${randomUUID()}.${image.extension}`;
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, storagePath), image.buffer, { flag: 'wx' });
      return storagePath;
    },
    async remove(storagePath) {
      await rm(join(directory, storagePath), { force: true });
    },
  };
}
