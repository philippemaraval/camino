const {
  jsonResponse,
  parseJsonBody,
  validateAuth,
  supabaseFetch,
  getSupabaseHeaders
} = require('./session-utils');
const {
  DAILY_MAX_ATTEMPTS,
  getParisDateKey,
  loadStreetsData,
  loadExclusions,
  selectDailyTargetKey,
  distanceToGeometry,
  isPointInPlayableArea,
  detectInputType,
  getToleranceMeters,
  normalizeName
} = require('./daily-utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const payload = await parseJsonBody(event);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const { click_lat: clickLat, click_lng: clickLng, input_type: inputType } = payload;
  if (typeof clickLat !== 'number' || typeof clickLng !== 'number') {
    return jsonResponse(400, { error: 'click_lat and click_lng are required.' });
  }

  const auth = await validateAuth(event);
  if (auth.error || !auth.user) {
    return jsonResponse(401, { error: 'Authentication required.' });
  }

  const dateKey = getParisDateKey();
  const point = { lat: clickLat, lng: clickLng };

  try {
    const { indexByName, names, bbox } = await loadStreetsData();
    if (!names.length) {
      return jsonResponse(500, { error: 'No streets available.' });
    }
    const exclusions = await loadExclusions();
    const playable = isPointInPlayableArea(point, bbox, exclusions);
    if (!playable) {
      return jsonResponse(200, {
        playable: false,
        attempts_used: null,
        attempts_left: DAILY_MAX_ATTEMPTS,
        solved: false,
        distance_meters: null,
        message: 'Click hors zone jouable.'
      });
    }

    const targetKey = selectDailyTargetKey(dateKey, names);
    const target = indexByName.get(targetKey);
    if (!target?.geometries?.length) {
      return jsonResponse(500, { error: 'Target geometry unavailable.' });
    }

    const normalizedTargetKey = normalizeName(target.name);
    let minDistance = Infinity;
    target.geometries.forEach(geometry => {
      const distance = distanceToGeometry(point, geometry);
      if (distance < minDistance) minDistance = distance;
    });
    const roundedDistance = Math.round(minDistance);

    const detectedInput = detectInputType(inputType, event.headers['user-agent']);
    const tolerance = getToleranceMeters(detectedInput);
    const isSolved = minDistance <= tolerance;

    const existingAttempts = await supabaseFetch(
      `/rest/v1/daily_attempts?user_id=eq.${auth.user.id}&date=eq.${dateKey}&select=attempts_used,solved,solved_at`
    );
    const attemptRow = Array.isArray(existingAttempts)
      ? existingAttempts[0]
      : existingAttempts;
    const attemptsUsed = attemptRow?.attempts_used ?? 0;

    if (attemptRow?.solved) {
      return jsonResponse(200, {
        playable: true,
        solved: true,
        attempts_used: attemptsUsed,
        attempts_left: Math.max(0, DAILY_MAX_ATTEMPTS - attemptsUsed),
        distance_meters: 0,
        solved_at: attemptRow.solved_at,
        message: 'Déjà résolu.'
      });
    }

    if (attemptsUsed >= DAILY_MAX_ATTEMPTS) {
      return jsonResponse(200, {
        playable: true,
        solved: false,
        attempts_used: attemptsUsed,
        attempts_left: 0,
        distance_meters: roundedDistance,
        message: 'Nombre maximum de tentatives atteint.'
      });
    }

    const nextAttemptsUsed = attemptsUsed + 1;
    const updatePayload = {
      user_id: auth.user.id,
      date: dateKey,
      target_key: normalizedTargetKey,
      attempts_used: nextAttemptsUsed,
      solved: isSolved,
      solved_at: isSolved ? new Date().toISOString() : null
    };

    await supabaseFetch('/rest/v1/daily_attempts', {
      method: 'POST',
      headers: getSupabaseHeaders({
        Prefer: 'resolution=merge-duplicates'
      }),
      body: JSON.stringify(updatePayload)
    });

    return jsonResponse(200, {
      playable: true,
      solved: isSolved,
      attempts_used: nextAttemptsUsed,
      attempts_left: Math.max(0, DAILY_MAX_ATTEMPTS - nextAttemptsUsed),
      distance_meters: isSolved ? 0 : roundedDistance,
      solved_at: isSolved ? updatePayload.solved_at : null
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Unable to record daily attempt.' });
  }
};
