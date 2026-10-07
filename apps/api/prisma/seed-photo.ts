import { crc32, deflateSync } from 'node:zlib';

// Foto do carregamento do seed: um PNG pequeno (160x100) gerado em código, sem arquivo binário no
// repositório. Desenha céu, estrada e um caminhão com a carroceria na cor pedida.

type Rgb = readonly [number, number, number];

const WIDTH = 160;
const HEIGHT = 100;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SKY_TOP: Rgb = [120, 170, 230];
const SKY_BOTTOM: Rgb = [200, 225, 250];
const ROAD: Rgb = [90, 92, 98];
const STRIPE: Rgb = [245, 245, 245];
const CAB: Rgb = [235, 235, 240];
const WINDOW: Rgb = [60, 90, 130];
const TIRE: Rgb = [30, 30, 35];
const HUB: Rgb = [170, 170, 175];

const isInRect = (x: number, y: number, left: number, top: number, right: number, bottom: number) =>
  x >= left && x <= right && y >= top && y <= bottom;

const isInCircle = (x: number, y: number, cx: number, cy: number, radius: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;

function pixelAt(x: number, y: number, cargo: Rgb): Rgb {
  for (const wheelX of [40, 62, 120]) {
    if (isInCircle(x, y, wheelX, 78, 4)) return HUB;
    if (isInCircle(x, y, wheelX, 78, 9)) return TIRE;
  }
  if (isInRect(x, y, 26, 34, 104, 74)) return cargo;
  if (isInRect(x, y, 122, 46, 134, 58)) return WINDOW;
  if (isInRect(x, y, 108, 42, 138, 74)) return CAB;
  if (y >= 70) return y >= 84 && y <= 86 && x % 20 < 10 ? STRIPE : ROAD;

  const t = y / 70;
  const mix = (top: number, bottom: number) => Math.round(top * (1 - t) + bottom * t);
  return [
    mix(SKY_TOP[0], SKY_BOTTOM[0]),
    mix(SKY_TOP[1], SKY_BOTTOM[1]),
    mix(SKY_TOP[2], SKY_BOTTOM[2]),
  ];
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** PNG RGB de 8 bits; a cor da carroceria muda de viagem para viagem. */
export function createLoadingPhoto(cargo: Rgb): Buffer {
  const rowLength = WIDTH * 3 + 1;
  const raw = Buffer.alloc(rowLength * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    raw[y * rowLength] = 0; // filtro "None"
    for (let x = 0; x < WIDTH; x += 1) {
      const [r, g, b] = pixelAt(x, y, cargo);
      raw.set([r, g, b], y * rowLength + 1 + x * 3);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, deflate, filtro padrão, sem entrelaçamento

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
