export async function resolve(spec, ctx, next) {
  if (spec === '@capacitor/core') return { url: new URL('./stubs/capacitor-core.js', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
