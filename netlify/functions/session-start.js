const {
  jsonResponse,
  parseJsonBody,
  validateAuth,
  getSupabaseHeaders,
  supabaseFetch
} = require('./session-utils');

const SESSION_SIZE = 20;
const MAX_ERRORS_MARATHON = 3;
const CHRONO_DURATION = 60;

function computeMaxAttempts(mode, targetCount) {
  if (mode === 'chrono') {
    return Math.max(targetCount * 5, targetCount);
  }
  return targetCount;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const payload = await parseJsonBody(event);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const { zone, mode, targets } = payload;
  if (!zone || !mode) {
    return jsonResponse(400, { error: 'zone and mode are required.' });
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    return jsonResponse(400, { error: 'targets must be a non-empty array.' });
  }

  if (mode === 'classique' && targets.length > SESSION_SIZE) {
    return jsonResponse(400, { error: 'Invalid target list for classic mode.' });
  }

  const auth = await validateAuth(event);
  if (auth.error) {
    return jsonResponse(401, { error: auth.error });
  }

  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = mode === 'chrono'
    ? new Date(now.getTime() + CHRONO_DURATION * 1000).toISOString()
    : null;

  const sessionRow = {
    user_id: auth.user?.id || null,
    zone,
    mode,
    status: 'active',
    started_at: startedAt,
    current_item_started_at: startedAt,
    expires_at: expiresAt,
    current_index: 0,
    total_answered: 0,
    correct_count: 0,
    errors_count: 0,
    max_errors: mode === 'marathon' ? MAX_ERRORS_MARATHON : null,
    max_attempts: computeMaxAttempts(mode, targets.length),
    score: 0,
    targets
  };

  try {
    const data = await supabaseFetch('/rest/v1/game_sessions', {
      method: 'POST',
      headers: getSupabaseHeaders({
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(sessionRow)
    });

    const session = Array.isArray(data) ? data[0] : data;

    return jsonResponse(200, {
      session_id: session.id,
      server_started_at: session.started_at,
      authenticated: Boolean(auth.user)
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to create session.' });
  }
};
