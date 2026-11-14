// Test stand-in for '@capacitor/core'. Tests set globalThis.__NATIVE__ = true and globalThis.__PLUGIN__ = <fake plugin> BEFORE importing src/native.js.
export const Capacitor = { isNativePlatform: () => globalThis.__NATIVE__ === true, convertFileSrc: p => 'cap://' + p };
export const registerPlugin = () => globalThis.__PLUGIN__;
