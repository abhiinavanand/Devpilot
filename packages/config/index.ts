import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'devpilot',
  },
  services: {
    authService: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
    projectService: process.env.PROJECT_SERVICE_URL || 'http://localhost:4001',
    analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4002',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4003',
    aiService: process.env.AI_SERVICE_URL || 'http://localhost:4004',
    gateway: process.env.API_GATEWAY_URL || 'http://localhost:8080',
    websocket: process.env.WS_GATEWAY_URL || 'ws://localhost:8081',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  queues: {
    celeryBrokerUrl: process.env.CELERY_BROKER_URL || 'redis://localhost:6379/0',
    celeryResultBackend: process.env.CELERY_RESULT_BACKEND || 'redis://localhost:6379/1',
  },
  observability: {
    prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
    grafanaUrl: process.env.GRAFANA_URL || 'http://localhost:3001',
    lokiUrl: process.env.LOKI_URL || 'http://localhost:3100',
    otelCollectorUrl: process.env.OTEL_COLLECTOR_URL || 'http://localhost:4317',
  },
  rateLimiting: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RATE_LIMIT_MAX || 120),
  },
  featureFlags: {
    aiAgentBeta: process.env.FEATURE_AI_AGENT_BETA === 'true',
    ragAssistant: process.env.FEATURE_RAG_ASSISTANT === 'true',
    realtimeCollab: process.env.FEATURE_REALTIME_COLLAB === 'true',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    eksClusterName: process.env.AWS_EKS_CLUSTER || 'devpilot-eks',
    s3Bucket: process.env.AWS_S3_BUCKET || 'devpilot-assets',
  },
  project: {
    name: 'DevPilot AI',
    version: process.env.APP_VERSION || '0.9.4',
    changelogPath: '/README.md',
    roadmapPath: '/README.md',
    architecturePath: '/docs/architecture/overview.md',
    apiDocsPath: '/docs/api/README.md',
    engineeringHandbookPath: '/README.md',
    // TODO: automate version sync with CI pipeline
    // TECH-DEBT: normalize docs paths across services
  },
  modules: {
    apiVersion: process.env.API_VERSION || 'v1',
    boundaries: [
      'auth-service',
      'project-service',
      'analytics-service',
      'notification-service',
      'ai-service',
      'api-gateway',
    ],
    experimental: {
      ragAssistant: process.env.FEATURE_RAG_ASSISTANT === 'true',
      realtimeCollab: process.env.FEATURE_REALTIME_COLLAB === 'true',
    },
  },
  uiux: {
    theme: process.env.UI_THEME || 'system',
    designSystem: 'shadcn-ui',
    inspirations: ['Linear', 'Jira', 'Vercel', 'Datadog', 'GitHub', 'Grafana'],
    // NOTE(git:feat/uiux): add command palette + terminal-inspired widgets
  },
  runtime: {
    frontend: {
      port: Number(process.env.FRONTEND_PORT || 3000),
      baseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
    },
    backend: {
      port: Number(process.env.BACKEND_PORT || 8000),
      baseUrl: process.env.BACKEND_BASE_URL || 'http://localhost:8000',
    },
    // NOTE(git:chore/dev): standardize dev scripts across services
    devCommands: {
      frontend: 'pnpm --filter frontend dev',
      backend: 'pnpm --filter backend dev',
    },
  },
};

export default config;
