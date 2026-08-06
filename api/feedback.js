// api/feedback.js
// POST /api/feedback  -> save one feedback submission
// GET  /api/feedback  -> aggregate stats (avg rating, count, breakdown per rating)
//                        optional ?subject=PH to scope to one subject
//
// Requires a `feedback` table in Hasura, e.g.:
//   CREATE TABLE feedback (
//     id BIGSERIAL PRIMARY KEY,
//     user_id TEXT,            -- email or 'guest'
//     subject TEXT,            -- subject code, nullable ("general" feedback)
//     rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
//     message TEXT,
//     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
//   );
// Track it in Hasura so `feedback_insert_input` / `feedback_aggregate` exist.
const { hasuraRequest } = require('../lib/hasura');

const INSERT_FEEDBACK = `
  mutation InsertFeedback($object: feedback_insert_input!) {
    insert_feedback_one(object: $object) {
      id
    }
  }
`;

const GET_FEEDBACK_STATS = `
  query GetFeedbackStats($where: feedback_bool_exp!) {
    feedback_aggregate(where: $where) {
      aggregate {
        count
        avg { rating }
      }
    }
    recent: feedback(where: $where, order_by: { created_at: desc }, limit: 10) {
      id
      subject
      rating
      message
      created_at
    }
  }
`;

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const body = parseBody(req);
      const { userId = 'guest', subject = null, rating, message = '' } = body || {};

      const r = Number(rating);
      if (!r || r < 1 || r > 5) {
        return res.status(400).json({ error: 'rating must be a number 1-5' });
      }

      const data = await hasuraRequest(INSERT_FEEDBACK, {
        object: { user_id: userId, subject, rating: r, message: message.slice(0, 2000) },
      });

      return res.status(200).json({ success: true, id: data.insert_feedback_one.id });
    }

    if (req.method === 'GET') {
      const subject = (req.query?.subject || '').toString().trim();
      const where = subject ? { subject: { _eq: subject } } : {};

      const data = await hasuraRequest(GET_FEEDBACK_STATS, { where });
      const agg = data.feedback_aggregate.aggregate;

      return res.status(200).json({
        success: true,
        data: {
          count: agg.count,
          averageRating: agg.avg?.rating ? Math.round(agg.avg.rating * 10) / 10 : 0,
          recent: data.recent,
        },
      });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[FEEDBACK ERROR]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
