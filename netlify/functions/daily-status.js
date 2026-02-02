const {
  jsonResponse,
  validateAuth,
  supabaseFetch
} = require('./session-utils');
const {
  DAILY_MAX_ATTEMPTS,
  getParisDateKey
} = require('./daily-utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const auth = await validateAuth(event);
  if (auth.error || !auth.user) {
    return jsonResponse(401, { error: 'Authentication required.' });
  }

  const dateKey = getParisDateKey();

  try {
    const attemptsResponse = await supabaseFetch(
      `/rest/v1/daily_attempts?user_id=eq.${auth.user.id}&date=eq.${dateKey}&select=attempts_used,solved,solved_at`
    );
    const attempt = Array.isArray(attemptsResponse) ? attemptsResponse[0] : attemptsResponse;

    return jsonResponse(200, {
      date: dateKey,
      attempts_used: attempt?.attempts_used ?? 0,
      max_attempts: DAILY_MAX_ATTEMPTS,
      solved: attempt?.solved ?? false,
      solved_at: attempt?.solved_at ?? null
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to load daily status.' });
  }
};
