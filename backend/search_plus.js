const fs = require('fs');
const content = fs.readFileSync('../frontend/user/index.html', 'utf8');
let pos = -1;
while ((pos = content.indexOf('+', pos + 1)) !== -1) {
  console.log("Found '+' at position " + pos + ". Context: " + content.substring(Math.max(0, pos - 30), Math.min(content.length, pos + 30)).replace(/\n/g, '\\n'));
}
