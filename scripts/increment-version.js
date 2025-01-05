const fs = require('fs');
const path = require('path');

// Read version from version.json
const versionPath = path.join(__dirname, '..', 'src', 'version.json');
const packagePath = path.join(__dirname, '..', 'package.json');

try {
    // Read current version
    const versionFile = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const packageFile = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Split version into parts
    const [major, minor, patch] = versionFile.version.split('.').map(Number);
    
    // Increment patch version
    const newVersion = `${major}.${minor}.${patch + 1}`;
    
    // Update version.json
    versionFile.version = newVersion;
    fs.writeFileSync(versionPath, JSON.stringify(versionFile, null, 2) + '\n');
    
    // Update package.json
    packageFile.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageFile, null, 2) + '\n');
    
    console.log(`Version incremented to ${newVersion}`);
    process.exit(0);
} catch (error) {
    console.error('Error incrementing version:', error);
    process.exit(1);
}
