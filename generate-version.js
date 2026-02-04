#!/usr/bin/env node

/**
 * Auto-generate version for service worker cache busting
 * Runs before deployment to update CACHE_VERSION with current timestamp
 */

const fs = require('fs');
const path = require('path');

const SERVICE_WORKER_PATH = path.join(__dirname, 'service-worker.js');

// Generate version based on current timestamp (YYYYMMDD-HHMM format)
const now = new Date();
const version = `v${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

console.log(`🔄 Generating new cache version: ${version}`);

// Read service worker file
let content = fs.readFileSync(SERVICE_WORKER_PATH, 'utf8');

// Replace the CACHE_VERSION line
content = content.replace(
  /const CACHE_VERSION = ['"][^'"]+['"];/,
  `const CACHE_VERSION = '${version}';`
);

// Write back
fs.writeFileSync(SERVICE_WORKER_PATH, content, 'utf8');

console.log(`✅ Updated service-worker.js with version: ${version}`);
console.log(`   Users will be notified to reload on next visit`);
