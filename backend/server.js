const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const webPush = require('web-push');
const db = require('./database');

function readEnvIntegerInRange(name, fallback, min, max) {
    const raw = Number.parseInt(process.env[name], 10);
    if (!Number.isInteger(raw) || raw < min || raw > max) {
        return fallback;
    }
    return raw;
}

function readFirstDefinedEnv(names, fallback = '') {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return fallback;
}

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET_KEY = process.env.SECRET_KEY || '';
const ENABLE_ADMIN_ROUTES = process.env.ENABLE_ADMIN_ROUTES === 'true';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const PUSH_REMINDER_HOUR = readEnvIntegerInRange('PUSH_REMINDER_HOUR', 10, 0, 23);
const PUSH_REMINDER_MINUTE = readEnvIntegerInRange('PUSH_REMINDER_MINUTE', 0, 0, 59);
const PUSH_REMINDER_TIMEZONE = process.env.PUSH_REMINDER_TIMEZONE || 'Europe/Paris';
const ENV_VAPID_SUBJECT = readFirstDefinedEnv([
    'VAPID_SUBJECT',
    'WEB_PUSH_VAPID_SUBJECT',
    'WEBPUSH_VAPID_SUBJECT',
], 'mailto:noreply@camino.app');
const ENV_VAPID_PUBLIC_KEY = readFirstDefinedEnv([
    'VAPID_PUBLIC_KEY',
    'WEB_PUSH_VAPID_PUBLIC_KEY',
    'WEBPUSH_VAPID_PUBLIC_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'PUBLIC_VAPID_KEY',
    'PUSH_PUBLIC_KEY',
]);
const ENV_VAPID_PRIVATE_KEY = readFirstDefinedEnv([
    'VAPID_PRIVATE_KEY',
    'WEB_PUSH_VAPID_PRIVATE_KEY',
    'WEBPUSH_VAPID_PRIVATE_KEY',
    'PUSH_PRIVATE_KEY',
]);
const pushRuntime = {
    enabled: false,
    subject: ENV_VAPID_SUBJECT,
    publicKey: '',
    privateKey: '',
    source: 'none',
};
let pushRuntimeSignature = '';

