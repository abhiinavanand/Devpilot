import NodeCache from 'node-cache';

export const cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
