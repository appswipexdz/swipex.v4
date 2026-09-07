const fs = require('fs');
const l = fs.readFileSync('index.html', 'utf8').split('\n');
const ranges = [[470, 490], [2625, 2665], [1800, 1880], [3929, 4000], [4930, 5000]];
ranges.forEach(([a, b]) => {
  console.log('===== LINES ' + a + '-' + b + ' =====');
  for (let i = a; i <= b && i <= l.length; i++) console.log(i + ': ' + l[i - 1]);
});