if (!JWT_SECRET_KEY) {
    if (IS_PRODUCTION) {
        throw new Error('SECURITY: SECRET_KEY must be set in production');
    }
    console.warn('⚠️ SECRET_KEY is not set. Using a temporary in-memory key for development.');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET_KEY || crypto.randomBytes(32).toString('hex');

function buildPushRuntimeSignature(subject, publicKey, privateKey) {
    return `${subject}::${publicKey}::${privateKey}`;
}

function applyPushRuntimeMaterial({ subject, publicKey, privateKey, source }) {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    pushRuntime.enabled = true;
    pushRuntime.subject = subject;
    pushRuntime.publicKey = publicKey;
    pushRuntime.privateKey = privateKey;
    pushRuntime.source = source;
    pushRuntimeSignature = buildPushRuntimeSignature(subject, publicKey, privateKey);
}

async function resolvePushMaterialFromStorage() {
    let subject = ENV_VAPID_SUBJECT;
    let publicKey = ENV_VAPID_PUBLIC_KEY;
    let privateKey = ENV_VAPID_PRIVATE_KEY;
    let source = 'env';

    if (!(publicKey && privateKey)) {
        const [storedPublic, storedPrivate, storedSubject] = await Promise.all([
            db.getAppSetting('vapid_public_key'),
            db.getAppSetting('vapid_private_key'),
            db.getAppSetting('vapid_subject'),
        ]);

        if (!(storedPublic && storedPrivate)) {
            return null;
        }

        publicKey = storedPublic;
        privateKey = storedPrivate;
        subject = storedSubject || subject;
        source = 'db';
    }

    return { subject, publicKey, privateKey, source };
}

async function synchronizePushRuntimeFromStorage() {
    const material = await resolvePushMaterialFromStorage();
    if (!material) {
        return false;
    }

    const nextSignature = buildPushRuntimeSignature(
        material.subject,
        material.publicKey,
        material.privateKey,
    );
    if (pushRuntime.enabled && nextSignature === pushRuntimeSignature) {
        return true;
    }

    applyPushRuntimeMaterial(material);
    console.log(`Push notifications synchronized (source: ${material.source}).`);
    return true;
}

async function ensurePushRuntimeReady() {
    if (pushRuntime.enabled) {
        try {
            await synchronizePushRuntimeFromStorage();
            return true;
        } catch (error) {
            console.warn('Push runtime re-sync failed:', error.message);
            return true;
        }
    }

    try {
        const synced = await synchronizePushRuntimeFromStorage();
        if (synced) {
            return true;
        }
    } catch (error) {
        console.warn('Push runtime sync failed:', error.message);
    }

    return false;
}

async function initializePushRuntime() {
    try {
        const existingMaterial = await resolvePushMaterialFromStorage();
        if (existingMaterial) {
            applyPushRuntimeMaterial(existingMaterial);
            console.log(`Push notifications enabled (source: ${existingMaterial.source}).`);
            return;
        }

        const generated = webPush.generateVAPIDKeys();
        await Promise.all([
            db.setAppSettingIfMissing('vapid_public_key', generated.publicKey),
            db.setAppSettingIfMissing('vapid_private_key', generated.privateKey),
            db.setAppSettingIfMissing('vapid_subject', ENV_VAPID_SUBJECT),
        ]);

        const synced = await synchronizePushRuntimeFromStorage();
        if (!synced) {
            throw new Error('Could not persist/load VAPID keys');
        }

        if (pushRuntime.source === 'db') {
            console.warn('Push VAPID keys were auto-generated and saved in DB settings.');
        }
    } catch (error) {
        pushRuntime.enabled = false;
        pushRuntime.subject = ENV_VAPID_SUBJECT;
        pushRuntime.publicKey = '';
        pushRuntime.privateKey = '';
        pushRuntime.source = 'error';
        pushRuntimeSignature = '';
        console.error('Push notifications init failed:', error.message);
    }
}

// CORS configuration
const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://camino4.netlify.app',
    'https://camino5.netlify.app',
    'https://marseille-camino6.netlify.app',
    'https://camino7.netlify.app',
    'https://camino8.netlify.app',
    'https://camino-ajm.pages.dev',
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
].filter(Boolean));

const dynamicAllowedOriginPatterns = [
    /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,
    /^https:\/\/[a-z0-9-]+\.pages\.dev$/i,
    /^https:\/\/[a-z0-9-]+\.onrender\.com$/i,
];

function isAllowedOrigin(origin) {
    if (!origin || allowedOrigins.has(origin)) {
        return true;
    }
    return dynamicAllowedOriginPatterns.some((pattern) => pattern.test(origin));
}

app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
    }
    return next(err);
});

