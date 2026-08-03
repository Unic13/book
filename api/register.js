// api/register.js
// Vercel serverless function — saves a registration via Hasura GraphQL.

const { hasuraRequest } = require('../lib/hasura');

const CHECK_REGISTRATION = `
  query CheckRegistration($email: String!) {
    registrations(where: { email: { _eq: $email } }, limit: 1) {
      id
    }
  }
`;

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
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
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
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobile.trim();
    const trimmedSource = source.trim();

    // Validation
    if (!trimmedName && !trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: 'At least name or email is required.',
      });
    }

    // Check if email already exists
    if (trimmedEmail) {
      const existing = await hasuraRequest(CHECK_REGISTRATION, {
        email: trimmedEmail,
      });

      if (existing.registrations.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'You have already registered.',
        });
      }
    }

    // Get client IP
    const ipaddress =
      (req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      null;

    // Insert registration
    const data = await hasuraRequest(INSERT_REGISTRATION, {
      object: {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedMobile || null,
        howkonw: trimmedSource || null,
        ipaddress,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Registration successful.',
      id: data.insert_registrations_one.id,
    });

  } catch (err) {
    console.error('[REGISTER ERROR]', err);

    // Handle duplicate email (race condition)
    const errors = err.response?.errors || [];

    const duplicate = errors.some(
      (e) =>
        e.extensions?.code === 'constraint-violation' ||
        e.message?.includes('registrations_email_key') ||
        e.message?.includes('duplicate key value') ||
        e.message?.includes('Uniqueness violation')
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'You have already registered.',
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
};
