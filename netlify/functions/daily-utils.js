const crypto = require('crypto');

const DAILY_MAX_ATTEMPTS = 5;
const TOUCH_TOLERANCE_METERS = 35;
const CLICK_TOLERANCE_METERS = 20;
const DATASET_PATH = '/data/marseille_rues_enrichi.geojson';

const {
  STREETS_GEOJSON_URL,
  DAILY_EXCLUSIONS_GEOJSON_URL,
  DAILY_TARGET_SECRET,
  DATA_BASE_URL,
  URL,
  DEPLOY_PRIME_URL
} = process.env;

let cachedStreets = null;
let cachedExclusions = null;

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function getParisDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function buildDatasetUrl() {
  if (STREETS_GEOJSON_URL) return STREETS_GEOJSON_URL;
  const baseUrl = DATA_BASE_URL || URL || DEPLOY_PRIME_URL;
  if (!baseUrl) {
    throw new Error('Missing STREETS_GEOJSON_URL or base URL for dataset.');
  }
  return new URL(DATASET_PATH, baseUrl).toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}`);
  }
  return response.json();
}

function walkCoordinates(geometry, callback) {
  if (!geometry) return;
  const { type, coordinates, geometries } = geometry;
  if (type === 'GeometryCollection') {
    (geometries || []).forEach(item => walkCoordinates(item, callback));
    return;
  }
  if (!coordinates) return;

  const walk = (coords) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      callback(coords);
      return;
    }
    coords.forEach(walk);
  };

  walk(coordinates);
}

async function loadStreetsData() {
  if (cachedStreets) return cachedStreets;
  const url = buildDatasetUrl();
  const data = await fetchJson(url);
  const features = data.features || [];
  const indexByName = new Map();
  let bbox = {
    minLat: Infinity,
    minLng: Infinity,
    maxLat: -Infinity,
    maxLng: -Infinity
  };

  features.forEach(feature => {
    const rawName = feature?.properties?.name;
    if (typeof rawName !== 'string' || !rawName.trim()) return;
    const key = normalizeName(rawName);
    if (!indexByName.has(key)) {
      indexByName.set(key, {
        name: rawName.trim(),
        geometries: []
      });
    }
    const entry = indexByName.get(key);
    if (feature.geometry) {
      entry.geometries.push(feature.geometry);
      walkCoordinates(feature.geometry, ([lng, lat]) => {
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        bbox.minLat = Math.min(bbox.minLat, lat);
        bbox.minLng = Math.min(bbox.minLng, lng);
        bbox.maxLat = Math.max(bbox.maxLat, lat);
        bbox.maxLng = Math.max(bbox.maxLng, lng);
      });
    }
  });

  const names = Array.from(indexByName.keys()).sort();
  cachedStreets = {
    indexByName,
    names,
    bbox
  };
  return cachedStreets;
}

function selectDailyTargetKey(dateKey, names) {
  if (!DAILY_TARGET_SECRET) {
    throw new Error('Missing DAILY_TARGET_SECRET for daily target selection.');
  }
  const hash = crypto
    .createHash('sha256')
    .update(`${DAILY_TARGET_SECRET}:${dateKey}`)
    .digest('hex');
  const seed = parseInt(hash.slice(0, 8), 16);
  return names[seed % names.length];
}

function toMeters(lat, lng, refLat) {
  const rad = Math.PI / 180;
  const x = lng * 111320 * Math.cos(refLat * rad);
  const y = lat * 110540;
  return { x, y };
}

function pointToSegmentDistance(point, start, end) {
  const refLat = point.lat;
  const p = toMeters(point.lat, point.lng, refLat);
  const a = toMeters(start[1], start[0], refLat);
  const b = toMeters(end[1], end[0], refLat);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLen2 = abx * abx + aby * aby;
  const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
  const closestX = a.x + abx * t;
  const closestY = a.y + aby * t;
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  return Math.hypot(dx, dy);
}

function distanceToLine(point, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const dist = pointToSegmentDistance(point, coordinates[i], coordinates[i + 1]);
    if (dist < min) min = dist;
  }
  return min;
}

function distanceToGeometry(point, geometry) {
  if (!geometry) return Infinity;
  const { type, coordinates, geometries } = geometry;
  if (type === 'LineString') {
    return distanceToLine(point, coordinates);
  }
  if (type === 'MultiLineString') {
    return Math.min(...coordinates.map(coords => distanceToLine(point, coords)));
  }
  if (type === 'Polygon') {
    return Math.min(...coordinates.map(ring => distanceToLine(point, ring)));
  }
  if (type === 'MultiPolygon') {
    const distances = [];
    coordinates.forEach(poly => {
      poly.forEach(ring => distances.push(distanceToLine(point, ring)));
    });
    return distances.length ? Math.min(...distances) : Infinity;
  }
  if (type === 'GeometryCollection') {
    const distances = (geometries || []).map(item => distanceToGeometry(point, item));
    return distances.length ? Math.min(...distances) : Infinity;
  }
  return Infinity;
}

function isPointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInPolygon(point, polygon) {
  if (!polygon.length) return false;
  const [outer, ...holes] = polygon;
  if (!isPointInRing(point, outer)) return false;
  return !holes.some(ring => isPointInRing(point, ring));
}

function extractPolygons(geometry) {
  if (!geometry) return [];
  const { type, coordinates, geometries } = geometry;
  if (type === 'Polygon') return [coordinates];
  if (type === 'MultiPolygon') return coordinates;
  if (type === 'GeometryCollection') {
    return (geometries || []).flatMap(item => extractPolygons(item));
  }
  return [];
}

async function loadExclusions() {
  if (cachedExclusions) return cachedExclusions;
  if (!DAILY_EXCLUSIONS_GEOJSON_URL) {
    cachedExclusions = [];
    return cachedExclusions;
  }
  const data = await fetchJson(DAILY_EXCLUSIONS_GEOJSON_URL);
  const features = data.features || [];
  const polygons = features.flatMap(feature => extractPolygons(feature.geometry));
  cachedExclusions = polygons;
  return cachedExclusions;
}

function isPointInPlayableArea(point, bbox, exclusions) {
  if (!bbox || !Number.isFinite(bbox.minLat)) return false;
  const insideBbox =
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng;
  if (!insideBbox) return false;
  if (!exclusions?.length) return true;
  return !exclusions.some(polygon => isPointInPolygon(point, polygon));
}

function detectInputType(inputType, userAgent) {
  if (inputType === 'touch' || inputType === 'click') return inputType;
  const ua = userAgent || '';
  if (/mobi|android|iphone|ipad|touch/i.test(ua)) return 'touch';
  return 'click';
}

function getToleranceMeters(inputType) {
  return inputType === 'touch' ? TOUCH_TOLERANCE_METERS : CLICK_TOLERANCE_METERS;
}

module.exports = {
  DAILY_MAX_ATTEMPTS,
  normalizeName,
  getParisDateKey,
  loadStreetsData,
  loadExclusions,
  selectDailyTargetKey,
  distanceToGeometry,
  isPointInPlayableArea,
  detectInputType,
  getToleranceMeters
};
