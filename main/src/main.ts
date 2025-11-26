import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Polyfills for Node.js globals (required by xlsx-populate)
import { Buffer } from 'buffer';
// @ts-ignore - process is a CommonJS module
import * as process from 'process/browser';

(window as any).Buffer = Buffer;
(window as any).process = process;

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
