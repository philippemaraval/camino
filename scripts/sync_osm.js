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

// ── Chemins ──
const PROJECT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_DIR, 'data');
const BACKEND_DATA_DIR = path.join(PROJECT_DIR, 'backend', 'data');
const QUARTIERS_FILE = path.join(BACKEND_DATA_DIR, 'marseille_quartiers_111.geojson');
const OUTPUT_ENRICHI = path.join(DATA_DIR, 'marseille_rues_enrichi.geojson');
const OUTPUT_LIGHT = path.join(DATA_DIR, 'marseille_rues_light.geojson');
const BACKEND_LIGHT = path.join(BACKEND_DATA_DIR, 'marseille_rues_light.geojson');
const STREETS_INDEX = path.join(BACKEND_DATA_DIR, 'streets_index.json');

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

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// ── Utilitaires ──

function roundCoord(n) {
    return Math.round(n * 1e5) / 1e5;
}

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
    const skipped = { noName: 0, noGeometry: 0, noQuartier: 0 };

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
        const quartier = findQuartier(centroid[0], centroid[1], quartiers);

        // Discard if not inside any known quartier
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
    const quartiersData = JSON.parse(fs.readFileSync(QUARTIERS_FILE, 'utf8'));
    const quartiers = quartiersData.features;
    console.log(`   ${quartiers.length} quartiers chargés.\n`);

    // 2. Requête Overpass
    console.log('🌐 Requête Overpass API (peut prendre 1-2 minutes)...');
    const body = 'data=' + encodeURIComponent(OVERPASS_QUERY);

    let rawResponse;
    try {
        rawResponse = await httpPost(OVERPASS_URL, body);
    } catch (err) {
        console.error('❌ Erreur Overpass:', err.message);
        console.log('\n💡 Astuce : si le serveur est surchargé, réessaie dans quelques minutes.');
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

    // 3. Conversion en GeoJSON
    console.log('🔄 Conversion en GeoJSON...');
    const { features, skipped } = overpassToGeoJSON(overpassData, quartiers);
    console.log(`   ${features.length} rues avec nom et géométrie.`);
    console.log(`   Ignorées : ${skipped.noName} sans nom, ${skipped.noGeometry} sans géométrie, ${skipped.noQuartier} hors quartier.\n`);

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

    // Filtre des noms indésirables pour le jeu
    const excludedPrefixes = new Set([
        'résidence', 'lotissement', 'domaine', 
        'gare', 'station', 'métro', 
        'cité', 'accès', 'campagne', 
        'parc', 'sentier', 'cour'
    ]);
    
    // Mots-clés qui excluent la voie peu importe où ils se trouvent dans le nom (sous-catégories)
    const excludedKeywords = [
        'hameau', 'parking', 'groupe', 'entrée', 'entree', 
        'dépose', 'depose', 'copropriété', 'copropriete', 
        'lycée', 'lycee', 'hlm', 'hôpital', 'hopital', 
        'centre', 'complexe'
    ];

    const whitelist = new Set([
        "parvis madeleine et andré villard",
        "parvis saint-laurent",
        "pas d'ai de l'éboulis",
        "pavillon des intendants",
        "pavillon du parc",
        "placette ange-marius michel",
        "plateau cherchell chaix bryan",
        "plateau sacoman",
        "plateau de malmousque",
        "plateau de l'église",
        "plateau des marguerites",
        "plateau des martégaux",
        "plateau du peintre",
        "porte d'air bel",
        "porte de la castellane",
        "porte de la pomme",
        "ront-point robert dor",
        "rond-point robert dor",
        "ront-point abbé jean marcorelles",
        "rond-point abbé jean marcorelles",
        "ront-point monique gallician",
        "rond-point monique gallician",
        "rotonde pierre estrangin",
        "ruelle saint-charles",
        "vieux chemin d'endoume",
        "digue berry",
        "digue est",
        "digue sainte-marie",
        "digue du fort saint-jean",
        "boulevard de la colline",
        "bouvelard de la colline",
        "voie saint -théodore",
        "voie saint-théodore",
        "grand rue",
        "la canebière",
        "l2"
    ]);

    const safePrefixes = new Set([
        'rue', 'boulevard', 'bd', 'avenue', 'av', 'cours', 'place', 'chemin', 'traverse',
        'impasse', 'montée', 'quai', 'route', 'corniche', 'square', 'promenade', 'rond-point',
        'esplanade', 'tunnel', 'pont', 'viaduc', 'autoroute', 'escaliers', 'escalier',
        'passerelle', 'bretelle', 'vallon', 'clos', 'carrefour', 'échangeur',
        'ancien', 'ancienne', 'plage', 'rampe',
        // Conservés explicitement par l'utilisateur:
        'passage', 'allée', 'allées'
    ]);

    const lightFeatures = features.filter(f => {
        if (!f.name) return false;
        
        // Always exclude platform (bus/metro stops)
        if (f.light.properties.highway === 'platform') return false;

        let lowerName = f.name.toLowerCase();
        let firstWord = f.name.trim().split(/[\s']/)[0].toLowerCase();
        
        if (lowerName === "l2" || lowerName.startsWith("l2 ")) firstWord = "autoroute";

        // Whitelist absolue (pour les pistes, autres et voies à sauver)
        if (whitelist.has(lowerName)) return true;

        if (excludedPrefixes.has(firstWord)) return false;

        for (const kw of excludedKeywords) {
            // Regex to ensure we match whole words for short acronyms like HLM to prevent matching e.g. "Vehlmann"
            if (kw === 'hlm') {
                 if (/\bhlm\b/.test(lowerName)) return false;
            } else {
                 if (lowerName.includes(kw)) return false;
            }
        }

        // On supprime toutes les autres "Voies", "Pistes" et "Autres" (ie. qui ne sont pas dans safePrefixes)
        if (!safePrefixes.has(firstWord)) {
            return false;
        }

        return true;
    }).map(f => f.light);

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
    const streetsIndex = features.map(f => ({
        name: f.name,
        quartier: f.quartier,
        centroid: f.centroid
    }));

    // Deduplicate by name (keep first occurrence)
    const seen = new Set();
    const uniqueIndex = [];
    for (const s of streetsIndex) {
        const key = s.name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueIndex.push(s);
        }
    }

    fs.writeFileSync(STREETS_INDEX, JSON.stringify(uniqueIndex), 'utf8');
    const indexSize = (fs.statSync(STREETS_INDEX).size / 1_000_000).toFixed(1);
    console.log(`   ✅ ${STREETS_INDEX} (${indexSize} Mo, ${uniqueIndex.length} rues uniques)`);

    console.log('\n🎉 Synchronisation terminée !');
    console.log(`   Total : ${features.length} segments de rues, ${uniqueIndex.length} noms uniques.`);
    console.log('\n📌 Prochaines étapes :');
    console.log('   git add data/ backend/data/');
    console.log('   git commit -m "sync: update streets from OSM"');
    console.log('   git push origin main');
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
