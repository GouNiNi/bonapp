const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../apps.config.json');
const APPS_FILE = path.join(__dirname, '../dist/apps.json');
const ICONS_DIR = path.join(__dirname, '../dist/icons');

async function updateMetadata() {
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    let appDeclarations = [];
    if (fs.existsSync(CONFIG_FILE)) {
        appDeclarations = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } else if (fs.existsSync(APPS_FILE)) {
        appDeclarations = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    }

    // Sort alphabetically by app name
    appDeclarations.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    const iconPaths = [
        'pwa-192x192.png',
        'icons/icon-192x192.png',
        'icon-192.png',
        'apple-touch-icon.png',
        'favicon.svg',
        'favicon.png',
        'pwa-512x512.png',
        'icons/icon-512x512.png',
        'icon-512.png',
        'app-icon.svg',
        'favicon.ico'
    ];

    const metaFiles = ['version.json', 'package.json', 'manifest.json', 'manifest.webmanifest'];

    const updatedApps = [];

    for (let app of appDeclarations) {
        console.log(`Checking ${app.name} (${app.url || app.repo})...`);
        const item = { ...app };
        const repoDir = app.repo ? path.join(__dirname, '../../', app.repo) : null;

        // 1. Resolve Version (local repo inspection first, then remote fetch)
        item.version = null;
        if (repoDir && fs.existsSync(repoDir)) {
            const versionDotFile = path.join(repoDir, '.version');
            if (fs.existsSync(versionDotFile)) {
                try {
                    const v = fs.readFileSync(versionDotFile, 'utf8').trim();
                    if (v) item.version = v;
                } catch (e) {}
            }
            if (!item.version) {
                const pkgPath = path.join(repoDir, 'package.json');
                const frontendPkgPath = path.join(repoDir, 'frontend/package.json');
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        if (pkg.version && pkg.version !== '0.0.0') {
                            item.version = pkg.version;
                        }
                    } catch (e) {}
                }
                if (!item.version && fs.existsSync(frontendPkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
                        if (pkg.version && pkg.version !== '0.0.0') {
                            item.version = pkg.version;
                        }
                    } catch (e) {}
                }
            }
        }

        if (!item.version && item.url) {
            for (const file of metaFiles) {
                try {
                    const url = `${item.url.replace(/\/$/, '')}/${file}`;
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        const version = data.version ||
                            (data.info && data.info.version) ||
                            data.appVersion;
                        if (version) {
                            item.version = version;
                            console.log(`  Found version (${file}): ${version}`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        // 2. Resolve & Bundle Icon locally into dist/icons/
        item.icon = null;
        let localIconFound = null;

        if (repoDir && fs.existsSync(repoDir)) {
            const searchLocations = [
                path.join(repoDir, 'public'),
                path.join(repoDir, 'frontend/public'),
                path.join(repoDir, 'dist'),
                path.join(repoDir, 'frontend/dist'),
                repoDir
            ];
            for (const iconPath of iconPaths) {
                for (const loc of searchLocations) {
                    const fullIconPath = path.join(loc, iconPath);
                    if (fs.existsSync(fullIconPath)) {
                        localIconFound = fullIconPath;
                        console.log(`  Found icon locally: ${iconPath} at ${fullIconPath}`);
                        break;
                    }
                }
                if (localIconFound) break;
            }
        }

        if (localIconFound) {
            const ext = path.extname(localIconFound) || '.png';
            const destFilename = `${item.id}${ext}`;
            const destPath = path.join(ICONS_DIR, destFilename);
            fs.copyFileSync(localIconFound, destPath);
            item.icon = `icons/${destFilename}`;
            console.log(`  Bundled icon to: ${item.icon}`);
        } else if (item.url) {
            // Remote download fallback
            for (const iconPath of iconPaths) {
                try {
                    const iconUrl = `${item.url.replace(/\/$/, '')}/${iconPath}`;
                    const response = await fetch(iconUrl, { method: 'GET' });
                    if (response.ok) {
                        const contentType = response.headers.get('content-type') || '';
                        if (contentType.includes('image') || contentType.includes('svg')) {
                            const buffer = Buffer.from(await response.arrayBuffer());
                            const ext = path.extname(iconPath) || (contentType.includes('svg') ? '.svg' : '.png');
                            const destFilename = `${item.id}${ext}`;
                            const destPath = path.join(ICONS_DIR, destFilename);
                            fs.writeFileSync(destPath, buffer);
                            item.icon = `icons/${destFilename}`;
                            console.log(`  Downloaded and bundled remote icon: ${item.icon}`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        // Fallback default icon if none found
        if (!item.icon) {
            item.icon = 'favicon.ico';
        }

        updatedApps.push(item);
    }

    fs.writeFileSync(APPS_FILE, JSON.stringify(updatedApps, null, 2));
    console.log(`Updated apps.json successfully with ${updatedApps.length} apps.`);
}

updateMetadata().catch(console.error);
