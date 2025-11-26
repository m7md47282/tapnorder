declare module 'crypto-browserify' {
  export function createHash(algorithm: string): Hash;
  export function createHmac(algorithm: string, key: string | Buffer): Hmac;
  export function randomBytes(size: number): Buffer;
  export function pbkdf2(
    password: string | Buffer,
    salt: string | Buffer,
    iterations: number,
    keylen: number,
    digest: string,
    callback: (err: Error | null, derivedKey: Buffer) => void
  ): void;
  export function pbkdf2Sync(
    password: string | Buffer,
    salt: string | Buffer,
    iterations: number,
    keylen: number,
    digest: string
  ): Buffer;

  export interface Hash {
    update(data: string | Buffer): Hash;
    digest(encoding?: string): string | Buffer;
  }

  export interface Hmac {
    update(data: string | Buffer): Hmac;
    digest(encoding?: string): string | Buffer;
  }
}

