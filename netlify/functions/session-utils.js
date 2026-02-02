const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };
}

function getAuthHeader(event) {
  return event.headers?.authorization || event.headers?.Authorization || '';
}

function getBearerToken(event) {
  const authHeader = getAuthHeader(event);
  if (!authHeader) return null;
  const match = authHeader.match(/Bearer\s+(.+)/i);
  return match ? match[1].trim() : null;
}

async function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (err) {
    return null;
  }
}

async function validateAuth(event) {
  const token = getBearerToken(event);
  if (!token) {
    return { user: null, token: null };
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { user: null, token: null, error: 'Missing Supabase configuration.' };
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY
    }
  });

  if (!response.ok) {
    return { user: null, token: null, error: 'Invalid auth token.' };
  }

  const user = await response.json();
  return { user, token };
}

function getSupabaseHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase admin configuration.');
  }
  const response = await fetch(`${SUPABASE_URL}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Supabase request failed.');
  }
  if (response.status === 204) return null;
  return response.json();
}

module.exports = {
  jsonResponse,
  parseJsonBody,
  validateAuth,
  getSupabaseHeaders,
  supabaseFetch
};
