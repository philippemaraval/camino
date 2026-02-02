const {
  jsonResponse,
  supabaseFetch
} = require('./session-utils');
const { getParisDateKey } = require('./daily-utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const params = event.queryStringParameters || {};
  const dateKey = params.date || getParisDateKey();
  const limit = Math.min(parseInt(params.limit || '50', 10), 100);

  try {
    const entries = await supabaseFetch(
      `/rest/v1/daily_leaderboard?date=eq.${dateKey}&select=date,username,solved,attempts_used,solved_at&order=solved.desc,attempts_used.asc,solved_at.asc&limit=${limit}`
    );

    return jsonResponse(200, { date: dateKey, entries: entries || [] });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to load daily leaderboard.' });
  }
};
