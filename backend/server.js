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
        res.json({ token, username });
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
    res.json({ token, username: user.username });
});

// ----------------------
// Score / Leaderboard Routes
// ----------------------

app.get('/api/leaderboard', async (req, res) => {
    const mode = req.query.mode || req.query.zone_mode;
    const gameType = req.query.gameType || req.query.game_mode;
    if (!mode || !gameType) return res.status(400).json({ error: 'Missing mode or gameType' });

    const rows = await db.getLeaderboard(mode, gameType);
    res.json(rows);
});

app.get('/api/leaderboards', async (req, res) => {
    const data = await db.getAllLeaderboards();
    res.json(data);
});

app.post('/api/scores', authenticateToken, async (req, res) => {
    const { mode, gameType, score, itemsCorrect, itemsTotal, timeSec } = req.body;
    if (!mode || !gameType || score === undefined) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    await db.addScore(req.user.id, req.user.username, mode, gameType, score, itemsCorrect, itemsTotal, timeSec);
    res.json({ success: true });
});

// ----------------------
// Profile Route
// ----------------------

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const stats = await db.getUserStats(req.user.id);
        res.json({ username: req.user.username, ...stats });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Failed to load profile' });
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
        const idx = dateHash(date) % streetIndex.length;
        const street = streetIndex[idx];
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
    const date = new Date().toISOString().split('T')[0];
    const rows = await db.getDailyLeaderboard(date);
    res.json(rows);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
