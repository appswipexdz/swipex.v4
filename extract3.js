const fs = require('fs');
const l = fs.readFileSync('index.html', 'utf8').split('\n');
console.log('===== LINES 3095-3140 =====');
for (let i = 3095; i <= 3140 && i <= l.length; i++) console.log(i + ': ' + l[i - 1]);
