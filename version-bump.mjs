// Keeps manifest.json and versions.json in step with package.json.
// Run through `npm version <x.y.z>`, which calls it before tagging.
import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// versions.json maps every released plugin version to the oldest Obsidian it
// runs on, so the app can offer the right build to an older install.
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
