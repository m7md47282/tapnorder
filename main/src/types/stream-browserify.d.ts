declare module 'stream-browserify' {
  export class Readable {
    readable: boolean;
    read(size?: number): any;
    setEncoding(encoding: string): this;
    pause(): this;
    resume(): this;
    isPaused(): boolean;
    pipe<T extends any>(destination: T, options?: { end?: boolean }): T;
    unpipe(destination?: any): this;
    unshift(chunk: any): void;
    wrap(oldStream: any): this;
    push(chunk: any, encoding?: string): boolean;
    destroy(error?: Error): void;
  }

  export class Writable {
    writable: boolean;
    write(chunk: any, encoding?: string, cb?: Function): boolean;
    write(chunk: any, cb?: Function): boolean;
    end(chunk?: any, encoding?: string, cb?: Function): this;
    end(chunk?: any, cb?: Function): this;
    destroy(error?: Error): void;
  }

  export class Duplex extends Readable {
    writable: boolean;
    write(chunk: any, encoding?: string, cb?: Function): boolean;
    write(chunk: any, cb?: Function): boolean;
    end(chunk?: any, encoding?: string, cb?: Function): this;
    end(chunk?: any, cb?: Function): this;
  }

  export class Transform extends Duplex {
    _transform(chunk: any, encoding: string, callback: Function): void;
  }

  export class PassThrough extends Transform {}
}

