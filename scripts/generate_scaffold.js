const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeFile = (filePath, content) => {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
};

const createComponentFiles = (baseDir, count) => {
  ensureDir(baseDir);
  for (let i = 1; i <= count; i += 1) {
    const name = `Component${String(i).padStart(3, '0')}`;
    const filePath = path.join(baseDir, `${name}.tsx`);
    const content = `import React from 'react';\n\nexport const ${name} = () => {\n  return (\n    <section data-component=\"${name}\">\n      <h3>${name}</h3>\n      <p>Auto-generated UI building block for the DevPilot AI frontend.</p>\n    </section>\n  );\n};\n`;
    writeFile(filePath, content);
  }
};

const createIndexForComponents = (baseDir, count) => {
  const lines = [];
  for (let i = 1; i <= count; i += 1) {
    const name = `Component${String(i).padStart(3, '0')}`;
    lines.push(`export * from './${name}';`);
  }
  writeFile(path.join(baseDir, 'index.ts'), `${lines.join('\n')}\n`);
};

const createApiModules = () => {
  const apiDir = path.join(root, 'apps/frontend/src/api');
  const modules = [
    'auth',
    'projects',
    'analytics',
    'notifications',
    'billing',
    'reports',
  ];

  writeFile(
    path.join(apiDir, 'client.ts'),
    `import axios from 'axios';\n\nexport const apiClient = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',\n  timeout: 10000,\n});\n`
  );

  modules.forEach((module) => {
    writeFile(
      path.join(apiDir, `${module}.ts`),
      `import { apiClient } from './client';\n\nexport const ${module}Api = {\n  list: () => apiClient.get('/${module}'),\n  get: (id) => apiClient.get('/${module}/' + id),\n  create: (payload) => apiClient.post('/${module}', payload),\n  update: (id, payload) => apiClient.put('/${module}/' + id, payload),\n};\n`
    );
  });

  writeFile(
    path.join(apiDir, 'index.ts'),
    modules.map((module) => `export * from './${module}';`).join('\n') + '\n'
  );
};

const createSharedUtilities = () => {
  const utilsDir = path.join(root, 'libs/utils');
  writeFile(
    path.join(utilsDir, 'index.ts'),
    `export * from './formatters';\nexport * from './validators';\nexport * from './date';\n`
  );
  writeFile(
    path.join(utilsDir, 'formatters.ts'),
    `export const formatCurrency = (amount, currency = 'USD') =>\n  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);\n\nexport const formatPercent = (value) =>\n  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);\n`
  );
  writeFile(
    path.join(utilsDir, 'validators.ts'),
    `export const isEmail = (value) => /\\S+@\\S+\\.\\S+/.test(value);\n\nexport const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;\n`
  );
  writeFile(
    path.join(utilsDir, 'date.ts'),
    `export const toIsoDate = (value) => new Date(value).toISOString();\n\nexport const addDays = (value, days) => {\n  const date = new Date(value);\n  date.setDate(date.getDate() + days);\n  return date;\n};\n`
  );
};

const createEnvConfigs = () => {
  writeFile(
    path.join(root, '.env.example'),
    `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000\nAUTH_SERVICE_URL=http://localhost:3001\nPROJECT_SERVICE_URL=http://localhost:3002\nANALYTICS_SERVICE_URL=http://localhost:3003\nNOTIFICATION_SERVICE_URL=http://localhost:3004\n`
  );

  writeFile(
    path.join(root, 'config/env/development.ts'),
    `export const env = {\n  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',\n};\n`
  );
  writeFile(
    path.join(root, 'config/env/production.ts'),
    `export const env = {\n  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.devpilot.ai',\n};\n`
  );
};

const createCiCdConfigs = () => {
  const workflowsDir = path.join(root, '.github/workflows');
  writeFile(
    path.join(workflowsDir, 'ci.yml'),
    `name: CI\n\non:\n  pull_request:\n    branches: [ main ]\n  push:\n    branches: [ main ]\n\njobs:\n  build-and-test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 18\n      - run: npm install\n      - run: npm run build\n      - run: npm test -- --runInBand\n`
  );

  writeFile(
    path.join(workflowsDir, 'cd.yml'),
    `name: CD\n\non:\n  workflow_dispatch: {}\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy to staging\n        run: echo "Deploy placeholder"\n`
  );
};

const createHelmCharts = () => {
  const helmDir = path.join(root, 'infra/helm/devpilot-ai');
  writeFile(
    path.join(helmDir, 'Chart.yaml'),
    `apiVersion: v2\nname: devpilot-ai\ndescription: DevPilot AI Helm chart\ntype: application\nversion: 0.1.0\nappVersion: "1.0.0"\n`
  );
  writeFile(
    path.join(helmDir, 'values.yaml'),
    `image:\n  repository: devpilot-ai/api-gateway\n  tag: latest\n\nservice:\n  type: ClusterIP\n  port: 3000\n`
  );
  writeFile(
    path.join(helmDir, 'templates/deployment.yaml'),
    `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: devpilot-ai-gateway\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: devpilot-ai-gateway\n  template:\n    metadata:\n      labels:\n        app: devpilot-ai-gateway\n    spec:\n      containers:\n        - name: api-gateway\n          image: {{ .Values.image.repository }}:{{ .Values.image.tag }}\n          ports:\n            - containerPort: 3000\n`
  );
};

