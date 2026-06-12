declare const process: { env: Record<string, string | undefined> };

export const featureFlags = {
  aiAgentBeta: process.env.FEATURE_AI_AGENT_BETA === 'true',
  ragAssistant: process.env.FEATURE_RAG_ASSISTANT === 'true',
  realtimeCollab: process.env.FEATURE_REALTIME_COLLAB === 'true',
  billingRevamp: process.env.FEATURE_BILLING_REVAMP === 'true',
  usageForecasting: process.env.FEATURE_USAGE_FORECASTING === 'true',
};

export type FeatureFlagKey = keyof typeof featureFlags;
