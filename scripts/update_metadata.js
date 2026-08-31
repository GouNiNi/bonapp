const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../apps.config.json');
const APPS_FILE = path.join(__dirname, '../dist/apps.json');

async function updateMetadata() {
    let appDeclarations = [];
    if (fs.existsSync(CONFIG_FILE)) {
        appDeclarations = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } else if (fs.existsSync(APPS_FILE)) {
        appDeclarations = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    }

    // Sort alphabetically by app name
    appDeclarations.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    const iconPaths = [
        'app-icon.svg',
        'pwa-192x192.png',
        'icons/icon-192x192.png',
        'icon-192.png',
        'pwa-512x512.png',
        'icon-512.png',
        'apple-touch-icon.png',
        'icons/icon-512x512.png',
        'favicon.svg',
        'favicon.png',
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

        // 2. Resolve Icon (local verification or standard path probe)
        item.icon = null;
        if (repoDir && fs.existsSync(repoDir)) {
            const searchLocations = [
                path.join(repoDir, 'public'),
                path.join(repoDir, 'frontend/public'),
                path.join(repoDir, 'dist'),
                repoDir
            ];
            for (const iconPath of iconPaths) {
                for (const loc of searchLocations) {
                    const fullIconPath = path.join(loc, iconPath);
                    if (fs.existsSync(fullIconPath)) {
                        item.icon = `${item.url.replace(/\/$/, '')}/${iconPath}`;
                        console.log(`  Found icon locally: ${iconPath} -> ${item.icon}`);
                        break;
                    }
                }
                if (item.icon) break;
            }
        }

        if (!item.icon && item.url) {
            for (const iconPath of iconPaths) {
                try {
                    const iconUrl = `${item.url.replace(/\/$/, '')}/${iconPath}`;
                    const response = await fetch(iconUrl, { method: 'GET' });
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && (contentType.includes('image') || contentType.includes('svg'))) {
                            item.icon = iconUrl;
                            console.log(`  Found icon remotely: ${iconUrl} (${contentType})`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        // Fallback default icon if none found
        if (!item.icon && item.url) {
            item.icon = `${item.url.replace(/\/$/, '')}/favicon.ico`;
        }

        updatedApps.push(item);
    }

    fs.writeFileSync(APPS_FILE, JSON.stringify(updatedApps, null, 2));
    console.log(`Updated apps.json successfully with ${updatedApps.length} apps.`);
}

updateMetadata().catch(console.error);
