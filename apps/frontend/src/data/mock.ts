export const metrics = [
  {
    label: 'Deployment Frequency',
    value: '12/day',
    trend: '+5%',
  },
  {
    label: 'Lead Time',
    value: '6.2h',
    trend: '-8%',
  },
  {
    label: 'MTTR',
    value: '28m',
    trend: '+15%',
  },
  {
    label: 'Change Failure Rate',
    value: '1.8%',
    trend: '-0.5%',
  },
  {
    label: 'Cluster Health',
    value: '99.8% Up',
    trend: '+0.1%',
  },
  {
    label: 'API Latency',
    value: '150ms (p95)',
    trend: '-20ms',
  },
  {
    label: 'Infrastructure Cost',
    value: '$25,840/mo',
    trend: '+2%',
  },
  {
    label: 'AI Savings',
    value: '$4,200/mo',
    trend: '+10%',
  },
  {
    label: 'Open Incidents',
    value: '3',
    trend: '0',
  },
  {
    label: 'Resolved Incidents',
    value: '152',
    trend: '+5',
  },
];

export const deploymentSeries = [
  { name: 'Mon', success: 32, failed: 4 },
  { name: 'Tue', success: 41, failed: 6 },
  { name: 'Wed', success: 38, failed: 5 },
  { name: 'Thu', success: 46, failed: 3 },
  { name: 'Fri', success: 53, failed: 4 },
  { name: 'Sat', success: 39, failed: 2 },
  { name: 'Sun', success: 58, failed: 3 },
];

export const latencySeries = [
  { time: '09:00', p95: 280, p99: 420 },
  { time: '11:00', p95: 260, p99: 380 },
  { time: '13:00', p95: 300, p99: 410 },
  { time: '15:00', p95: 240, p99: 360 },
  { time: '17:00', p95: 270, p99: 390 },
];

export const kanbanData = [
  {
    id: 'backlog',
    title: 'Backlog',
    cards: [
      { id: 'k1', title: 'Auth latency spike', owner: 'SRE' },
      { id: 'k2', title: 'RCA: billing retry storm', owner: 'Billing' },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    cards: [
      { id: 'k3', title: 'Preview environment automation', owner: 'Platform' },
      { id: 'k4', title: 'Edge caching rollout', owner: 'Infra' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'k5', title: 'Command palette UX', owner: 'Design' },
      { id: 'k6', title: 'AI assistant prompt guardrails', owner: 'AI' },
    ],
  },
];

export const timeline = [
  {
    title: 'Canary 5% rollout',
    owner: 'Gateway',
    time: '09:40',
  },
  {
    title: 'Latency regression flagged',
    owner: 'SRE',
    time: '10:15',
  },
  {
    title: 'Auto rollback triggered',
    owner: 'Platform',
    time: '10:21',
  },
  {
    title: 'Fix verified in staging',
    owner: 'Release',
    time: '11:02',
  },
];

export const commandItems = [
  'Open SLO dashboard',
  'Create incident room',
  'Trigger rollback',
  'Deploy analytics patch',
  'Open feature flags',
];
