const fs = require('fs');
const path = require('path');
const os = require('os');

// Replicate the exact logic from the app
const APP_DATA_DIR = path.join(os.homedir(), '.dalton-cli');
const configPath = path.join(APP_DATA_DIR, 'config.json');

console.log('=== PATH DEBUGGING ===\n');
console.log('os.homedir():', os.homedir());
console.log('APP_DATA_DIR:', APP_DATA_DIR);
console.log('configPath:', configPath);
console.log('');

// Ensure APP_DATA_DIR exists
if (!fs.existsSync(APP_DATA_DIR)) {
    console.log('Creating APP_DATA_DIR...');
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

// Test normalization
console.log('=== NORMALIZATION TEST ===');
const normalizedConfigPath = path.normalize(configPath);
const normalizedAppDataDir = path.normalize(APP_DATA_DIR);
console.log('normalizedConfigPath:', normalizedConfigPath);
console.log('normalizedAppDataDir:', normalizedAppDataDir);
console.log('');

// Test parent directory comparison
const parentDir = path.dirname(normalizedConfigPath);
console.log('=== PARENT DIRECTORY TEST ===');
console.log('parentDir:', parentDir);
console.log('normalizedAppDataDir:', normalizedAppDataDir);
console.log('Are they equal? (===):', parentDir === normalizedAppDataDir);
console.log('');

// Test with realpath if directory exists
if (fs.existsSync(APP_DATA_DIR)) {
    console.log('=== REALPATH TEST ===');
    const appDataDirResolved = fs.realpathSync(APP_DATA_DIR);
    console.log('APP_DATA_DIR realpath:', appDataDirResolved);

    // Test what would happen with config file path
    if (fs.existsSync(configPath)) {
        const configResolved = fs.realpathSync(configPath);
        console.log('configPath realpath:', configResolved);
        console.log('Does config start with APP_DATA_DIR?', configResolved.startsWith(appDataDirResolved));
    } else {
        console.log('Config file does not exist yet');
    }
}

// Additional Windows-specific tests
console.log('\n=== WINDOWS-SPECIFIC TESTS ===');
console.log('path.sep:', path.sep);
console.log('Using backslashes:', configPath.includes('\\'));
console.log('Using forward slashes:', configPath.includes('/'));

// Test case sensitivity
console.log('\n=== CASE SENSITIVITY TEST ===');
const upperParentDir = parentDir.toUpperCase();
const upperAppDataDir = normalizedAppDataDir.toUpperCase();
console.log('parentDir (upper):', upperParentDir);
console.log('normalizedAppDataDir (upper):', upperAppDataDir);
console.log('Are they equal (case-insensitive)?', upperParentDir === upperAppDataDir);

// Test with different path construction methods
console.log('\n=== ALTERNATIVE PATH CONSTRUCTION ===');
const altConfigPath = path.resolve(APP_DATA_DIR, 'config.json');
const altParentDir = path.dirname(altConfigPath);
console.log('altConfigPath:', altConfigPath);
console.log('altParentDir:', altParentDir);
console.log('altParentDir === APP_DATA_DIR?', altParentDir === APP_DATA_DIR);
console.log('altParentDir === normalizedAppDataDir?', altParentDir === normalizedAppDataDir);

// Test raw string comparison
console.log('\n=== RAW STRING COMPARISON ===');
console.log('parentDir bytes:', Buffer.from(parentDir).toString('hex'));
console.log('normalizedAppDataDir bytes:', Buffer.from(normalizedAppDataDir).toString('hex'));