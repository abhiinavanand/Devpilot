export const incidents = [
  {
    id: 'INC-123',
    title: 'API Latency Spike',
    severity: 'High',
    status: 'Investigating',
    assignee: 'Anuj Behra',
    timeline: [
      { time: '10:00', description: 'Incident declared' },
      { time: '10:05', description: 'Assignee notified' },
      { time: '10:15', description: 'Investigation started' },
    ],
    rca: 'Awaiting analysis',
    affectedServices: ['API Gateway', 'Auth Service'],
    resolutionNotes: '',
    postmortem: 'Pending',
    aiRecommendations: [
      'Check for recent deployments to affected services.',
      'Analyze database query performance.',
    ],
  },
  {
    id: 'INC-124',
    title: 'Billing Service Outage',
    severity: 'Critical',
    status: 'Resolved',
    assignee: 'Jane Doe',
    timeline: [
        { time: '11:00', description: 'Incident declared' },
        { time: '11:05', description: 'Assignee notified' },
        { time: '11:15', description: 'Investigation started' },
        { time: '11:30', description: 'Root cause identified' },
        { time: '11:45', description: 'Fix deployed' },
        { time: '12:00', description: 'Incident resolved' },
    ],
    rca: 'A misconfiguration in the new deployment caused a cascading failure.',
    affectedServices: ['Billing Service'],
    resolutionNotes: 'Reverted the deployment to the previous version.',
    postmortem: 'Completed',
    aiRecommendations: [
        'Add more robust validation for configuration changes.',
        'Improve monitoring for the billing service.',
    ],
  }
];
