// node --import ./tests/register.mjs --test tests/   : maps '@capacitor/core' to the stub, adds the few browser globals src/log.js needs.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
globalThis.addEventListener ??= () => {};
const mem = new Map();
globalThis.localStorage ??= { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() };
