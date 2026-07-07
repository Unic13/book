// api/register.js
// Vercel serverless function — saves a registration via Hasura GraphQL.

const { hasuraRequest } = require('../lib/hasura');

const INSERT_REGISTRATION = `
  mutation InsertRegistration($object: registrations_insert_input!) {
    insert_registrations_one(object: $object) {
      id
    }
  }
`;

module.exports = async (req, res) => {
  // CORS (safe to keep even for same-origin Vercel deploys)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { name = '', email = '', mobile = '', source = '' } = body || {};

    if (!name.trim() && !email.trim()) {
      return res.status(400).json({ error: 'At least name or email is required' });
    }

    const id = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '';

    const data = await hasuraRequest(INSERT_REGISTRATION, {
      object: {
        id,
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        source: source.trim(),
        ip,
      },
    });

    return res.status(200).json({ success: true, id: data.insert_registrations_one.id });
  } catch (err) {
    console.error('[REGISTER ERROR]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
