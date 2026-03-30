#!/usr/bin/env node
/**
 * sync_osm.js — Synchronise les rues de Marseille depuis OpenStreetMap (Overpass API).
 *
 * Usage:  node scripts/sync_osm.js
 *    ou:  npm run sync-osm
 *
 * Génère :
 *   - data/marseille_rues_enrichi.geojson  (complet, pour le backend)
 *   - data/marseille_rues_light.geojson    (léger, pour le frontend)
 *   - backend/data/marseille_rues_light.geojson (copie pour Render)
 *   - backend/data/streets_index.json      (index pour le Daily Challenge)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const osmtogeojson = require('osmtogeojson');
const { shouldKeepStreetForGame, normalizeStreetNameForFilter } = require('../street_filter');

// ── Chemins ──
const PROJECT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_DIR, 'data');
const BACKEND_DATA_DIR = path.join(PROJECT_DIR, 'backend', 'data');
const QUARTIERS_FILE_CANDIDATES = [
    process.env.QUARTIERS_FILE,
    path.join(BACKEND_DATA_DIR, 'marseille_quartiers_111.geojson'),
    path.join(DATA_DIR, 'marseille_quartiers_111.geojson'),
    path.join(PROJECT_DIR, 'dist', 'data', 'marseille_quartiers_111.geojson'),
].filter(Boolean);
const OUTPUT_ENRICHI = path.join(DATA_DIR, 'marseille_rues_enrichi.geojson');
const OUTPUT_LIGHT = path.join(DATA_DIR, 'marseille_rues_light.geojson');
const OUTPUT_SYNC_META = path.join(DATA_DIR, 'map_sync_meta.json');
const BACKEND_LIGHT = path.join(BACKEND_DATA_DIR, 'marseille_rues_light.geojson');
const STREETS_INDEX = path.join(BACKEND_DATA_DIR, 'streets_index.json');
const OVERPASS_STATUS_TIMEOUT_MS = 10_000;

// Précision des coordonnées (5 décimales ≈ 1.1 m)
const COORD_PRECISION = 5;

// ── Requête Overpass ──
// Récupère TOUTES les voies nommées dans la commune de Marseille (code INSEE 13055)
// Inclut : rues, boulevards, avenues, chemins, escaliers, passages piétons, etc.
const OVERPASS_QUERY = `
[out:json][timeout:300];
area["ref:INSEE"="13055"]->.marseille;
(
  nwr["highway"]["name"](area.marseille);
  nwr["place"="square"]["name"](area.marseille);
  nwr["area"="yes"]["name"](area.marseille);
);
out body;
>;
out skel qt;
`;

const OVERPASS_URLS = Array.from(new Set([
    process.env.OVERPASS_URL,
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
].filter(Boolean)));

// ── Utilitaires ──

function httpPost(url, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;

        const req = mod.request(parsed, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'CaminoMarseille/1.0'
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString();
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                } else {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpGet(url, timeoutMs = OVERPASS_STATUS_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;

        const req = mod.request(parsed, {
            method: 'GET',
            headers: {
                'User-Agent': 'CaminoMarseille/1.0'
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString();
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                } else {
                    resolve(data);
                }
            });
        });

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Timeout ${timeoutMs}ms`));
        });
        req.on('error', reject);
        req.end();
    });
}

function resolveFirstExistingFile(candidates) {
    for (const candidate of candidates) {
        try {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
                return candidate;
            }
        } catch (error) {
            // continue
        }
    }
    return null;
}

function buildOverpassStatusUrl(interpreterUrl) {
    const parsed = new URL(interpreterUrl);
    if (parsed.pathname.endsWith('/interpreter')) {
        parsed.pathname = parsed.pathname.replace(/\/interpreter$/, '/status');
    } else {
        parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/status`;
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

function parseOverpassStatusTimestamp(statusBody) {
    const match = String(statusBody || '').match(/osm_base:\s*([0-9T:\-+Z]+)/i);
    if (!match || !match[1]) {
        return null;
    }
    const parsed = new Date(match[1]);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString();
}

async function probeOverpassEndpoint(endpoint) {
    const host = new URL(endpoint).host;
    const statusUrl = buildOverpassStatusUrl(endpoint);
    const body = await httpGet(statusUrl, OVERPASS_STATUS_TIMEOUT_MS);
    const osmBase = parseOverpassStatusTimestamp(body);
    return {
        endpoint,
        host,
        statusUrl,
        osmBase,
        osmBaseMs: osmBase ? Date.parse(osmBase) : null
    };
}

async function rankOverpassEndpoints(endpoints) {
    const probes = await Promise.all(endpoints.map(async (endpoint) => {
        try {
            const probe = await probeOverpassEndpoint(endpoint);
            return {
                ...probe,
                ok: true,
                error: null
            };
        } catch (error) {
            return {
                endpoint,
                host: new URL(endpoint).host,
                statusUrl: buildOverpassStatusUrl(endpoint),
                osmBase: null,
                osmBaseMs: null,
                ok: false,
                error: error && error.message ? error.message : String(error)
            };
        }
    }));

    const successful = probes
        .filter((probe) => probe.ok)
        .sort((a, b) => (b.osmBaseMs || 0) - (a.osmBaseMs || 0));
    const failed = probes.filter((probe) => !probe.ok);

    const orderedEndpoints = [...successful, ...failed].map((probe) => probe.endpoint);
    return { probes, orderedEndpoints };
}

async function fetchOverpassWithFallback(body, orderedEndpoints = OVERPASS_URLS) {
    const failures = [];
    for (const endpoint of orderedEndpoints) {
        const host = new URL(endpoint).host;
        console.log(`   → Essai ${host}...`);
        try {
            const data = await httpPost(endpoint, body);
            return { data, endpoint };
        } catch (err) {
            const message = err && err.message ? err.message : String(err);
            failures.push(`${host}: ${message}`);
            console.warn(`   ⚠️  ${host} a échoué.`);
        }
    }

    throw new Error(`Toutes les instances Overpass ont échoué.\n${failures.join('\n')}`);
}

// ── Point-in-Polygon (ray casting) ──

function pointInPolygon(point, polygon) {
    // polygon = array of [lon, lat] rings
    const [px, py] = point;
    const ring = polygon[0]; // outer ring
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function findQuartier(lon, lat, quartiers) {
    for (const q of quartiers) {
        const geom = q.geometry;
        if (geom.type === 'Polygon') {
            if (pointInPolygon([lon, lat], geom.coordinates)) {
                return q.properties.nom_qua;
            }
        } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates) {
                if (pointInPolygon([lon, lat], poly)) {
                    return q.properties.nom_qua;
                }
            }
        }
    }
    return null;
}

function findNearestQuartier(lon, lat, quartiers) {
    let bestQuartier = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const q of quartiers) {
        const [qlon, qlat] = q._centroid || [null, null];
        if (!Number.isFinite(qlon) || !Number.isFinite(qlat)) {
            continue;
        }
        const dx = lon - qlon;
        const dy = lat - qlat;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < bestDistance) {
            bestDistance = dist2;
            bestQuartier = q.properties?.nom_qua || null;
        }
    }
    return bestQuartier;
}

function computeCentroid(geom) {
    if (!geom || !geom.coordinates) return [5.3698, 43.2965];
    
    let sumX = 0, sumY = 0, count = 0;
    
    function addCoords(coords) {
        if (!coords || coords.length === 0) return;
        if (typeof coords[0] === 'number') {
            sumX += coords[0]; sumY += coords[1]; count++;
        } else {
            coords.forEach(addCoords);
        }
    }
    
    addCoords(geom.coordinates);
    if(count === 0) return [5.3698, 43.2965];
    return [Math.round((sumX / count) * 1e5) / 1e5, Math.round((sumY / count) * 1e5) / 1e5];
}

// ── Conversion Overpass → GeoJSON ──

function overpassToGeoJSON(data, quartiers) {
    // We use osmtogeojson to convert the raw overpass output into standard GeoJSON 
    // This perfectly parses Relations as MultiPolygons/Polygons instead of breaking them
    const rawGeoJSON = osmtogeojson(data);

    const features = [];
    const skipped = { noName: 0, noGeometry: 0, noQuartier: 0, quartierFallback: 0 };

    for (const f of rawGeoJSON.features) {
        const properties = f.properties || {};
        const name = properties.name ? properties.name.trim() : null;
        if (!name) { skipped.noName++; continue; }

        if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) {
             skipped.noGeometry++; 
             continue; 
        }

        const allowedGeometries = ['LineString', 'Polygon', 'MultiPolygon', 'MultiLineString'];
        if (!allowedGeometries.includes(f.geometry.type)) {
             skipped.noGeometry++;
             continue;
        }

        const highway = properties.highway || properties.place || 'unknown';

        // Retain original OSM ID logic: if it's a way/relation, osmtogeojson puts id on the feature.
        properties.osm_id = f.id; 

        // Find quartier from centroid
        const centroid = computeCentroid(f.geometry);
        let quartier = findQuartier(centroid[0], centroid[1], quartiers);
        if (!quartier) {
            quartier = findNearestQuartier(centroid[0], centroid[1], quartiers);
            if (quartier) {
                skipped.quartierFallback++;
            }
        }

        if (!quartier) {
            skipped.noQuartier++;
            continue;
        }

        properties.quartier = quartier;

        // Build light properties
        const lightProperties = {
            name,
            highway,
            quartier
        };

        features.push({
            full: {
                type: 'Feature',
                properties: properties,
                geometry: f.geometry
            },
            light: {
                type: 'Feature',
                properties: lightProperties,
                geometry: f.geometry
            },
            name,
            quartier,
            centroid
        });
    }

    return { features, skipped };
}

// ── Main ──

async function main() {
    console.log('🗺️  Synchronisation OSM → Camino');
    console.log('================================\n');

    // 1. Charger les quartiers
    console.log('📂 Chargement des quartiers...');
    const quartiersFile = resolveFirstExistingFile(QUARTIERS_FILE_CANDIDATES);
    if (!quartiersFile) {
        throw new Error(
            `Fichier quartiers introuvable. Candidats: ${QUARTIERS_FILE_CANDIDATES.join(', ')}`
        );
    }
    const quartiersData = JSON.parse(fs.readFileSync(quartiersFile, 'utf8'));
    const quartiers = (quartiersData.features || []).map((feature) => ({
        ...feature,
        _centroid: computeCentroid(feature.geometry)
    }));
    console.log(`   ${quartiers.length} quartiers chargés (${path.relative(PROJECT_DIR, quartiersFile)}).\n`);

    // 2. Requête Overpass
    console.log('🌐 Requête Overpass API (peut prendre 1-2 minutes)...');
    const body = 'data=' + encodeURIComponent(OVERPASS_QUERY);
    const { probes, orderedEndpoints } = await rankOverpassEndpoints(OVERPASS_URLS);
    probes.forEach((probe) => {
        if (probe.ok) {
            console.log(`   • ${probe.host} (osm_base: ${probe.osmBase || 'inconnu'})`);
        } else {
            console.warn(`   • ${probe.host} (status indisponible: ${probe.error})`);
        }
    });

    let rawResponse;
    let selectedEndpoint = null;
    try {
        const result = await fetchOverpassWithFallback(body, orderedEndpoints);
        rawResponse = result.data;
        selectedEndpoint = result.endpoint;
    } catch (err) {
        console.error('❌ Erreur Overpass:', err.message);
        console.log('\n💡 Astuce : définir OVERPASS_URL si tu veux forcer une instance spécifique.');
        process.exit(1);
    }

    let overpassData;
    try {
        overpassData = JSON.parse(rawResponse);
    } catch (err) {
        console.error('❌ Réponse Overpass invalide (JSON):', rawResponse.substring(0, 300));
        process.exit(1);
    }

    const totalElements = (overpassData.elements || []).length;
    console.log(`   ${totalElements} éléments reçus (nœuds + voies).\n`);
    if (selectedEndpoint) {
        const host = new URL(selectedEndpoint).host;
        const osmBase = overpassData?.osm3s?.timestamp_osm_base || 'inconnu';
        console.log(`   Source retenue: ${host} (osm_base: ${osmBase})\n`);
    }

    // 3. Conversion en GeoJSON
    console.log('🔄 Conversion en GeoJSON...');
    const { features, skipped } = overpassToGeoJSON(overpassData, quartiers);
    console.log(`   ${features.length} rues avec nom et géométrie.`);
    console.log(`   Ignorées : ${skipped.noName} sans nom, ${skipped.noGeometry} sans géométrie, ${skipped.noQuartier} sans quartier.`);
    console.log(`   Quartier par proximité : ${skipped.quartierFallback}\n`);

    // Highway type breakdown
    const typeCounts = {};
    for (const f of features) {
        const hw = f.full.properties.highway;
        typeCounts[hw] = (typeCounts[hw] || 0) + 1;
    }
    console.log('📊 Types de voies :');
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted) {
        console.log(`   ${type}: ${count}`);
    }
    console.log('');

    // 4. Sauvegarder les fichiers
    const enrichiCollection = {
        type: 'FeatureCollection',
        features: features.map(f => f.full)
    };

    const lightFeatures = features.map((entry) => entry.light);
    console.log(`   Jeu carte complet : ${lightFeatures.length} segments conservés.`);

    const filteredEntries = features.filter((entry) =>
        shouldKeepStreetForGame({
            name: entry?.name,
            highway: entry?.light?.properties?.highway,
        })
    );
    console.log(
        `   Filtre gameplay (index Daily) : ${filteredEntries.length} segments gardés, ${features.length - filteredEntries.length} exclus.`
    );

    const lightCollection = {
        type: 'FeatureCollection',
        features: lightFeatures
    };

    // Enrichi (full, compact JSON)
    console.log('💾 Écriture des fichiers...');
    fs.writeFileSync(OUTPUT_ENRICHI, JSON.stringify(enrichiCollection), 'utf8');
    const enrichiSize = (fs.statSync(OUTPUT_ENRICHI).size / 1_000_000).toFixed(1);
    console.log(`   ✅ ${OUTPUT_ENRICHI} (${enrichiSize} Mo)`);

    // Light (compact JSON)
    fs.writeFileSync(OUTPUT_LIGHT, JSON.stringify(lightCollection, null, 0).replace(/\n/g, ''), 'utf8');
    const lightSize = (fs.statSync(OUTPUT_LIGHT).size / 1_000_000).toFixed(1);
    console.log(`   ✅ ${OUTPUT_LIGHT} (${lightSize} Mo)`);

    // Backend copies
    fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });
    fs.copyFileSync(OUTPUT_LIGHT, BACKEND_LIGHT);
    console.log(`   ✅ ${BACKEND_LIGHT} (copie)`);

    // Streets index for Daily Challenge
    const streetsIndex = filteredEntries.map(f => ({
        name: f.name,
        quartier: f.quartier,
        centroid: f.centroid
    }));

    // Deduplicate by name (keep first occurrence)
    const seen = new Set();
    const uniqueIndex = [];
    for (const s of streetsIndex) {
        const key = normalizeStreetNameForFilter(s.name);
        if (!seen.has(key)) {
            seen.add(key);
            uniqueIndex.push(s);
        }
    }

    fs.writeFileSync(STREETS_INDEX, JSON.stringify(uniqueIndex), 'utf8');
    const indexSize = (fs.statSync(STREETS_INDEX).size / 1_000_000).toFixed(1);
    console.log(`   ✅ ${STREETS_INDEX} (${indexSize} Mo, ${uniqueIndex.length} rues uniques)`);

    const syncMeta = {
        lastSyncedAt: new Date().toISOString(),
        generatedBy: 'scripts/sync_osm.js',
        overpassEndpoints: OVERPASS_URLS,
        overpassSelectedEndpoint: selectedEndpoint,
        overpassOsmBase: overpassData?.osm3s?.timestamp_osm_base || null,
        overpassStatus: probes.map((probe) => ({
            endpoint: probe.endpoint,
            host: probe.host,
            osmBase: probe.osmBase,
            statusError: probe.error
        })),
        overpassElements: totalElements,
        keptMapSegments: lightFeatures.length,
        keptSegments: filteredEntries.length,
        uniqueStreets: uniqueIndex.length
    };
    fs.writeFileSync(OUTPUT_SYNC_META, JSON.stringify(syncMeta, null, 2) + '\n', 'utf8');
    console.log(`   ✅ ${OUTPUT_SYNC_META}`);

    console.log('\n🎉 Synchronisation terminée !');
    console.log(`   Total : ${features.length} segments de rues, ${uniqueIndex.length} noms uniques.`);
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
