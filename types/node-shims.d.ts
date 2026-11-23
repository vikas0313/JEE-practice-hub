// ============================================================
// JEE Practice Hub — Node.js Type Declarations for CLI & Tests
// Provides TypeScript definitions for Node builtins without external npm network installs.
// ============================================================

declare var Buffer: {
  alloc(size: number, fill?: string | number, encoding?: string): Buffer;
  from(array: Uint8Array | readonly number[]): Buffer;
  from(str: string, encoding?: string): Buffer;
  concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
  byteLength(string: string | Buffer | Uint8Array, encoding?: string): number;
  isBuffer(obj: any): obj is Buffer;
};

interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
  writeUInt32BE(value: number, offset: number): number;
  readUInt32BE(offset: number): number;
  indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
  includes(value: string | number | Buffer, byteOffset?: number, encoding?: string): boolean;
  subarray(start?: number, end?: number): Buffer;
}

declare var process: {
  cwd(): string;
  argv: string[];
  exit(code?: number): never;
};

declare var __dirname: string;

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, options?: any): any;
  export function readdirSync(path: string, options?: any): string[];
  export function writeFileSync(path: string, data: any, options?: any): void;
  export function mkdirSync(path: string, options?: any): void;
  export function rmSync(path: string, options?: any): void;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
}

declare module 'node:zlib' {
  export function deflateSync(buf: Uint8Array | Buffer, options?: any): Buffer;
  export function inflateSync(buf: Uint8Array | Buffer, options?: any): Buffer;
  export function inflateRawSync(buf: Uint8Array | Buffer, options?: any): Buffer;
}

