const {
  jsonResponse,
  parseJsonBody,
  validateAuth,
  getSupabaseHeaders,
  supabaseFetch
} = require('./session-utils');

const MAX_POINTS_PER_ITEM = 10;
const MAX_ERRORS_MARATHON = 3;
const CHRONO_DURATION = 60;

function computePoints(elapsedSeconds) {
  return Math.max(0, MAX_POINTS_PER_ITEM - elapsedSeconds);
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const payload = await parseJsonBody(event);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const {
    session_id: sessionId,
    target_id: targetId,
    input_type: inputType,
    reset_targets: resetTargets,
    targets: newTargets
  } = payload;

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

    if (session.status !== 'active') {
      return jsonResponse(409, { error: 'Session already completed.' });
    }

    const now = new Date();
    const startedAt = parseDate(session.started_at);
    const expiresAt = session.expires_at ? parseDate(session.expires_at) : null;
    if (session.mode === 'chrono') {
      const cutoff = expiresAt || (startedAt
        ? new Date(startedAt.getTime() + CHRONO_DURATION * 1000)
        : null);
      if (cutoff && now > cutoff) {
        await supabaseFetch(`/rest/v1/game_sessions?id=eq.${sessionId}`, {
          method: 'PATCH',
          headers: getSupabaseHeaders({
            Prefer: 'return=representation'
          }),
          body: JSON.stringify({
            status: 'completed',
            ended_at: now.toISOString()
          })
        });
        return jsonResponse(409, { error: 'Session expired.' });
      }
    }

    let targets = Array.isArray(session.targets) ? session.targets : [];
    let currentIndex = session.current_index ?? 0;
    if (session.mode === 'chrono' && resetTargets && Array.isArray(newTargets) && newTargets.length > 0) {
      targets = newTargets;
      currentIndex = 0;
    }

    if (session.total_answered >= session.max_attempts) {
      return jsonResponse(409, { error: 'Max attempts reached.' });
    }

    const expectedTarget = targets[currentIndex];
    if (!expectedTarget) {
      return jsonResponse(409, { error: 'No target available.' });
    }

    const currentStartedAt = parseDate(session.current_item_started_at) || now;
    const elapsedSeconds = Math.max(0, (now.getTime() - currentStartedAt.getTime()) / 1000);
    const isSkip = inputType === 'skip';
    const isCorrect = !isSkip && targetId && targetId === expectedTarget;
    const points = isCorrect ? computePoints(elapsedSeconds) : 0;

    const nextTotalAnswered = session.total_answered + 1;
    const nextCorrectCount = session.correct_count + (isCorrect ? 1 : 0);
    const nextErrorsCount = session.errors_count + (isCorrect ? 0 : 1);
    const nextScore = Number(session.score) + points;

    let nextIndex = currentIndex + 1;
    if (session.mode === 'chrono' && nextIndex >= targets.length) {
      nextIndex = 0;
    }

    let nextStatus = session.status;
    let endedAt = session.ended_at;
    let maxErrorsReached = false;

    if (session.mode === 'marathon' && nextErrorsCount >= (session.max_errors ?? MAX_ERRORS_MARATHON)) {
      nextStatus = 'completed';
      endedAt = now.toISOString();
      maxErrorsReached = true;
    } else if (session.mode !== 'chrono' && nextTotalAnswered >= targets.length) {
      nextStatus = 'completed';
      endedAt = now.toISOString();
    }

    const updatedSession = await supabaseFetch(`/rest/v1/game_sessions?id=eq.${sessionId}`, {
      method: 'PATCH',
      headers: getSupabaseHeaders({
        Prefer: 'return=representation'
      }),
      body: JSON.stringify({
        targets,
        current_index: nextIndex,
        total_answered: nextTotalAnswered,
        correct_count: nextCorrectCount,
        errors_count: nextErrorsCount,
        score: nextScore,
        current_item_started_at: now.toISOString(),
        status: nextStatus,
        ended_at: endedAt
      })
    });

    const latest = Array.isArray(updatedSession) ? updatedSession[0] : updatedSession;

    return jsonResponse(200, {
      correct: isCorrect,
      points,
      elapsed_seconds: elapsedSeconds,
      score: Number(latest.score),
      total_answered: latest.total_answered,
      correct_count: latest.correct_count,
      errors_count: latest.errors_count,
      current_index: latest.current_index,
      status: latest.status,
      max_errors_reached: maxErrorsReached
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to record session event.' });
  }
};
