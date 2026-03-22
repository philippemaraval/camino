const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Connect via DATABASE_URL (provided by Render PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

// Initialize database tables
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        avatar TEXT DEFAULT '👤',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        username TEXT,
        mode TEXT NOT NULL,
        game_type TEXT NOT NULL,
        session_id TEXT,
        score REAL NOT NULL,
        items_correct INTEGER DEFAULT 0,
        items_total INTEGER DEFAULT 0,
        time_sec REAL DEFAULT 0,
        quartier_name TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Retro-compatibility for existing DB:
    await client.query(`ALTER TABLE scores ADD COLUMN IF NOT EXISTS quartier_name TEXT`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_targets (
        date TEXT PRIMARY KEY,
        street_name TEXT NOT NULL,
        quartier TEXT,
        coordinates_json TEXT,
        geometry_json TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_user_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        date TEXT NOT NULL,
        attempts_count INTEGER DEFAULT 0,
        best_distance_meters INTEGER,
        success BOOLEAN DEFAULT FALSE,
        last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS friend_challenges (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by_username TEXT NOT NULL,
        mode TEXT NOT NULL,
        game_type TEXT NOT NULL,
        quartier_name TEXT,
        target_type TEXT NOT NULL,
        targets_json JSONB NOT NULL,
        item_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS friend_challenge_scores (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER NOT NULL REFERENCES friend_challenges(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score REAL NOT NULL,
        items_correct INTEGER DEFAULT 0,
        items_total INTEGER DEFAULT 0,
        time_sec REAL DEFAULT 0,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(challenge_id, user_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        subscription_json JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_notified_on DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
      ON push_subscriptions (user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_challenges_code
      ON friend_challenges (code)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_challenge_scores_challenge
      ON friend_challenge_scores (challenge_id)
    `);

    // Migration: add columns if missing (safe to run multiple times)
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '👤'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player'",
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS items_correct INTEGER DEFAULT 0',
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS items_total INTEGER DEFAULT 0',
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS time_sec REAL DEFAULT 0',
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS session_id TEXT',
      'ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS geometry_json TEXT',
      'ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE',
      'ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_notified_on DATE',
      'ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()'
    ];
    for (const sql of migrations) {
      try { await client.query(sql); } catch (e) { /* already exists */ }
    }

    await client.query(`
      UPDATE users
      SET role = 'player'
      WHERE role IS NULL OR TRIM(role) = ''
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_user_id_session_id
      ON scores (user_id, session_id)
    `);

    // Analytics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_streets (
        street_name TEXT NOT NULL,
        mode TEXT NOT NULL,
        correct_count INTEGER DEFAULT 0,
        wrong_count INTEGER DEFAULT 0,
        total_time_sec REAL DEFAULT 0,
        PRIMARY KEY (street_name, mode)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors_unique (
        visitor_hash TEXT PRIMARY KEY,
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        hits INTEGER DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors_counter (
        id SMALLINT PRIMARY KEY,
        total_visits BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_text TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed total visits from current unique visitors once.
    // ON CONFLICT avoids duplicate-key crashes on concurrent starts.
    await client.query(`
      INSERT INTO visitors_counter (id, total_visits)
      SELECT 1, COUNT(*)::BIGINT
      FROM visitors_unique
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('Database initialized successfully.');
  } finally {
    client.release();
  }
}

// ── User Helpers ──

async function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  try {
    const res = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash]
    );
    return res.rows[0].id;
  } catch (err) {
    if (err.code === '23505') { // PostgreSQL unique_violation
      throw new Error('Username already taken');
    }
    throw err;
  }
}

async function getUser(username) {
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0] || null;
}

async function getUserById(userId) {
  const normalizedUserId = Number.parseInt(userId, 10);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [normalizedUserId]);
  return res.rows[0] || null;
}

async function setUserRole(username, role) {
  const normalizedUsername = String(username || '').trim();
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedUsername) {
    throw new Error('Missing username');
  }
  if (!normalizedRole) {
    throw new Error('Missing role');
  }

  const result = await pool.query(
    `UPDATE users
     SET role = $1
     WHERE username = $2
     RETURNING id, username, role`,
    [normalizedRole, normalizedUsername]
  );
  return result.rows[0] || null;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

// ── Score Helpers ──

async function addScore(userId, username, mode, gameType, score, itemsCorrect, itemsTotal, timeSec, quartierName, sessionId) {
  const result = await pool.query(
    `INSERT INTO scores (
       user_id, username, mode, game_type, score, items_correct, items_total, time_sec, quartier_name, session_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, session_id) DO NOTHING
     RETURNING id`,
    [
      userId,
      username,
      mode,
      gameType,
      score,
      itemsCorrect || 0,
      itemsTotal || 0,
      timeSec || 0,
      quartierName || null,
      sessionId || null,
    ]
  );
  return result.rowCount > 0;
}

function normalizeLeaderboardPeriod(period) {
  return period === 'month' ? 'month' : 'all';
}

function getLeaderboardPeriodWhereClause(period, scoreAlias = 's') {
  if (period !== 'month') {
    return '';
  }

  return `
    AND (${scoreAlias}.timestamp AT TIME ZONE 'Europe/Paris') >= date_trunc('month', timezone('Europe/Paris', NOW()))
    AND (${scoreAlias}.timestamp AT TIME ZONE 'Europe/Paris') < (date_trunc('month', timezone('Europe/Paris', NOW())) + INTERVAL '1 month')
  `;
}

async function getLeaderboard(mode, gameType, quartierName = null, limit = 10, options = {}) {
  const period = normalizeLeaderboardPeriod(options.period);
  const params = [mode, gameType];
  let whereClause = `s.mode = $1 AND s.game_type = $2`;

  if (quartierName) {
    whereClause += ` AND s.quartier_name = $3 `;
    params.push(quartierName);
  } else if (mode === 'quartier') {
    // Legacy scores with no quartier_name fallback
    whereClause += ` AND s.quartier_name IS NULL `;
  }
  whereClause += getLeaderboardPeriodWhereClause(period, 's');

  const limitParam = `$${params.length + 1}`;
  params.push(limit);

  const query = `
    WITH filtered AS (
      SELECT s.*, u.avatar
      FROM scores s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
    ),
    ranked AS (
      SELECT
        filtered.*,
        COUNT(*) OVER (
          PARTITION BY filtered.user_id, filtered.username
        ) AS games_played,
        ROW_NUMBER() OVER (
          PARTITION BY filtered.user_id, filtered.username
          ORDER BY
            CASE
              WHEN $2 = 'classique' THEN filtered.score::double precision
              ELSE filtered.items_correct::double precision
            END DESC,
            filtered.time_sec ASC,
            filtered.timestamp ASC
        ) AS rn
      FROM filtered
    ),
    best_runs AS (
      SELECT
        username,
        avatar,
        score AS high_score,
        items_correct,
        items_total,
        time_sec,
        games_played
      FROM ranked
      WHERE rn = 1
    )
    SELECT
      username,
      avatar,
      high_score,
      items_correct,
      items_total,
      time_sec,
      games_played
    FROM best_runs
    ORDER BY
      CASE
        WHEN $2 = 'classique' THEN best_runs.high_score::double precision
        ELSE best_runs.items_correct::double precision
      END DESC,
      time_sec ASC,
      username ASC
    LIMIT ${limitParam}
  `;

  const res = await pool.query(query, params);
  return res.rows;
}

async function getAllLeaderboards(limit = 100, options = {}) { // Increased limit since client truncates it
  const period = normalizeLeaderboardPeriod(options.period);
  const periodWhereClause = getLeaderboardPeriodWhereClause(period, 's');
  const combos = await pool.query(
    `SELECT DISTINCT mode, game_type, quartier_name
     FROM scores s
     WHERE 1 = 1
     ${periodWhereClause}
     ORDER BY mode, game_type, quartier_name`
  );

  const result = {};
  const loaders = combos.rows.map(async ({ mode, game_type, quartier_name }) => {
    let key = `${mode}|${game_type}`;
    if (quartier_name) key += `|${quartier_name}`;
    else if (mode === 'quartier') key += `|unknown`; // fallback for old scores

    result[key] = await getLeaderboard(mode, game_type, quartier_name, limit, { period });
  });
  await Promise.all(loaders);
  return result;
}

// ── Friend Challenge Helpers ──

async function createFriendChallenge({
  code,
  createdByUserId,
  createdByUsername,
  mode,
  gameType,
  quartierName,
  targetType,
  targetNames,
  expiresAt,
}) {
  const result = await pool.query(
    `INSERT INTO friend_challenges (
       code,
       created_by_user_id,
       created_by_username,
       mode,
       game_type,
       quartier_name,
       target_type,
       targets_json,
       item_count,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING
       id,
       code,
       created_by_user_id,
       created_by_username,
       mode,
       game_type,
       quartier_name,
       target_type,
       targets_json,
       item_count,
       created_at,
       expires_at`,
    [
      code,
      createdByUserId,
      createdByUsername,
      mode,
      gameType,
      quartierName || null,
      targetType,
      JSON.stringify(Array.isArray(targetNames) ? targetNames : []),
      Array.isArray(targetNames) ? targetNames.length : 0,
      expiresAt || null,
    ]
  );
  return result.rows[0] || null;
}

async function getFriendChallengeByCode(code) {
  const result = await pool.query(
    `SELECT
       id,
       code,
       created_by_user_id,
       created_by_username,
       mode,
       game_type,
       quartier_name,
       target_type,
       targets_json,
       item_count,
       created_at,
       expires_at
     FROM friend_challenges
     WHERE code = $1
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [code]
  );
  return result.rows[0] || null;
}

async function hasPlayedFriendChallenge(challengeId, userId) {
  const challenge = Number.parseInt(challengeId, 10);
  const user = Number.parseInt(userId, 10);
  if (!Number.isInteger(challenge) || challenge <= 0 || !Number.isInteger(user) || user <= 0) {
    return false;
  }

  const result = await pool.query(
    `SELECT 1
     FROM friend_challenge_scores
     WHERE challenge_id = $1 AND user_id = $2
     LIMIT 1`,
    [challenge, user]
  );
  return result.rowCount > 0;
}

async function addFriendChallengeScore(
  challengeId,
  userId,
  score,
  itemsCorrect,
  itemsTotal,
  timeSec,
  gameType
) {
  const result = await pool.query(
    `INSERT INTO friend_challenge_scores (
       challenge_id,
       user_id,
       score,
       items_correct,
       items_total,
       time_sec
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (challenge_id, user_id) DO UPDATE SET
       score = EXCLUDED.score,
       items_correct = EXCLUDED.items_correct,
       items_total = EXCLUDED.items_total,
       time_sec = EXCLUDED.time_sec,
       updated_at = NOW()
     WHERE
       (
         CASE
           WHEN $7 = 'classique' THEN EXCLUDED.score::double precision
           ELSE EXCLUDED.items_correct::double precision
         END
       ) >
       (
         CASE
           WHEN $7 = 'classique' THEN friend_challenge_scores.score::double precision
           ELSE friend_challenge_scores.items_correct::double precision
         END
       )
       OR (
         (
           CASE
             WHEN $7 = 'classique' THEN EXCLUDED.score::double precision
             ELSE EXCLUDED.items_correct::double precision
           END
         ) =
         (
           CASE
             WHEN $7 = 'classique' THEN friend_challenge_scores.score::double precision
             ELSE friend_challenge_scores.items_correct::double precision
           END
         )
         AND EXCLUDED.time_sec::double precision < friend_challenge_scores.time_sec::double precision
       )
     RETURNING id`,
    [
      challengeId,
      userId,
      score,
      itemsCorrect || 0,
      itemsTotal || 0,
      timeSec || 0,
      gameType,
    ]
  );
  return result.rowCount > 0;
}

async function getFriendChallengeLeaderboard(challengeId, gameType, limit = 20) {
  const parsedLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  const result = await pool.query(
    `SELECT
       u.username,
       COALESCE(u.avatar, '👤') AS avatar,
       s.score,
       s.items_correct,
       s.items_total,
       s.time_sec
     FROM friend_challenge_scores s
     JOIN users u ON s.user_id = u.id
     WHERE s.challenge_id = $1
     ORDER BY
       CASE
         WHEN $2 = 'classique' THEN s.score::double precision
         ELSE s.items_correct::double precision
       END DESC,
       s.time_sec ASC,
       s.submitted_at ASC
     LIMIT $3`,
    [challengeId, gameType, parsedLimit]
  );
  return result.rows;
}

async function deleteExpiredFriendChallenges() {
  const result = await pool.query(
    `DELETE FROM friend_challenges
     WHERE expires_at IS NOT NULL
       AND expires_at <= NOW()`
  );
  return result.rowCount || 0;
}

// ── Daily Challenge Helpers ──

async function getDailyTarget(date) {
  const res = await pool.query('SELECT * FROM daily_targets WHERE date = $1', [date]);
  return res.rows[0] || null;
}

async function getRecentDailyTargets(limit) {
  const res = await pool.query(
    'SELECT * FROM daily_targets ORDER BY date DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}

async function setDailyTarget(date, streetName, quartier, coordinates, geometry) {
  await pool.query(
    `INSERT INTO daily_targets (date, street_name, quartier, coordinates_json, geometry_json)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (date) DO UPDATE SET
       street_name = EXCLUDED.street_name,
       quartier = EXCLUDED.quartier,
       coordinates_json = EXCLUDED.coordinates_json,
       geometry_json = EXCLUDED.geometry_json`,
    [date, streetName, quartier, JSON.stringify(coordinates), geometry ? JSON.stringify(geometry) : null]
  );
}

async function getDailyUserStatus(userId, date) {
  const res = await pool.query(
    'SELECT * FROM daily_user_attempts WHERE user_id = $1 AND date = $2',
    [userId, date]
  );
  return res.rows[0] || null;
}

async function updateDailyUserAttempt(userId, date, distanceMeters, isSuccess) {
  const result = await pool.query(
    `INSERT INTO daily_user_attempts (
       user_id, date, attempts_count, best_distance_meters, success, last_attempt_at
     )
     VALUES ($1, $2, 1, $3, $4, NOW())
     ON CONFLICT (user_id, date) DO UPDATE SET
       attempts_count = daily_user_attempts.attempts_count + 1,
       best_distance_meters = CASE
         WHEN daily_user_attempts.best_distance_meters IS NULL THEN EXCLUDED.best_distance_meters
         WHEN EXCLUDED.best_distance_meters < daily_user_attempts.best_distance_meters THEN EXCLUDED.best_distance_meters
         ELSE daily_user_attempts.best_distance_meters
       END,
       success = (daily_user_attempts.success OR EXCLUDED.success),
       last_attempt_at = NOW()
     RETURNING attempts_count, best_distance_meters, success`,
    [userId, date, distanceMeters, Boolean(isSuccess)]
  );

  return result.rows[0];
}

async function getDailyLeaderboard(date) {
  const res = await pool.query(
    `SELECT u.username, u.avatar, d.attempts_count, d.success
     FROM daily_user_attempts d
     JOIN users u ON d.user_id = u.id
     WHERE d.date = $1 AND d.success = TRUE
     ORDER BY d.attempts_count ASC, d.last_attempt_at ASC
     LIMIT 20`,
    [date]
  );
  return res.rows;
}

// ── Push Notifications Helpers ──

async function upsertPushSubscription(userId, subscription) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint) {
    throw new Error('Invalid push subscription endpoint');
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, enabled, updated_at)
     VALUES ($1, $2, $3::jsonb, TRUE, NOW())
     ON CONFLICT (endpoint)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       subscription_json = EXCLUDED.subscription_json,
       enabled = TRUE,
       updated_at = NOW()`,
    [userId, endpoint, JSON.stringify(subscription)]
  );
}

async function getPushSubscriptionStatusForUser(userId) {
  const res = await pool.query(
    `SELECT endpoint, enabled, updated_at
     FROM push_subscriptions
     WHERE user_id = $1 AND enabled = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return res.rows[0] || null;
}

async function removePushSubscriptionForUser(userId, endpoint) {
  const normalizedEndpoint = String(endpoint || '').trim();
  if (!normalizedEndpoint) {
    return;
  }
  await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, normalizedEndpoint]
  );
}

async function removeAllPushSubscriptionsForUser(userId) {
  await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
}

async function removePushSubscriptionByEndpoint(endpoint) {
  const normalizedEndpoint = String(endpoint || '').trim();
  if (!normalizedEndpoint) {
    return;
  }
  await pool.query(
    'DELETE FROM push_subscriptions WHERE endpoint = $1',
    [normalizedEndpoint]
  );
}

async function listPushSubscriptionsDueForDate(dateStr) {
  const res = await pool.query(
    `SELECT endpoint, subscription_json
     FROM push_subscriptions
     WHERE enabled = TRUE
       AND (last_notified_on IS NULL OR last_notified_on < $1::date)
     ORDER BY updated_at ASC`,
    [dateStr]
  );
  return res.rows;
}

async function markPushSubscriptionNotified(endpoint, dateStr) {
  const normalizedEndpoint = String(endpoint || '').trim();
  if (!normalizedEndpoint) {
    return;
  }
  await pool.query(
    `UPDATE push_subscriptions
     SET last_notified_on = $1::date,
         updated_at = NOW()
     WHERE endpoint = $2`,
    [dateStr, normalizedEndpoint]
  );
}

// ── Player Profile Stats ──

async function getUserStats(userId) {
  // Per-mode stats
  const modeStats = await pool.query(
    `WITH grouped AS (
       SELECT
         mode,
         game_type,
         COUNT(*) as games_played,
         ROUND(AVG(score)::numeric, 1) as avg_score
       FROM scores
       WHERE user_id = $1
       GROUP BY mode, game_type
     ),
     best AS (
       SELECT
         mode,
         game_type,
         score AS high_score,
         items_correct AS best_items_correct,
         items_total AS best_items_total,
         ROW_NUMBER() OVER (
           PARTITION BY mode, game_type
           ORDER BY
             CASE
               WHEN game_type = 'classique' THEN score::double precision
               ELSE items_correct::double precision
             END DESC,
             time_sec ASC,
             timestamp ASC
         ) AS rn
       FROM scores
       WHERE user_id = $1
     )
     SELECT
       grouped.mode,
       grouped.game_type,
       grouped.games_played,
       best.high_score,
       grouped.avg_score,
       best.best_items_correct,
       best.best_items_total
     FROM grouped
     JOIN best ON
       best.mode = grouped.mode
       AND best.game_type = grouped.game_type
       AND best.rn = 1
     ORDER BY grouped.mode, grouped.game_type`,
    [userId]
  );

  // Overall aggregates
  const overall = await pool.query(
    `SELECT COUNT(*) as total_games,
            COALESCE(MAX(score), 0) as best_score,
            ROUND(COALESCE(AVG(score), 0)::numeric, 1) as avg_score
     FROM scores WHERE user_id = $1`,
    [userId]
  );

  // Best mode (highest high score)
  const bestMode = await pool.query(
    `WITH ranked AS (
       SELECT
         mode,
         game_type,
         score AS high_score,
         items_correct,
         items_total,
         time_sec,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE
               WHEN game_type = 'classique' THEN score::double precision
               ELSE items_correct::double precision
             END DESC,
             time_sec ASC,
             timestamp ASC
         ) AS rn
       FROM scores
       WHERE user_id = $1
     )
     SELECT mode, game_type, high_score, items_correct, items_total
     FROM ranked
     WHERE rn = 1`,
    [userId]
  );

  const weeklyProgress = await pool.query(
    `WITH weeks AS (
       SELECT generate_series(
         date_trunc('week', timezone('Europe/Paris', NOW())) - interval '11 weeks',
         date_trunc('week', timezone('Europe/Paris', NOW())),
         interval '1 week'
       ) AS week_start
     ),
     agg AS (
       SELECT
         date_trunc('week', timestamp AT TIME ZONE 'Europe/Paris') AS week_start,
         COUNT(*)::int AS games_played,
         ROUND(AVG(score)::numeric, 1) AS avg_score,
         ROUND(
           AVG(
             CASE
               WHEN items_total > 0 THEN (items_correct::double precision * 100.0 / items_total::double precision)
               ELSE NULL
             END
           )::numeric,
           1
         ) AS success_rate,
         ROUND(AVG(NULLIF(time_sec, 0))::numeric, 1) AS avg_time_sec
       FROM scores
       WHERE user_id = $1
       GROUP BY 1
     )
     SELECT
       TO_CHAR(w.week_start, 'DD/MM') AS label,
       COALESCE(a.games_played, 0) AS games_played,
       COALESCE(a.avg_score, 0) AS avg_score,
       COALESCE(a.success_rate, 0) AS success_rate,
       COALESCE(a.avg_time_sec, 0) AS avg_time_sec
     FROM weeks w
     LEFT JOIN agg a ON a.week_start = w.week_start
     ORDER BY w.week_start ASC`,
    [userId]
  );

  const quartierStats = await pool.query(
    `SELECT
       quartier_name,
       COUNT(*)::int AS games_played,
       ROUND(
         AVG(
           CASE
             WHEN items_total > 0 THEN (items_correct::double precision * 100.0 / items_total::double precision)
             ELSE NULL
           END
         )::numeric,
         1
       ) AS success_rate,
       ROUND(AVG(NULLIF(time_sec, 0))::numeric, 1) AS avg_time_sec,
       ROUND(MAX(score)::numeric, 1) AS best_score
     FROM scores
     WHERE user_id = $1
       AND quartier_name IS NOT NULL
       AND quartier_name <> ''
     GROUP BY quartier_name
     ORDER BY games_played DESC, success_rate DESC, quartier_name ASC
     LIMIT 40`,
    [userId]
  );

  const difficultyStats = await pool.query(
    `SELECT
       mode,
       COUNT(*)::int AS games_played,
       ROUND(
         AVG(
           CASE
             WHEN items_total > 0 THEN (items_correct::double precision * 100.0 / items_total::double precision)
             ELSE NULL
           END
         )::numeric,
         1
       ) AS success_rate,
       ROUND(AVG(NULLIF(time_sec, 0))::numeric, 1) AS avg_time_sec
     FROM scores
     WHERE user_id = $1
     GROUP BY mode
     ORDER BY mode`,
    [userId]
  );

  // Daily challenge stats (basic)
  const dailyStats = await pool.query(
    `SELECT COUNT(*) as total_days,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
            ROUND(AVG(attempts_count)::numeric, 1) as avg_attempts
     FROM daily_user_attempts WHERE user_id = $1`,
    [userId]
  );

  const dailyStreaks = await pool.query(
    `WITH success_dates AS (
       SELECT DISTINCT date::date AS day
       FROM daily_user_attempts
       WHERE user_id = $1
         AND success = TRUE
         AND date ~ '^\\d{4}-\\d{2}-\\d{2}$'
     ),
     streak_groups AS (
       SELECT
         day,
         (day - (ROW_NUMBER() OVER (ORDER BY day))::int) AS grp
       FROM success_dates
     ),
     streaks AS (
       SELECT
         MIN(day) AS start_day,
         MAX(day) AS end_day,
         COUNT(*)::int AS streak_len
       FROM streak_groups
       GROUP BY grp
     ),
     today AS (
       SELECT timezone('Europe/Paris', NOW())::date AS day
     ),
     latest AS (
       SELECT end_day, streak_len
       FROM streaks
       ORDER BY end_day DESC
       LIMIT 1
     )
     SELECT
       COALESCE((SELECT MAX(streak_len) FROM streaks), 0)::int AS max_streak,
       COALESCE((
         SELECT
           CASE
             WHEN latest.end_day = today.day OR latest.end_day = (today.day - 1)
               THEN latest.streak_len
             ELSE 0
           END
         FROM latest
         CROSS JOIN today
       ), 0)::int AS current_streak`,
    [userId]
  );
  const currentStreak = Number(dailyStreaks.rows[0]?.current_streak || 0);
  const maxStreak = Number(dailyStreaks.rows[0]?.max_streak || 0);

  // Account creation date
  const userInfo = await pool.query(
    'SELECT created_at FROM users WHERE id = $1',
    [userId]
  );

  return {
    memberSince: userInfo.rows[0]?.created_at || null,
    overall: overall.rows[0] || { total_games: 0, best_score: 0, avg_score: 0 },
    bestMode: bestMode.rows[0] || null,
    modes: modeStats.rows,
    weekly_progress: weeklyProgress.rows || [],
    quartier_stats: quartierStats.rows || [],
    difficulty_stats: difficultyStats.rows || [],
    daily: {
      ...(dailyStats.rows[0] || { total_days: 0, successes: 0, avg_attempts: 0 }),
      current_streak: currentStreak,
      max_streak: maxStreak
    }
  };
}

async function updateUserAvatar(userId, avatar) {
  await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
}

// ── Analytics ──

async function trackStreetAnswer(streetName, mode, correct, timeSec) {
  const col = correct ? 'correct_count' : 'wrong_count';
  await pool.query(
    `INSERT INTO analytics_streets (street_name, mode, ${col}, total_time_sec)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (street_name, mode) DO UPDATE SET
       ${col} = analytics_streets.${col} + 1,
       total_time_sec = analytics_streets.total_time_sec + $3`,
    [streetName.toLowerCase().trim(), mode, timeSec || 0]
  );
}

async function getAnalytics(limit = 20) {
  // Hardest streets (lowest success rate, min 5 answers)
  const hardest = await pool.query(
    `SELECT street_name, mode,
            correct_count, wrong_count,
            (correct_count + wrong_count) as total,
            ROUND((correct_count * 100.0 / NULLIF(correct_count + wrong_count, 0))::numeric, 1) as success_rate,
            ROUND((total_time_sec / NULLIF(correct_count, 0))::numeric, 1) as avg_time_sec
     FROM analytics_streets
     WHERE (correct_count + wrong_count) >= 5
     ORDER BY success_rate ASC
     LIMIT $1`,
    [limit]
  );

  // Easiest streets
  const easiest = await pool.query(
    `SELECT street_name, mode,
            correct_count, wrong_count,
            (correct_count + wrong_count) as total,
            ROUND((correct_count * 100.0 / NULLIF(correct_count + wrong_count, 0))::numeric, 1) as success_rate,
            ROUND((total_time_sec / NULLIF(correct_count, 0))::numeric, 1) as avg_time_sec
     FROM analytics_streets
     WHERE (correct_count + wrong_count) >= 5
     ORDER BY success_rate DESC
     LIMIT $1`,
    [limit]
  );

  // Overall stats
  const overall = await pool.query(
    `SELECT COUNT(DISTINCT street_name) as unique_streets,
            SUM(correct_count + wrong_count) as total_answers,
            ROUND(AVG(correct_count * 100.0 / NULLIF(correct_count + wrong_count, 0))::numeric, 1) as avg_success_rate
     FROM analytics_streets`
  );

  return {
    hardest: hardest.rows,
    easiest: easiest.rows,
    overall: overall.rows[0] || {}
  };
}

async function recordVisitHit(visitorHash) {
  await pool.query(
    `INSERT INTO visitors_unique (visitor_hash)
     VALUES ($1)
     ON CONFLICT (visitor_hash) DO UPDATE SET
       last_seen = NOW(),
       hits = visitors_unique.hits + 1`,
    [visitorHash]
  );

  const total = await pool.query(
    `INSERT INTO visitors_counter (id, total_visits, updated_at)
     VALUES (1, (SELECT COUNT(*)::BIGINT FROM visitors_unique) + 1, NOW())
     ON CONFLICT (id) DO UPDATE SET
       total_visits = visitors_counter.total_visits + 1,
       updated_at = NOW()
     RETURNING total_visits`
  );
  return Number(total.rows[0]?.total_visits || 0);
}

async function getVisitCount() {
  await pool.query(
    `INSERT INTO visitors_counter (id, total_visits)
     SELECT 1, COUNT(*)::BIGINT
     FROM visitors_unique
     ON CONFLICT (id) DO NOTHING`
  );

  const total = await pool.query(
    `SELECT total_visits
     FROM visitors_counter
     WHERE id = 1`
  );
  return Number(total.rows[0]?.total_visits || 0);
}

async function getAppSetting(key) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    return null;
  }
  const result = await pool.query(
    'SELECT value_text FROM app_settings WHERE key = $1',
    [normalizedKey]
  );
  return result.rows[0]?.value_text || null;
}

async function setAppSetting(key, value) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    throw new Error('Invalid app setting key');
  }
  await pool.query(
    `INSERT INTO app_settings (key, value_text, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value_text = EXCLUDED.value_text,
       updated_at = NOW()`,
    [normalizedKey, String(value ?? '')]
  );
}

async function setAppSettingIfMissing(key, value) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    throw new Error('Invalid app setting key');
  }
  await pool.query(
    `INSERT INTO app_settings (key, value_text, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [normalizedKey, String(value ?? '')]
  );
}

async function clearAllScores() {
  await pool.query('DELETE FROM scores');
}

module.exports = {
  initDb,
  createUser,
  getUser,
  getUserById,
  verifyPassword,
  addScore,
  getLeaderboard,
  getAllLeaderboards,
  createFriendChallenge,
  getFriendChallengeByCode,
  hasPlayedFriendChallenge,
  addFriendChallengeScore,
  getFriendChallengeLeaderboard,
  deleteExpiredFriendChallenges,
  getDailyTarget,
  getRecentDailyTargets,
  setDailyTarget,
  getDailyUserStatus,
  updateDailyUserAttempt,
  getDailyLeaderboard,
  upsertPushSubscription,
  getPushSubscriptionStatusForUser,
  removePushSubscriptionForUser,
  removeAllPushSubscriptionsForUser,
  removePushSubscriptionByEndpoint,
  listPushSubscriptionsDueForDate,
  markPushSubscriptionNotified,
  getUserStats,
  trackStreetAnswer,
  getAnalytics,
  recordVisitHit,
  getVisitCount,
  getAppSetting,
  setAppSetting,
  setAppSettingIfMissing,
  clearAllScores,
  updateUserAvatar,
  setUserRole
};
