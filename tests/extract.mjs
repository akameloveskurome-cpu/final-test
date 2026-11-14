// Runs a real one-line `const name = ...` (or multi-line function) from a source file with fake dependencies, so a test checks behaviour of the shipped code, not its text.
import { readFileSync } from 'node:fs';
export function extract(file, name, deps = {}, until = null) {
  const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8').split('\n');
  const i = src.findIndex(l => new RegExp('^(const|async function|function) ' + name + '\\b').test(l));
  if (i < 0) throw new Error(name + ' not found in ' + file);
  let code = src[i], j = i;
  if (until) { while (j < src.length && !src[j].startsWith(until)) j++; if (j >= src.length) throw new Error(name + ': end marker "' + until + '" not found in ' + file); code = src.slice(i, j + 1).join('\n'); }
  else if (src[i].trim().endsWith('{')) { j = i; while (j < src.length && src[j] !== '}') j++; if (j >= src.length) throw new Error(name + ': closing "}" at column 0 not found in ' + file); code = src.slice(i, j + 1).join('\n'); }
  return new Function(...Object.keys(deps), `${code}\n; return ${name};`)(...Object.values(deps));
}
