const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '..', 'dist', 'content', 'index.js');
let code = fs.readFileSync(contentPath, 'utf-8');
code = code.replace(/;export\{[^}]*\};?\s*$/, '');
fs.writeFileSync(contentPath, code);
console.log('Stripped export from content/index.js');
