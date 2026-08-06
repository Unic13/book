const { hasuraRequest } = require('../lib/hasura');
 
const GET_ATTEMPTS_FOR_USER = `
  query GetAttempts($userId: String!, $since: timestamptz!) {
    attempts(
      where: { user_id: { _eq: $userId } }
      order_by: { created_at: asc }
    ) {
      subject
      chapter_id
      is_correct
      created_at
    }
    recent: attempts(
      where: { user_id: { _eq: $userId }, created_at: { _gte: $since } }
      order_by: { created_at: asc }
    ) {
      subject
      is_correct
      created_at
    }
  }
`;
 
function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
}
 
function buildBySubject(rows) {
  const map = {};
  rows.forEach(r => {
    const s = r.subject || 'UNKNOWN';
    map[s] ||= { subject: s, attempts: 0, correct: 0, wrong: 0 };
    map[s].attempts++;
    if (r.is_correct) map[s].correct++; else map[s].wrong++;
  });
  return Object.values(map)
    .map(s => ({ ...s, accuracy: s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0 }))
    .sort((a, b) => b.attempts - a.attempts);
}
 
function buildLast7Days(recentRows) {
  const byDay = {};
  recentRows.forEach(r => {
    const d = dayKey(r.created_at);
    byDay[d] ||= { date: d, attempts: 0, correct: 0, wrong: 0, times: [] };
    byDay[d].attempts++;
    if (r.is_correct) byDay[d].correct++; else byDay[d].wrong++;
    byDay[d].times.push(new Date(r.created_at).getTime());
  });
 
  // Fill in the last 7 calendar days (including days with 0 attempts) so
  // the dashboard chart always has 7 bars.
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay[key];
    if (!bucket) {
      out.push({ date: key, attempts: 0, correct: 0, wrong: 0, minutesPracticed: 0 });
      continue;
    }
    const span = bucket.times.length > 1
      ? Math.min(Math.max(...bucket.times) - Math.min(...bucket.times), 3 * 60 * 60 * 1000)
      : 60 * 1000; // a single attempt in a day counts as ~1 minute of practice
    out.push({
      date: key,
      attempts: bucket.attempts,
      correct: bucket.correct,
      wrong: bucket.wrong,
      minutesPracticed: Math.round(span / 60000),
    });
  }
  return out;
}
 
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const userId = (req.query?.userId || '').toString().trim();
  if (!userId) return res.status(400).json({ error: 'userId query param is required' });
 
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
 
  try {
    const data = await hasuraRequest(GET_ATTEMPTS_FOR_USER, {
      userId,
      since: since.toISOString(),
    });
 
    const all = data.attempts || [];
    const recent = data.recent || [];
 
    const correct = all.filter(a => a.is_correct).length;
    const wrong = all.length - correct;
    const last7Days = buildLast7Days(recent);
    const weekTotals = last7Days.reduce(
      (acc, d) => ({
        attempts: acc.attempts + d.attempts,
        correct: acc.correct + d.correct,
        wrong: acc.wrong + d.wrong,
        minutesPracticed: acc.minutesPracticed + d.minutesPracticed,
      }),
      { attempts: 0, correct: 0, wrong: 0, minutesPracticed: 0 }
    );
 
    return res.status(200).json({
      success: true,
      data: {
        totals: {
          attempts: all.length,
          correct,
          wrong,
          accuracy: all.length ? Math.round((correct / all.length) * 100) : 0,
        },
        bySubject: buildBySubject(all),
        last7Days,
        weekTotals,
      },
    });
  } catch (err) {
    console.error('[STATS ERROR]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
