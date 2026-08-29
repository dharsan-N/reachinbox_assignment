import { esClient } from '../config/elasticsearch';
import { config } from '../config/env';
import { EmailJob, EmailSearchQuery } from '../types';
import { db } from '../config/db';

const INDEX_NAME = config.elasticsearch.index;

export class ElasticsearchService {
  private static isAvailable = false;

  public static async initIndex(): Promise<void> {
    try {
      const ping = await esClient.ping();
      if (!ping) {
        console.warn('Elasticsearch ping failed. Fallback to SQL search enabled.');
        this.isAvailable = false;
        return;
      }

      this.isAvailable = true;
      const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

      if (!indexExists) {
        await esClient.indices.create({
          index: INDEX_NAME,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'uax_url_email',
                    filter: ['lowercase'],
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                user_id: { type: 'keyword' },
                sender_id: { type: 'keyword' },
                sender_email: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                  analyzer: 'email_analyzer',
                },
                recipient_email: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                  analyzer: 'email_analyzer',
                },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduled_at: { type: 'date' },
                sent_at: { type: 'date' },
                created_at: { type: 'date' },
                ethereal_preview_url: { type: 'keyword' },
              },
            },
          },
        });
        console.log(`Elasticsearch index '${INDEX_NAME}' initialized successfully.`);
      } else {
        console.log(`Elasticsearch index '${INDEX_NAME}' already exists.`);
      }
    } catch (err: any) {
      console.warn('Elasticsearch unavailable on boot, fallback enabled:', err.message);
      this.isAvailable = false;
    }
  }

  public static async indexEmail(job: EmailJob): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await esClient.index({
        index: INDEX_NAME,
        id: job.id,
        document: {
          id: job.id,
          user_id: job.user_id,
          sender_id: job.sender_id,
          sender_email: job.sender_email,
          recipient_email: job.recipient_email,
          subject: job.subject,
          body: job.body,
          status: job.status,
          scheduled_at: job.scheduled_at,
          sent_at: job.sent_at,
          created_at: job.created_at,
          ethereal_preview_url: job.ethereal_preview_url,
        },
      });
    } catch (err: any) {
      console.warn(`Failed to index email ${job.id} to Elasticsearch:`, err.message);
    }
  }

  public static async searchEmails(
    userId: string,
    queryOptions: EmailSearchQuery
  ): Promise<{ items: EmailJob[]; total: number; source: 'elasticsearch' | 'database' }> {
    const { q, status, page = 1, limit = 20, senderEmail } = queryOptions;
    const from = (page - 1) * limit;

    // Try Elasticsearch first if available
    if (this.isAvailable) {
      try {
        const mustClauses: any[] = [{ term: { user_id: userId } }];

        if (status) {
          mustClauses.push({ term: { status } });
        }

        if (senderEmail) {
          mustClauses.push({ term: { 'sender_email.keyword': senderEmail } });
        }

        if (q && q.trim().length > 0) {
          mustClauses.push({
            multi_match: {
              query: q.trim(),
              fields: [
                'recipient_email^3',
                'subject^2',
                'body',
                'sender_email',
              ],
              fuzziness: 'AUTO',
            },
          });
        }

        const esRes = await esClient.search({
          index: INDEX_NAME,
          from,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduled_at: { order: 'desc' } }],
        });

        const total =
          typeof esRes.hits.total === 'number'
            ? esRes.hits.total
            : esRes.hits.total?.value || 0;

        const items = esRes.hits.hits.map((hit: any) => hit._source as EmailJob);

        return { items, total, source: 'elasticsearch' };
      } catch (err: any) {
        console.warn('Elasticsearch search query error, falling back to PostgreSQL:', err.message);
      }
    }

    // Fallback PostgreSQL full-text / ILIKE search
    let sql = 'SELECT * FROM email_jobs WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIdx = 2;

    if (status) {
      sql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (senderEmail) {
      sql += ` AND sender_email = $${paramIdx}`;
      params.push(senderEmail);
      paramIdx++;
    }

    if (q && q.trim().length > 0) {
      sql += ` AND (recipient_email ILIKE $${paramIdx} OR subject ILIKE $${paramIdx} OR body ILIKE $${paramIdx} OR sender_email ILIKE $${paramIdx})`;
      params.push(`%${q.trim()}%`);
      paramIdx++;
    }

    // Get count
    const countSql = `SELECT COUNT(*) FROM (${sql}) AS count_subquery`;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Get paginated items
    sql += ` ORDER BY scheduled_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, from);

    const dataRes = await db.query(sql, params);
    return { items: dataRes.rows, total, source: 'database' };
  }
}
