const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const patterns = ['showDashboard', 'getDailySummary', 'customStatuses', 'statusOrder', 'statusList', 'openStatusModal', 'statusModalParcel', 'الترتيب', 'الحالات', 'dashboard', 'status-modal'];
const lines = content.split('\n');
const seen = new Set();
patterns.forEach(p => {
  lines.forEach((line, i) => {
    if (line.includes(p) && !seen.has(i)) {
      seen.add(i);
      console.log((i + 1) + ': ' + line.trim());
    }
  });
});
