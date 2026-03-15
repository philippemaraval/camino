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

    // Migration: add columns if missing (safe to run multiple times)
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '👤'",
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS items_correct INTEGER DEFAULT 0',
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS items_total INTEGER DEFAULT 0',
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS time_sec REAL DEFAULT 0',
      'ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS geometry_json TEXT'
    ];
    for (const sql of migrations) {
      try { await client.query(sql); } catch (e) { /* already exists */ }
    }

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

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

// ── Score Helpers ──

async function addScore(userId, username, mode, gameType, score, itemsCorrect, itemsTotal, timeSec, quartierName) {
  await pool.query(
    `INSERT INTO scores (user_id, username, mode, game_type, score, items_correct, items_total, time_sec, quartier_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userId, username, mode, gameType, score, itemsCorrect || 0, itemsTotal || 0, timeSec || 0, quartierName || null]
  );
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
  for (const { mode, game_type, quartier_name } of combos.rows) {
    let key = `${mode}|${game_type}`;
    if (quartier_name) key += `|${quartier_name}`;
    else if (mode === 'quartier') key += `|unknown`; // fallback for old scores

    result[key] = await getLeaderboard(mode, game_type, quartier_name, limit, { period });
  }
  return result;
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
  // Ensure record exists
  await pool.query(
    `INSERT INTO daily_user_attempts (user_id, date, attempts_count, best_distance_meters, success)
     VALUES ($1, $2, 0, NULL, FALSE)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [userId, date]
  );

  const current = await getDailyUserStatus(userId, date);
  const newCount = current.attempts_count + 1;

  let newBestDist = current.best_distance_meters;
  if (newBestDist === null || distanceMeters < newBestDist) {
    newBestDist = distanceMeters;
  }

  const newSuccess = current.success || isSuccess;

  await pool.query(
    `UPDATE daily_user_attempts
     SET attempts_count = $1, best_distance_meters = $2, success = $3, last_attempt_at = NOW()
     WHERE user_id = $4 AND date = $5`,
    [newCount, newBestDist, newSuccess, userId, date]
  );

  return { attempts_count: newCount, best_distance_meters: newBestDist, success: newSuccess };
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

  // Daily streak calculation
  const dailyHistory = await pool.query(
    `SELECT date FROM daily_user_attempts
     WHERE user_id = $1 AND success = TRUE
     ORDER BY date ASC`,
    [userId]
  );

  let currentStreak = 0;
  let maxStreak = 0;
  
  if (dailyHistory.rows.length > 0) {
    const datesStr = dailyHistory.rows.map(r => r.date);
    
    let tempStreak = 1;
    let localMax = 1;
    
    // Parse the actual current server date to see if streak is alive
    // Assuming format YYYY-MM-DD
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    const yestObj = new Date(todayObj);
    yestObj.setDate(yestObj.getDate() - 1);
    const yestStr = `${yestObj.getFullYear()}-${String(yestObj.getMonth() + 1).padStart(2, '0')}-${String(yestObj.getDate()).padStart(2, '0')}`;

    for (let i = 1; i < datesStr.length; i++) {
        const d1 = new Date(datesStr[i - 1]);
        const d2 = new Date(datesStr[i]);
        
        // Difference in days
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            tempStreak++;
        } else if (diffDays > 1) {
            if (tempStreak > localMax) localMax = tempStreak;
            tempStreak = 1;
        }
    }
    
    if (tempStreak > localMax) localMax = tempStreak;
    maxStreak = localMax;
    
    // Determine if streak is currently active
    const lastDate = datesStr[datesStr.length - 1];
    if (lastDate === todayStr || lastDate === yestStr) {
       currentStreak = tempStreak;
    } else {
       currentStreak = 0;
    }
  }

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

async function clearAllScores() {
  await pool.query('DELETE FROM scores');
}

module.exports = {
  initDb,
  createUser,
  getUser,
  verifyPassword,
  addScore,
  getLeaderboard,
  getAllLeaderboards,
  getDailyTarget,
  getRecentDailyTargets,
  setDailyTarget,
  getDailyUserStatus,
  updateDailyUserAttempt,
  getDailyLeaderboard,
  getUserStats,
  trackStreetAnswer,
  getAnalytics,
  recordVisitHit,
  clearAllScores,
  updateUserAvatar
};
