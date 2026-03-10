#!/usr/bin/env node
/**
 * Build script:
 * 1) minifies main.js, data_rules.js, sw.js and style.css
 * 2) generates a deployable dist/ folder for static hosting
 *
 * IMPORTANT:
 * - backend/data/ is intentionally NOT copied to dist/
 *   (Cloudflare Pages/Vercel/Netlify free limits on large files).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

const DIST_INCLUDE = [
    '_headers',
    'index.html',
    'main.js',
    'main.js.min',
    'style.css',
    'style.css.min',
    'data_rules.js',
    'data_rules.js.min',
    'sw.js',
    'sw.js.min',
    'site.webmanifest',
    'favicon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'data',
];

function fileSize(filePath) {
    const stat = fs.statSync(filePath);
    return (stat.size / 1024).toFixed(1) + ' KB';
}

function copyItemToDist(relativePath) {
    const src = path.join(ROOT, relativePath);
    if (!fs.existsSync(src)) return;
    const dest = path.join(DIST_DIR, relativePath);
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
        return;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function generateDistFolder() {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.mkdirSync(DIST_DIR, { recursive: true });

    DIST_INCLUDE.forEach(copyItemToDist);

    const backendDataInDist = path.join(DIST_DIR, 'backend', 'data');
    if (fs.existsSync(backendDataInDist)) {
        fs.rmSync(backendDataInDist, { recursive: true, force: true });
    }

    console.log('  ✅ dist/ generated (backend/data excluded)');
}

console.log('🔨 Building Camino...\n');

// Minify JS files with Terser
const jsFiles = ['main.js', 'data_rules.js', 'sw.js'];
jsFiles.forEach(file => {
    const src = path.join(ROOT, file);
    if (!fs.existsSync(src)) return;
    const sizeBefore = fileSize(src);
    try {
        execSync(`npx terser "${src}" --compress --mangle --output "${src}.min"`, { cwd: ROOT });
        const sizeAfter = fileSize(src + '.min');
    } catch (e) {
        console.error(`  ❌ ${file}: minification failed`, e.message);
    }
});

// Minify CSS with clean-css
const cssFiles = ['style.css'];
cssFiles.forEach(file => {
    const src = path.join(ROOT, file);
    if (!fs.existsSync(src)) return;
    const sizeBefore = fileSize(src);
    try {
        execSync(`npx cleancss -o "${src}.min" "${src}"`, { cwd: ROOT });
        const sizeAfter = fileSize(src + '.min');
        console.log(`  ✅ ${file}: ${sizeBefore} → ${sizeAfter} (saved as .min)`);
    } catch (e) {
        console.error(`  ❌ ${file}: minification failed`, e.message);
    }
});

generateDistFolder();
console.log('\n✨ Build complete!');
