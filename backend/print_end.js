const fs = require('fs');
const lines = fs.readFileSync('../frontend/user/index.html', 'utf8').split('\n');
console.log('Total lines:', lines.length);
for (let i = Math.max(0, lines.length - 25); i < lines.length; i++) {
  console.log((i + 1) + ': ' + JSON.stringify(lines[i]));
}
