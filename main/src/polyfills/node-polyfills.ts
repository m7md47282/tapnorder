// Polyfills for Node.js modules required by xlsx-populate

// Polyfill for 'global' - required by crypto-browserify and other Node.js polyfills
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Crypto polyfill
import * as crypto from 'crypto-browserify';

// Stream polyfill
import * as stream from 'stream-browserify';

// Events polyfill
// @ts-ignore - events uses CommonJS export =
const events = require('events');

// FS stub - xlsx-populate uses fs but we don't need it in browser
const fsStub = {
  readFileSync: () => {
    throw new Error('fs.readFileSync is not available in browser');
  },
  writeFileSync: () => {
    throw new Error('fs.writeFileSync is not available in browser');
  },
  existsSync: () => false,
  mkdirSync: () => {
    throw new Error('fs.mkdirSync is not available in browser');
  },
  readdirSync: () => [],
  statSync: () => ({ isFile: () => false, isDirectory: () => false }),
  createReadStream: () => {
    throw new Error('fs.createReadStream is not available in browser');
  },
  createWriteStream: () => {
    throw new Error('fs.createWriteStream is not available in browser');
  },
  promises: {
    readFile: () => Promise.reject(new Error('fs.promises.readFile is not available in browser')),
    writeFile: () => Promise.reject(new Error('fs.promises.writeFile is not available in browser')),
  },
};

// Make crypto, stream, events, and fs available globally
// Note: window.crypto and globalThis.crypto are read-only (Web Crypto API) in browsers
// So we only make crypto-browserify available through the module system and an alternative name
// Libraries should import 'crypto' or 'crypto-browserify' directly, not access window.crypto
(globalThis as any).nodeCrypto = crypto; // Alternative name for Node.js crypto (safe to use)

// fs can be set normally
(window as any).fs = fsStub;
(globalThis as any).fs = fsStub;

// Create a module cache for require() resolution
const moduleCache: { [key: string]: any } = {
  crypto: crypto,
  fs: fsStub,
  stream: stream,
  events: events,
};

// Also make them available as CommonJS modules for require()
if (typeof (globalThis as any).require === 'undefined') {
  (globalThis as any).require = (module: string) => {
    if (moduleCache[module]) {
      return moduleCache[module];
    }
    throw new Error(`Module ${module} not found`);
  };
}

// Export for ES modules
export { crypto, fsStub as fs, stream, events };

