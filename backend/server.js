const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'camino-secret-key-change-me';

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://camino4.netlify.app',
    'https://camino5.netlify.app',
    'https://marseille-camino6.netlify.app',
    'https://camino7.netlify.app',
    'https://camino8.netlify.app',
    'https://camino-ajm.pages.dev',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(null, true); // Allow all for now
        }
    },
    credentials: true
}));

app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Initialize database then start server
db.initDb().then(() => {
    console.log('Database ready.');
}).catch(err => {
    console.error('Database init failed:', err);
    process.exit(1);
});

// ----------------------
// Auth Middleware
// ----------------------

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ----------------------
// Auth Routes
// ----------------------

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const userId = await db.createUser(username, password);
        const token = jwt.sign({ id: userId, username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, username, avatar: '👤' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.getUser(username);

    if (!user || !db.verifyPassword(user, password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, username: user.username, avatar: user.avatar || '👤' });
});

// ----------------------
// Score / Leaderboard Routes
// ----------------------

app.get('/api/leaderboard', async (req, res) => {
    try {
        const mode = req.query.mode || req.query.zone_mode;
        const gameType = req.query.gameType || req.query.game_mode;
        if (!mode || !gameType) return res.status(400).json({ error: 'Missing mode or gameType' });

        const rows = await db.getLeaderboard(mode, gameType);
        res.json(rows);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

app.get('/api/leaderboards', async (req, res) => {
    try {
        const data = await db.getAllLeaderboards();
        res.json(data);
    } catch (err) {
        console.error('Leaderboards error:', err);
        res.status(500).json({ error: 'Failed to load leaderboards' });
    }
});

app.post('/api/scores', authenticateToken, async (req, res) => {
    const { mode, gameType, score, itemsCorrect, itemsTotal, timeSec, quartierName } = req.body;
    if (!mode || !gameType || score === undefined) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    await db.addScore(req.user.id, req.user.username, mode, gameType, score, itemsCorrect, itemsTotal, timeSec, quartierName);
    res.json({ success: true });
});

// ----------------------
// Profile Route
// ----------------------

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUser(req.user.username);
        const stats = await db.getUserStats(req.user.id);
        res.json({ username: req.user.username, avatar: user ? (user.avatar || '👤') : '👤', ...stats });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

app.post('/api/profile/avatar', authenticateToken, async (req, res) => {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: 'Missing avatar' });

    try {
        await db.updateUserAvatar(req.user.id, avatar);
        res.json({ success: true, avatar });
    } catch (err) {
        console.error('Update avatar error:', err);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// ----------------------
// Analytics Routes
// ----------------------

app.post('/api/analytics/track', async (req, res) => {
    const { streetName, mode, correct, timeSec } = req.body;
    if (!streetName || !mode) return res.status(400).json({ error: 'Missing data' });
    try {
        await db.trackStreetAnswer(streetName, mode, !!correct, timeSec || 0);
        res.json({ ok: true });
    } catch (err) {
        // Fire-and-forget: don't crash on analytics errors
        console.warn('Analytics track error:', err.message);
        res.json({ ok: true });
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const data = await db.getAnalytics();
        res.json(data);
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

// ----------------------
// Daily Challenge Routes
// ----------------------

const fs = require('fs');
let streetIndex = [];
try {
    streetIndex = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data', 'streets_index.json'), 'utf8')
    );
    console.log(`Loaded ${streetIndex.length} streets from index for daily challenges.`);
} catch (err) {
    console.error('Could not load street index for daily:', err.message);
}

function extractStreetGeometry(streetName) {
    try {
        const geoPath = path.join(__dirname, 'data', 'marseille_rues_enrichi.geojson');
        const raw = fs.readFileSync(geoPath, 'utf8');
        const data = JSON.parse(raw);
        const normalizedTarget = streetName.toLowerCase().trim();
        for (const f of data.features) {
            if (f.properties && f.properties.name &&
                f.properties.name.toLowerCase().trim() === normalizedTarget) {
                return f.geometry;
            }
        }
    } catch (err) {
        console.error('Error extracting geometry:', err.message);
    }
    return null;
}

const { ARRONDISSEMENT_PAR_QUARTIER } = require('../data_rules.js');

function dateHash(dateStr) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) {
        h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

async function ensureDailyTarget() {
    const date = new Date().toISOString().split('T')[0];
    let target = await db.getDailyTarget(date);
    
    if (!target && streetIndex.length > 0) {
        // Find recent arrondissements to avoid
        const recentTargets = await db.getRecentDailyTargets(5);
        const forbiddenArrondissements = new Set();
        
        // Normalize function for keys (remove accents, dashes, lowercase)
        const normalizeStr = (str) => {
            if (!str) return '';
            return str
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[-\s]/g, "")
                .toLowerCase();
        };

        // Normalize the map keys for robust lookup
        const normalizedMap = {};
        for (const [key, val] of Object.entries(ARRONDISSEMENT_PAR_QUARTIER)) {
            normalizedMap[normalizeStr(key)] = val;
        }

        recentTargets.forEach(t => {
            const arr = normalizedMap[normalizeStr(t.quartier)];
            if (arr) forbiddenArrondissements.add(arr);
        });

        let attempts = 0;
        let street;
        let hashSeed = date;

        while (attempts < 100) {
            const idx = dateHash(hashSeed) % streetIndex.length;
            street = streetIndex[idx];

            const arr = normalizedMap[normalizeStr(street.quartier)];
            if (!forbiddenArrondissements.has(arr)) {
                break; // Found a good street!
            }

            // Street belongs to a recently used arrondissement, retry
            hashSeed += "_retry";
            attempts++;
        }
        
        if (attempts >= 100) {
            console.warn(`[Daily] Could not find a street in a new arrondissement after 100 attempts for date ${date}. Using fallback.`);
        }

        await db.setDailyTarget(date, street.name, street.quartier, street.centroid, null);
    } else if (!target) {
        await db.setDailyTarget(date, 'La Canebière', '1er', [5.380, 43.295], null);
    }
    return date;
}

async function getTargetGeometry(target) {
    if (target.geometry_json) return target.geometry_json;
    const geometry = extractStreetGeometry(target.street_name);
    if (geometry) {
        await db.setDailyTarget(target.date, target.street_name, target.quartier,
            JSON.parse(target.coordinates_json), geometry);
        return JSON.stringify(geometry);
    }
    return null;
}

app.get('/api/daily', authenticateToken, async (req, res) => {
    try {
        const date = await ensureDailyTarget();
        const target = await db.getDailyTarget(date);
        const status = await db.getDailyUserStatus(req.user.id, date);
        const userStatus = status || { attempts_count: 0, success: false, best_distance_meters: null };

        const response = {
            date,
            streetName: target.street_name,
            quartier: target.quartier,
            targetGeoJson: target.coordinates_json,
            userStatus
        };

        if (userStatus.success || userStatus.attempts_count >= 7) {
            response.targetGeometry = await getTargetGeometry(target);
        }

        res.json(response);
    } catch (err) {
        console.error('Daily status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/daily/guess', authenticateToken, async (req, res) => {
    try {
        const { date, distanceMeters, isSuccess } = req.body;
        const result = await db.updateDailyUserAttempt(req.user.id, date, distanceMeters, isSuccess);

        if (result.success || result.attempts_count >= 7) {
            const target = await db.getDailyTarget(date);
            result.targetGeometry = target ? await getTargetGeometry(target) : null;
        }

        res.json(result);
    } catch (err) {
        console.error('Daily guess error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/daily/leaderboard', async (req, res) => {
    try {
        const date = new Date().toISOString().split('T')[0];
        const rows = await db.getDailyLeaderboard(date);
        res.json(rows);
    } catch (err) {
        console.error('Daily leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load daily leaderboard' });
    }
});

// ----------------------
// Admin Routes (Temporary for DB cleanup)
// ----------------------
app.post('/api/admin/clean-leaderboard', async (req, res) => {
    // Basic protection using the admin secret
    const { secret } = req.body;
    if (secret !== SECRET_KEY && secret !== 'nettoyer2026') {
        return res.status(403).json({ error: 'Unauthorized route access' });
    }

    try {
        // Run SQL through the existing db connection logic instead of requiring pg again
        // But since the db file encapsulates queries, let's just use the server pool
        // Wait, the db is imported at the top as `const db = require('./database');`
        // We will just execute the query via the native mechanism in database.js
        // For simplicity, let's just make the query via new Pool with explicit requires, but wait...
        // Ah, the issue is process.env.DATABASE_URL isn't actually being used by Render in the same way, or the pool is failing because pg is not found in production `require('pg')` inside the route, since it's lazy loaded.
        // Actually, let's use the exported db module if possible, but since we just want to run DELETE FROM scores
        // Let's add a function to database.js and call it
        await db.clearAllScores();

        res.json({
            success: true,
            removed_scores: "all",
            message: 'Nettoyage terminé avec succès. Tous les scores ont été supprimés.'
        });
    } catch (err) {
        console.error('Erreur lors du nettoyage API:', err);
        res.status(500).json({ error: 'Erreur lors du nettoyage de la base.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
