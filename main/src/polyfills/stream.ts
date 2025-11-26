// Stream module polyfill for browser
// @ts-ignore - stream-browserify may not have types
import * as stream from 'stream-browserify';
export default stream;
export const Readable = stream.Readable;
export const Writable = stream.Writable;
export const Duplex = stream.Duplex;
export const Transform = stream.Transform;
export const PassThrough = stream.PassThrough;