app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Initialize database then start server
db.initDb().then(async () => {
    console.log('Database ready.');
    await initializePushRuntime();
    startPushReminderScheduler();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
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

    jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

function timingSafeSecretMatch(providedValue, expectedValue) {
    const provided = Buffer.from(String(providedValue || ''), 'utf8');
    const expected = Buffer.from(String(expectedValue || ''), 'utf8');
    if (provided.length !== expected.length || expected.length === 0) {
        return false;
    }
    return crypto.timingSafeEqual(provided, expected);
}

function requireAdminApiKey(req, res, next) {
    if (!ENABLE_ADMIN_ROUTES) {
        return res.status(404).json({ error: 'Not found' });
    }

    if (!ADMIN_API_KEY) {
        console.error('SECURITY: ENABLE_ADMIN_ROUTES=true but ADMIN_API_KEY is not configured');
        return res.status(503).json({ error: 'Admin route misconfigured' });
    }

    const headerValue = req.headers['x-admin-key'] || '';
    const bearerValue = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const providedSecret = headerValue || bearerValue;

    if (!timingSafeSecretMatch(providedSecret, ADMIN_API_KEY)) {
        return res.status(403).json({ error: 'Unauthorized route access' });
    }

    next();
}

function getTimePartsInZone(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const byType = {};
    parts.forEach((part) => {
        byType[part.type] = part.value;
    });

    return {
        dateStr: `${byType.year}-${byType.month}-${byType.day}`,
        hour: Number.parseInt(byType.hour, 10),
        minute: Number.parseInt(byType.minute, 10),
    };
}

function isValidPushSubscription(subscription) {
    if (!subscription || typeof subscription !== 'object') {
        return false;
    }
    const endpoint = String(subscription.endpoint || '').trim();
    const keys = subscription.keys || {};
    return Boolean(
        endpoint &&
        typeof keys === 'object' &&
        String(keys.p256dh || '').trim() &&
        String(keys.auth || '').trim()
    );
}

function getDailyReminderPayload() {
    return JSON.stringify({
        title: 'Camino Daily',
        body: 'Le Daily est dispo. Lance ta partie du jour !',
        url: '/',
        tag: 'camino-daily-reminder',
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
        const token = jwt.sign({ id: userId, username }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
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

    const token = jwt.sign({ id: user.id, username: user.username }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, avatar: user.avatar || '👤' });
});

// ----------------------
// Push Notification Routes
// ----------------------

app.get('/api/notifications/public-key', async (req, res) => {
    await ensurePushRuntimeReady();
    res.json({
        enabled: pushRuntime.enabled,
        publicKey: pushRuntime.enabled ? pushRuntime.publicKey : null,
        source: pushRuntime.source,
        reminder: {
            hour: PUSH_REMINDER_HOUR,
            minute: PUSH_REMINDER_MINUTE,
            timezone: PUSH_REMINDER_TIMEZONE,
        },
    });
});

app.get('/api/notifications/status', authenticateToken, async (req, res) => {
    try {
        await ensurePushRuntimeReady();
        if (!pushRuntime.enabled) {
            return res.json({
                enabled: false,
                subscribed: false,
                reminder: {
                    hour: PUSH_REMINDER_HOUR,
                    minute: PUSH_REMINDER_MINUTE,
                    timezone: PUSH_REMINDER_TIMEZONE,
                },
            });
        }

        const subscription = await db.getPushSubscriptionStatusForUser(req.user.id);
        return res.json({
            enabled: true,
            subscribed: Boolean(subscription),
            endpoint: subscription?.endpoint || null,
            source: pushRuntime.source,
            reminder: {
                hour: PUSH_REMINDER_HOUR,
                minute: PUSH_REMINDER_MINUTE,
                timezone: PUSH_REMINDER_TIMEZONE,
            },
        });
    } catch (err) {
        console.error('Push status error:', err);
        return res.status(500).json({ error: 'Failed to load notification status' });
    }
});

app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
    await ensurePushRuntimeReady();
    if (!pushRuntime.enabled) {
        return res.status(503).json({ error: 'Push notifications are not configured on server' });
    }

    const { subscription } = req.body || {};
    if (!isValidPushSubscription(subscription)) {
        return res.status(400).json({ error: 'Invalid push subscription payload' });
    }

    try {
        await db.upsertPushSubscription(req.user.id, subscription);
        return res.json({
            success: true,
            reminder: {
                hour: PUSH_REMINDER_HOUR,
                minute: PUSH_REMINDER_MINUTE,
                timezone: PUSH_REMINDER_TIMEZONE,
            },
        });
    } catch (err) {
        console.error('Push subscribe error:', err);
        return res.status(500).json({ error: 'Failed to save push subscription' });
    }
});

app.post('/api/notifications/unsubscribe', authenticateToken, async (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim();
    try {
        await ensurePushRuntimeReady();
        if (endpoint) {
            await db.removePushSubscriptionForUser(req.user.id, endpoint);
        } else {
            await db.removeAllPushSubscriptionsForUser(req.user.id);
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('Push unsubscribe error:', err);
        return res.status(500).json({ error: 'Failed to remove push subscription' });
    }
});

app.post('/api/notifications/test', authenticateToken, async (req, res) => {
    try {
        await ensurePushRuntimeReady();
        if (!pushRuntime.enabled) {
            return res.status(503).json({ error: 'Push notifications are not configured on server' });
        }

        const latest = await db.getPushSubscriptionForUser(req.user.id);
        if (!latest?.subscription_json) {
            return res.status(404).json({ error: 'No active push subscription found for this user' });
        }

        const payload = JSON.stringify({
            title: 'Camino',
            body: 'Test push OK. Les rappels Daily devraient fonctionner.',
            url: '/',
            tag: 'camino-push-test',
        });
        await webPush.sendNotification(latest.subscription_json, payload, { TTL: 60 });

        return res.json({ success: true });
    } catch (err) {
        const statusCode = Number(err?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
            await db.removeAllPushSubscriptionsForUser(req.user.id);
            return res.status(410).json({ error: 'Push subscription expired. Re-enable reminders.' });
        }
        console.error('Push test send error:', err);
        return res.status(500).json({ error: 'Failed to send test push notification' });
    }
});

// ----------------------
// Score / Leaderboard Routes
// ----------------------

app.get('/api/leaderboard', async (req, res) => {
    try {
        const mode = req.query.mode || req.query.zone_mode;
        const gameType = req.query.gameType || req.query.game_mode;
        if (!mode || !gameType) return res.status(400).json({ error: 'Missing mode or gameType' });
        const period = req.query.period === 'month' ? 'month' : 'all';

        const rows = await db.getLeaderboard(mode, gameType, null, 10, { period });
        res.json(rows);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

app.get('/api/leaderboards', async (req, res) => {
    try {
        const period = req.query.period === 'month' ? 'month' : 'all';
        const data = await db.getAllLeaderboards(100, { period });
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

function extractVisitorId(req) {
    if (typeof req.body?.visitorId === 'string') {
        return req.body.visitorId.trim();
    }
    if (typeof req.query?.visitorId === 'string') {
        return req.query.visitorId.trim();
    }
    return '';
}

async function handleVisitorHit(req, res) {
    const visitorId = extractVisitorId(req);

    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)) {
        return res.status(400).json({ error: 'Invalid visitor id' });
    }

    try {
        const visitorHash = crypto.createHash('sha256').update(visitorId).digest('hex');
        const visits = await db.recordVisitHit(visitorHash);
        res.json({ visits });
    } catch (err) {
        console.error('Visitor counter error:', err);
        res.status(500).json({ error: 'Failed to update visitor counter' });
    }
}

app.post('/api/visitors/hit', handleVisitorHit);
app.get('/api/visitors/hit', handleVisitorHit);

app.get('/api/visitors/count', async (req, res) => {
    try {
        const visits = await db.getVisitCount();
        res.json({ visits });
    } catch (err) {
        console.error('Visitor count read error:', err);
        res.status(500).json({ error: 'Failed to load visitor counter' });
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
        const candidateGeoPaths = [
            path.join(__dirname, 'data', 'marseille_rues_light.geojson'),
            path.join(__dirname, 'data', 'marseille_rues_enrichi.geojson'),
        ];
        let data = null;
        for (const geoPath of candidateGeoPaths) {
            try {
                const raw = fs.readFileSync(geoPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.features)) {
                    data = parsed;
                    break;
                }
            } catch (readErr) {
                // Try next candidate file.
            }
        }
        if (!data) return null;
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

async function sendDailyReminderPushesForDate(dateStr) {
    if (!pushRuntime.enabled) {
        return { sent: 0, removed: 0, failed: 0 };
    }

    const payload = getDailyReminderPayload();
    const subscriptions = await db.listPushSubscriptionsDueForDate(dateStr);

    let sent = 0;
    let removed = 0;
    let failed = 0;

    for (const row of subscriptions) {
        const endpoint = row.endpoint;
        const subscription = row.subscription_json;

        try {
            await webPush.sendNotification(subscription, payload, { TTL: 60 * 60 });
            await db.markPushSubscriptionNotified(endpoint, dateStr);
            sent += 1;
        } catch (err) {
            const statusCode = Number(err?.statusCode || 0);
            if (statusCode === 404 || statusCode === 410) {
                await db.removePushSubscriptionByEndpoint(endpoint);
                removed += 1;
            } else {
                failed += 1;
                console.warn('Push send failure:', {
                    endpoint,
                    statusCode,
                    message: err?.message || 'Unknown push error',
                });
            }
        }
    }

    return { sent, removed, failed };
}

let lastReminderDateKey = '';

function hasReachedReminderTime(nowParts) {
    return (
        nowParts.hour > PUSH_REMINDER_HOUR ||
        (nowParts.hour === PUSH_REMINDER_HOUR && nowParts.minute >= PUSH_REMINDER_MINUTE)
    );
}

async function runPushReminderSchedulerTick() {
    await ensurePushRuntimeReady();
    if (!pushRuntime.enabled) {
        return;
    }

    const nowParts = getTimePartsInZone(new Date(), PUSH_REMINDER_TIMEZONE);
    if (!hasReachedReminderTime(nowParts)) {
        return;
    }

    if (nowParts.dateStr === lastReminderDateKey) {
        return;
    }

    try {
        const result = await sendDailyReminderPushesForDate(nowParts.dateStr);
        lastReminderDateKey = nowParts.dateStr;
        console.log(
            `[Push Daily ${nowParts.dateStr}] sent=${result.sent} removed=${result.removed} failed=${result.failed}`
        );
    } catch (err) {
        lastReminderDateKey = '';
        console.error('Daily push scheduler error:', err);
    }
}

function startPushReminderScheduler() {
    if (!pushRuntime.enabled) {
        console.warn('Push reminder scheduler starting in degraded mode: push runtime is not ready yet.');
    }
    runPushReminderSchedulerTick().catch((err) => {
        console.error('Initial push scheduler tick failed:', err);
    });
    setInterval(() => {
        runPushReminderSchedulerTick().catch((err) => {
            console.error('Push scheduler tick failed:', err);
        });
    }, 30 * 1000);
    console.log(`Push reminder scheduler enabled from ${String(PUSH_REMINDER_HOUR).padStart(2, '0')}:${String(PUSH_REMINDER_MINUTE).padStart(2, '0')} (${PUSH_REMINDER_TIMEZONE}).`);
}

// ----------------------
// Admin Routes (Temporary for DB cleanup)
// ----------------------
app.post('/api/admin/push/send-daily-now', requireAdminApiKey, async (req, res) => {
    try {
        await ensurePushRuntimeReady();
        if (!pushRuntime.enabled) {
            return res.status(503).json({ error: 'Push notifications are not configured on server' });
        }

        const dateInput = String(req.body?.date || '').trim();
        const fallbackDate = getTimePartsInZone(new Date(), PUSH_REMINDER_TIMEZONE).dateStr;
        const targetDate = dateInput || fallbackDate;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        const result = await sendDailyReminderPushesForDate(targetDate);
        if (targetDate === fallbackDate) {
            lastReminderDateKey = targetDate;
        }

        return res.json({
            success: true,
            date: targetDate,
            result,
            runtimeSource: pushRuntime.source,
        });
    } catch (err) {
        console.error('Admin push trigger error:', err);
        return res.status(500).json({ error: 'Failed to trigger push notifications' });
    }
});

app.post('/api/admin/clean-leaderboard', requireAdminApiKey, async (req, res) => {
    try {
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
