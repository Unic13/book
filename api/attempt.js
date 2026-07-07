// api/attempt.js
// Vercel serverless function — saves a question attempt via Hasura GraphQL.

const { hasuraRequest } = require('../lib/hasura');

const INSERT_ATTEMPT = `
  mutation InsertAttempt($object: attempts_insert_input!) {
    insert_attempts_one(object: $object) {
      id
    }
  }
`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      userId = 'anonymous',
      questionId,
      subject,
      chapterId,
      questionType,
      selected,
      correct,
      isCorrect = false,
    } = body || {};

    if (!questionId || !subject || !chapterId) {
      return res.status(400).json({ error: 'questionId, subject, and chapterId are required' });
    }

    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const data = await hasuraRequest(INSERT_ATTEMPT, {
      object: {
        id,
        user_id: userId,
        question_id: questionId,
        subject,
        chapter_id: chapterId,
        question_type: questionType || null,
        selected: selected ?? null,
        correct: correct ?? null,
        is_correct: !!isCorrect,
      },
    });

    return res.status(200).json({ success: true, id: data.insert_attempts_one.id });
  } catch (err) {
    console.error('[ATTEMPT ERROR]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
