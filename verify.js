const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const state = fs.readFileSync('assets/js/state.js', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');
const methods = fs.readFileSync('assets/js/methods.js', 'utf8');

const checks = [
  ['state: statusGroups', state.includes('statusGroups: []')],
  ['state: statusGroupSelection', state.includes('statusGroupSelection: {}')],
  ['app: groupedStatuses', app.includes('groupedStatuses()')],
  ['app: dashboardGroups', app.includes('dashboardGroups()')],
  ['methods: addStatusGroup', methods.includes('addStatusGroup')],
  ['methods: normalizeStatusGroups', methods.includes('normalizeStatusGroups')],
  ['methods: addStatusToGroup', methods.includes('addStatusToGroup')],
  ['methods: moveStatusInGroup', methods.includes('moveStatusInGroup')],
  ['html: status modal uses groupedStatuses', html.includes('v-for="g in groupedStatuses"')],
  ['html: dashboard uses dashboardGroups', html.includes('v-for="g in dashboardGroups"')],
  ['html: settings groups UI', html.includes('تجميعات الحالات')],
  ['html: addStatusGroup button', html.includes('addStatusGroup')],
  ['html: dashboard filters >1', html.includes('getDashboardStats()[s.name] || 0) > 1')],
];

// Check leftover flat loops that should have been replaced
const leftoverStatusModal = html.includes('v-for="status in allStatuses"');
const leftoverDashboard = html.includes('v-for="status in allStatuses" :key="\'dash-\'+status.name"');

checks.push(['html: status modal flat loop REMOVED', !leftoverStatusModal]);
checks.push(['html: dashboard flat loop REMOVED', !leftoverDashboard]);

checks.forEach(([name, ok]) => {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name);
});
