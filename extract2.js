const fs = require('fs');
const m = fs.readFileSync('assets/js/methods.js', 'utf8');
console.log('methods has Status Groups:', m.includes('Status Groups (تجميعات الحالات)'));
console.log('methods has addStatusGroup:', m.includes('addStatusGroup'));
const l = fs.readFileSync('index.html', 'utf8').split('\n');
console.log('===== STATUS MODAL 2646-2670 =====');
for (let i = 2646; i <= 2670 && i <= l.length; i++) console.log(i + ': ' + l[i - 1]);
console.log('===== DASHBOARD 3987-4016 =====');
for (let i = 3987; i <= 4016 && i <= l.length; i++) console.log(i + ': ' + l[i - 1]);
