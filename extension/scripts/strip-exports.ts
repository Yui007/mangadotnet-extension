import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(import.meta.dirname, 'dist', 'content', 'index.js');
let code = readFileSync(contentPath, 'utf-8');
code = code.replace(/;export\{[^}]*\};?$/, '');
writeFileSync(contentPath, code);
console.log('Stripped export from content/index.js');