const createTerraformModules = () => {
  const tfDir = path.join(root, 'infra/terraform/modules');
  const modules = ['vpc', 'eks', 'rds'];
  modules.forEach((module) => {
    writeFile(
      path.join(tfDir, module, 'main.tf'),
      `// ${module.toUpperCase()} module placeholder\n\nvariable "name" {\n  type = string\n}\n`
    );
    writeFile(
      path.join(tfDir, module, 'outputs.tf'),
      `output "${module}_id" {\n  value = "${module}-placeholder"\n}\n`
    );
  });
};

const createMonitoringDashboards = () => {
  const dashboardDir = path.join(root, 'monitoring/dashboards');
  writeFile(
    path.join(dashboardDir, 'devpilot-overview.json'),
    JSON.stringify(
      {
        title: 'DevPilot AI Overview',
        description: 'High-level metrics for platform health.',
        panels: [
          { title: 'API Gateway Latency', type: 'timeseries' },
          { title: 'Request Volume', type: 'barchart' },
          { title: 'Error Rate', type: 'stat' },
        ],
      },
      null,
      2
    ) + '\n'
  );
};

const createSeedScripts = () => {
  const seedDir = path.join(root, 'data/seed');
  writeFile(
    path.join(seedDir, '001_create_tables.sql'),
    `-- Core tables\nCREATE TABLE IF NOT EXISTS organizations (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  industry TEXT NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE TABLE IF NOT EXISTS projects (\n  id SERIAL PRIMARY KEY,\n  organization_id INT REFERENCES organizations(id),\n  name TEXT NOT NULL,\n  status TEXT NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n`
  );
  writeFile(
    path.join(seedDir, '002_seed_data.sql'),
    `INSERT INTO organizations (name, industry) VALUES\n('Apex Dynamics', 'Manufacturing'),\n('Nimbus Health', 'Healthcare'),\n('Orbit Logistics', 'Transportation');\n\nINSERT INTO projects (organization_id, name, status) VALUES\n(1, 'Factory Optimization', 'active'),\n(2, 'Patient Engagement', 'planning'),\n(3, 'Fleet Modernization', 'active');\n`
  );
};

const createDummyDatasets = () => {
  const dataDir = path.join(root, 'data/datasets');
  writeFile(
    path.join(dataDir, 'usage_metrics.csv'),
    `date,active_users,deployments,incident_count\n2026-05-01,1200,34,1\n2026-05-02,1320,29,0\n2026-05-03,1285,41,2\n`
  );
  writeFile(
    path.join(dataDir, 'team_capacity.csv'),
    `team,engineers,velocity\nPlatform,12,38\nData,8,24\nInfra,10,30\n`
  );
};

const createDocs = () => {
  writeFile(
    path.join(root, 'docs/architecture/overview.md'),
    `# Architecture Overview\n\nDevPilot AI uses a microservices architecture with a centralized API gateway.\n\n## Key Components\n- API Gateway\n- Auth Service\n- Project Service\n- Analytics Service\n- Notification Service\n\n## Data Flow\nRequests enter via the gateway and are routed to service-specific handlers.\n`
  );
  writeFile(
    path.join(root, 'docs/architecture/system-context.md'),
    `# System Context\n\nThis document captures the system context and integration points.\n\n- External IdP providers\n- Notification delivery vendors\n- Analytics warehouse\n`
  );

  writeFile(
    path.join(root, 'docs/api/openapi.yaml'),
    `openapi: 3.0.3\ninfo:\n  title: DevPilot AI API\n  version: 1.0.0\npaths:\n  /auth/login:\n    post:\n      summary: Login\n      responses:\n        '200':\n          description: OK\n`
  );

  writeFile(
    path.join(root, 'docs/engineering/operations.md'),
    `# Operations Guide\n\n## Monitoring\n- Dashboards in /monitoring/dashboards\n\n## Runbooks\n- API Gateway latency\n- Auth service degraded\n`
  );
  writeFile(
    path.join(root, 'docs/engineering/development.md'),
    `# Development Guide\n\n## Local Development\n- Install dependencies per service\n- Run API gateway for routing\n`
  );
};

const createFrontendScaffold = () => {
  const appDir = path.join(root, 'apps/frontend/src');
  writeFile(
    path.join(appDir, 'index.tsx'),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { Component001 } from './components';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<Component001 />);\n`
  );
  createComponentFiles(path.join(appDir, 'components'), 120);
  createIndexForComponents(path.join(appDir, 'components'), 120);
  createApiModules();
};

const run = () => {
  createFrontendScaffold();
  createSharedUtilities();
  createEnvConfigs();
  createCiCdConfigs();
  createHelmCharts();
  createTerraformModules();
  createMonitoringDashboards();
  createSeedScripts();
  createDummyDatasets();
  createDocs();
};

run();
console.log('Scaffold generated.');
