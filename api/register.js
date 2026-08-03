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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const {
      name = '',
      email = '',
      mobile = '',
      source = '',
    } = body;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();
    const trimmedSource = source.trim();

    if (!trimmedName && !trimmedEmail) {
      return res
        .status(400)
        .json({ error: 'At least name or email is required' });
    }

    const ipaddress =
      (req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      '';

    const data = await hasuraRequest(INSERT_REGISTRATION, {
      object: {
        // Don't send id - PostgreSQL generates it
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedMobile || null,
        howkonw: trimmedSource || null,
        ipaddress: ipaddress || null,
        // Don't send created_at - PostgreSQL uses now()
      },
    });

    return res.status(200).json({
      success: true,
      id: data.insert_registrations_one.id,
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);

    return res.status(500).json({
      error: err.message || 'Internal server error',
    });
  }
};
