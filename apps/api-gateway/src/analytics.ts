export type AnalyticsSnapshot = {
  requests: number;
  uploads: number;
  searches: number;
  chatMessages: number;
};

const counters: AnalyticsSnapshot = {
  requests: 0,
  uploads: 0,
  searches: 0,
  chatMessages: 0,
};

export const bump = (key: keyof AnalyticsSnapshot) => {
  counters[key] += 1;
};

export const snapshot = () => ({ ...counters });
