// Events module polyfill for browser
// @ts-ignore - events uses CommonJS export =
const eventsModule = require('events');

// Re-export as ES module
export const EventEmitter = eventsModule.EventEmitter || eventsModule;
export default eventsModule;

