// api/admin.js
// Vercel serverless function — fetches registrations/attempts for the admin
// dashboard via Hasura GraphQL. Protected by a simple ADMIN_KEY query param.

const { hasuraRequest } = require('../lib/hasura');

const ADMIN_KEY = process.env.ADMIN_KEY || 'unic_admin_2024';

const GET_REGISTRATIONS = `
  query GetRegistrations($limit: Int!, $offset: Int!) {
    registrations(order_by: { created_at: desc }, limit: $limit, offset: $offset) {
      id
      name
      email
      mobile
      source
      ip
      created_at
    }
    registrations_aggregate {
      aggregate { count }
    }
  }
`;

const GET_ATTEMPTS = `
  query GetAttempts($limit: Int!, $offset: Int!) {
    attempts(order_by: { created_at: desc }, limit: $limit, offset: $offset) {
      id
      user_id
      question_id
      subject
      chapter_id
      question_type
      selected
      correct
      is_correct
      created_at
    }
    attempts_aggregate {
      aggregate { count }
    }
    correct_count: attempts_aggregate(where: { is_correct: { _eq: true } }) {
      aggregate { count }
    }
  }
`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, type = 'registrations', limit = '100', offset = '0' } = req.query || {};

  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const off = parseInt(offset, 10) || 0;

  try {
    if (type === 'attempts') {
      const data = await hasuraRequest(GET_ATTEMPTS, { limit: lim, offset: off });
      const total = data.attempts_aggregate.aggregate.count;
      const correct = data.correct_count.aggregate.count;
      const accuracy = total ? Math.round((correct / total) * 100) + '%' : '—';
      return res.status(200).json({
        type,
        count: total,
        accuracy,
        records: data.attempts.map((a) => ({
          id: a.id,
          userId: a.user_id,
          questionId: a.question_id,
          subject: a.subject,
          chapterId: a.chapter_id,
          questionType: a.question_type,
          selected: a.selected,
          correct: a.correct,
          isCorrect: a.is_correct,
          timestamp: a.created_at,
        })),
      });
    }

    // default: registrations
    const data = await hasuraRequest(GET_REGISTRATIONS, { limit: lim, offset: off });
    return res.status(200).json({
      type: 'registrations',
      count: data.registrations_aggregate.aggregate.count,
      records: data.registrations.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        mobile: r.mobile,
        source: r.source,
        ip: r.ip,
        timestamp: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[ADMIN ERROR]', err.message);
    // If Hasura isn't configured yet, fail soft so the dashboard can explain it
    if (err.message.includes('not configured')) {
      return res.status(200).json({
        type,
        count: 0,
        records: [],
        message: err.message,
      });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
