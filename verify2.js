const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');

const lines = html.split('\n');
console.log('===== Occurrences of "allStatuses" in index.html =====');
lines.forEach((line, i) => {
  if (line.includes('allStatuses')) {
    console.log((i + 1) + ': ' + line.trim());
  }
});

console.log('\n===== dashboardGroups filter in app.js (expect > 1) =====');
const appLines = app.split('\n');
appLines.forEach((line, i) => {
  if (line.includes('dashboardGroups') || line.includes('> 1')) {
    console.log((i + 1) + ': ' + line.trim());
  }
});
