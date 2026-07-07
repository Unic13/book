// lib/hasura.js
// Minimal GraphQL client for talking to Hasura from serverless functions.
// Requires env vars: HASURA_GRAPHQL_URL, HASURA_ADMIN_SECRET

const HASURA_URL = process.env.HASURA_GRAPHQL_URL; // e.g. https://your-app.hasura.app/v1/graphql
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

/**
 * Run a GraphQL query/mutation against Hasura using the admin secret.
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - GraphQL variables
 */
async function hasuraRequest(query, variables = {}) {
  if (!HASURA_URL || !ADMIN_SECRET) {
    throw new Error(
      'Hasura is not configured. Set HASURA_GRAPHQL_URL and HASURA_ADMIN_SECRET env vars.'
    );
  }

  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new Error('Hasura error: ' + msg);
  }

  return json.data;
}

module.exports = { hasuraRequest };
