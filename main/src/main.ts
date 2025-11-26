import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Polyfill for 'global' - required by crypto-browserify and other Node.js polyfills
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Polyfills for Node.js globals (required by xlsx-populate)
import { Buffer } from 'buffer';
// @ts-ignore - process is a CommonJS module
import * as process from 'process/browser';
// Import Node.js polyfills for crypto and fs
import './polyfills/node-polyfills';

(window as any).Buffer = Buffer;
(window as any).process = process;

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
