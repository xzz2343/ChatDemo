import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { ReadableStream } from "stream/web";

// jsdom doesn't ship these Web APIs — polyfill from Node builtins
Object.assign(global, { TextEncoder, TextDecoder, ReadableStream });

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();
