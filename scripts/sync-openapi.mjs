import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2] ?? 'http://127.0.0.1:8000/openapi.json';

const text = source.startsWith('http://') || source.startsWith('https://')
  ? await fetch(source).then((response) => {
      if (!response.ok) {
        throw new Error(`OpenAPI 下载失败：HTTP ${response.status}`);
      }
      return response.text();
    })
  : await readFile(resolve(source), 'utf8');

const document = JSON.parse(text);
if (
  document === null
  || typeof document !== 'object'
  || Array.isArray(document)
  || typeof document.openapi !== 'string'
  || typeof document.paths !== 'object'
) {
  throw new Error('OpenAPI 来源不是有效的 OpenAPI 文档');
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}

await writeFile(
  resolve('openapi.json'),
  `${JSON.stringify(sortKeys(document))}\n`,
  'utf8',
);
