const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (stat.isFile() && (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let pos = -1;
      while ((pos = content.indexOf('+', pos + 1)) !== -1) {
        console.log("[" + file + "] Found '+' at pos " + pos + ": \"" + content.substring(Math.max(0, pos - 15), Math.min(content.length, pos + 15)).replace(/\n/g, '\\n') + "\"");
      }
    }
  }
}

walk('../frontend/user');
