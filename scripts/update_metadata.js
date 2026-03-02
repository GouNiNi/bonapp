const fs = require('fs');
const path = require('path');

const APPS_FILE = path.join(__dirname, '../dist/apps.json');

async function updateMetadata() {
    let apps = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));

    const iconPaths = [
        'app-icon.svg',
        'apple-touch-icon.png',
        'icons/icon-512x512.png',
        'favicon.svg',
        'favicon.ico'
    ];

    const metaFiles = ['version.json', 'package.json', 'manifest.json', 'manifest.webmanifest'];

    for (let app of apps) {
        console.log(`Checking ${app.name} (${app.url})...`);

        // Fetch Icon
        app.icon = null;
        for (const iconPath of iconPaths) {
            try {
                const iconUrl = `${app.url}${iconPath}`;
                const response = await fetch(iconUrl, { method: 'HEAD' });
                if (response.ok) {
                    app.icon = iconUrl;
                    console.log(`  Found icon: ${iconUrl}`);
                    break;
                }
            } catch (e) {
                // Ignore errors
            }
        }

        // Fetch Version
        app.version = null;
        for (const file of metaFiles) {
            try {
                const url = `${app.url}${file}`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const version = data.version ||
                        (data.info && data.info.version) ||
                        data.appVersion;
                    if (version) {
                        app.version = version;
                        console.log(`  Found version (${file}): ${version}`);
                        break;
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
    }

    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
    console.log('Updated apps.json successfully.');
}

updateMetadata().catch(console.error);
