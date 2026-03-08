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

async function getLeaderboard(mode, gameType, quartierName = null, limit = 10) {
  let query = `
    SELECT username,
           MAX(score) as high_score,
           MAX(items_correct) as items_correct,
           MAX(items_total) as items_total,
           MAX(time_sec) as time_sec,
           COUNT(*) as games_played
    FROM scores
    WHERE mode = $1 AND game_type = $2 `;

  const params = [mode, gameType];

  if (quartierName) {
    query += ` AND quartier_name = $3 `;
    params.push(quartierName);
  } else if (mode === 'quartier') {
    // Legacy scores with no quartier_name fallback
    query += ` AND quartier_name IS NULL `;
  }

  query += `
    GROUP BY user_id, username
    ORDER BY high_score DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);

  const res = await pool.query(query, params);
  return res.rows;
}

async function getAllLeaderboards(limit = 100) { // Increased limit since client truncates it
  const combos = await pool.query(
    'SELECT DISTINCT mode, game_type, quartier_name FROM scores ORDER BY mode, game_type, quartier_name'
  );

  const result = {};
  for (const { mode, game_type, quartier_name } of combos.rows) {
    let key = `${mode}|${game_type}`;
    if (quartier_name) key += `|${quartier_name}`;
    else if (mode === 'quartier') key += `|unknown`; // fallback for old scores

    result[key] = await getLeaderboard(mode, game_type, quartier_name, limit);
  }
  return result;
}

// ── Daily Challenge Helpers ──

async function getDailyTarget(date) {
  const res = await pool.query('SELECT * FROM daily_targets WHERE date = $1', [date]);
  return res.rows[0] || null;
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
    `SELECT u.username, d.attempts_count, d.success
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
    `SELECT mode, game_type,
            COUNT(*) as games_played,
            MAX(score) as high_score,
            ROUND(AVG(score)::numeric, 1) as avg_score,
            MAX(items_correct) as best_items_correct,
            MAX(items_total) as best_items_total
     FROM scores
     WHERE user_id = $1
     GROUP BY mode, game_type
     ORDER BY mode, game_type`,
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
    `SELECT mode, game_type, MAX(score) as high_score
     FROM scores WHERE user_id = $1
     GROUP BY mode, game_type
     ORDER BY high_score DESC LIMIT 1`,
    [userId]
  );

  // Daily challenge stats
  const dailyStats = await pool.query(
    `SELECT COUNT(*) as total_days,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
            ROUND(AVG(attempts_count)::numeric, 1) as avg_attempts
     FROM daily_user_attempts WHERE user_id = $1`,
    [userId]
  );

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
    daily: dailyStats.rows[0] || { total_days: 0, successes: 0, avg_attempts: 0 }
  };
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
  setDailyTarget,
  getDailyUserStatus,
  updateDailyUserAttempt,
  getDailyLeaderboard,
  getUserStats,
  trackStreetAnswer,
  getAnalytics,
  clearAllScores
};
