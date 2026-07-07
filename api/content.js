// api/content.js
// Vercel serverless function — reads/writes subject content (units → chapters
// → concept + questions) for the Admin Question Builder.
//
// GET  /api/content?code=PH                       → fetch one subject's JSON (public, no key needed)
// GET  /api/content                                → fetch all subjects (list, public)
// POST /api/content?key=ADMIN_KEY                  → upsert a subject's JSON (admin only)
//      body: { code, subject, color, data }

const { hasuraRequest } = require('../lib/hasura');

const ADMIN_KEY = process.env.ADMIN_KEY || 'unic_admin_2024';

const GET_ONE = `
  query GetSubjectContent($code: String!) {
    subject_content_by_pk(code: $code) {
      code
      subject
      color
      data
      updated_at
    }
  }
`;

const GET_ALL = `
  query GetAllSubjectContent {
    subject_content(order_by: { code: asc }) {
      code
      subject
      color
      updated_at
    }
  }
`;

const UPSERT = `
  mutation UpsertSubjectContent($object: subject_content_insert_input!) {
    insert_subject_content_one(
      object: $object
      on_conflict: {
        constraint: subject_content_pkey
        update_columns: [subject, color, data, updated_at]
      }
    ) {
      code
      updated_at
    }
  }
`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET is public (the main app needs to read questions without a login).
  // POST (creating/editing content) requires the real admin key.
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const key = (req.query && req.query.key) || (body && body.key);
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { code, subject, color, data } = body || {};

      if (!code || !subject || !data) {
        return res.status(400).json({ error: 'code, subject, and data are required' });
      }
      if (!data.units || !Array.isArray(data.units)) {
        return res.status(400).json({ error: 'data.units must be an array' });
      }

      const result = await hasuraRequest(UPSERT, {
        object: {
          code: code.toUpperCase(),
          subject,
          color: color || '#6C3FF5',
          data,
          updated_at: new Date().toISOString(),
        },
      });

      return res.status(200).json({ success: true, code: result.insert_subject_content_one.code });
    } catch (err) {
      console.error('[CONTENT ERROR]', err.message);
      if (err.message.includes('not configured')) {
        return res.status(200).json({ error: err.message, configured: false });
      }
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    try {
      const code = req.query?.code;
      if (code) {
        const data = await hasuraRequest(GET_ONE, { code: code.toUpperCase() });
        const row = data.subject_content_by_pk;
        if (!row) return res.status(404).json({ error: 'Subject not found' });
        return res.status(200).json(row);
      }
      const data = await hasuraRequest(GET_ALL);
      return res.status(200).json({ subjects: data.subject_content });
    } catch (err) {
      console.error('[CONTENT ERROR]', err.message);
      // Soft-fail so the frontend can fall back to the static JSON file
      return res.status(200).json({ error: err.message, configured: false });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
