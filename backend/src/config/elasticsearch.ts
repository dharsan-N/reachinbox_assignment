import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({
  node: config.elasticsearch.node,
  maxRetries: 3,
  requestTimeout: 5000,
});
