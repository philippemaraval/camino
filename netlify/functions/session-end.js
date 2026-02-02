const {
  jsonResponse,
  parseJsonBody,
  validateAuth,
  getSupabaseHeaders,
  supabaseFetch
} = require('./session-utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const payload = await parseJsonBody(event);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const { session_id: sessionId } = payload;
  if (!sessionId) {
    return jsonResponse(400, { error: 'session_id is required.' });
  }

  const auth = await validateAuth(event);
  if (auth.error) {
    return jsonResponse(401, { error: auth.error });
  }

  try {
    const sessions = await supabaseFetch(`/rest/v1/game_sessions?id=eq.${sessionId}`);
    const session = Array.isArray(sessions) ? sessions[0] : sessions;

    if (!session) {
      return jsonResponse(404, { error: 'Session not found.' });
    }

    if (session.user_id && !auth.user?.id) {
      return jsonResponse(401, { error: 'Authentication required.' });
    }

    if (session.user_id && auth.user?.id && session.user_id !== auth.user.id) {
      return jsonResponse(403, { error: 'Session ownership mismatch.' });
    }

    const now = new Date().toISOString();
    const updatedSession = await supabaseFetch(`/rest/v1/game_sessions?id=eq.${sessionId}`, {
      method: 'PATCH',
      headers: getSupabaseHeaders({
        Prefer: 'return=representation'
      }),
      body: JSON.stringify({
        status: 'completed',
        ended_at: now
      })
    });

    const latest = Array.isArray(updatedSession) ? updatedSession[0] : updatedSession;
    const isAuthenticated = Boolean(auth.user);
    const shouldSaveScore = isAuthenticated && latest.user_id;

    if (!shouldSaveScore) {
      return jsonResponse(200, {
        score: Number(latest.score),
        scoreSaved: false,
        authenticated: isAuthenticated
      });
    }

    const userId = latest.user_id;
    const existingScores = await supabaseFetch(
      `/rest/v1/best_scores?user_id=eq.${userId}&zone=eq.${latest.zone}&mode=eq.${latest.mode}`
    );

    const existing = Array.isArray(existingScores) ? existingScores[0] : existingScores;
    const improved = !existing || Number(latest.score) > Number(existing.score);

    if (improved) {
      await supabaseFetch(
        `/rest/v1/best_scores?on_conflict=user_id,zone,mode`,
        {
          method: 'POST',
          headers: getSupabaseHeaders({
            Prefer: 'resolution=merge-duplicates,return=representation'
          }),
          body: JSON.stringify({
            user_id: userId,
            zone: latest.zone,
            mode: latest.mode,
            score: Number(latest.score),
            updated_at: now
          })
        }
      );
    }

    return jsonResponse(200, {
      score: Number(latest.score),
      scoreSaved: improved,
      authenticated: isAuthenticated
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to finalize session.' });
  }
};
