const fs = require('fs');
const path = require('path');

// Create node_modules polyfills for Node.js built-in modules
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

function createModule(name, mainPath) {
  const modulePath = path.join(nodeModulesPath, name);
  const packageJsonPath = path.join(modulePath, 'package.json');
  
  // Skip if package already exists as a real npm package (has a valid package.json with a main field pointing to a real file)
  if (fs.existsSync(packageJsonPath)) {
    try {
      const existingPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      // If it's a real package (not our stub), skip it
      if (existingPackage.main && fs.existsSync(path.join(modulePath, existingPackage.main))) {
        console.log(`  Skipping ${name} - already exists as real package`);
        return;
      }
    } catch (e) {
      // If we can't parse it, overwrite it
    }
  }
  
  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
  }
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({
      name: name,
      version: '1.0.0',
      main: mainPath,
      type: 'commonjs'
    }, null, 2)
  );
}

// Create crypto module (points to crypto-browserify)
createModule('crypto', '../crypto-browserify');

// Create stream module (points to stream-browserify)
createModule('stream', '../stream-browserify');

// Note: events package already exists as a real npm package, so we don't need to create a stub

// Create fs module stub
const fsPath = path.join(nodeModulesPath, 'fs');
if (!fs.existsSync(fsPath)) {
  fs.mkdirSync(fsPath, { recursive: true });
}

const fsStubContent = `
const fsStub = {
  readFileSync: () => { throw new Error('fs.readFileSync is not available in browser'); },
  writeFileSync: () => { throw new Error('fs.writeFileSync is not available in browser'); },
  existsSync: () => false,
  mkdirSync: () => { throw new Error('fs.mkdirSync is not available in browser'); },
  readdirSync: () => [],
  statSync: () => ({ isFile: () => false, isDirectory: () => false }),
  createReadStream: () => { throw new Error('fs.createReadStream is not available in browser'); },
  createWriteStream: () => { throw new Error('fs.createWriteStream is not available in browser'); },
  promises: {
    readFile: () => Promise.reject(new Error('fs.promises.readFile is not available in browser')),
    writeFile: () => Promise.reject(new Error('fs.promises.writeFile is not available in browser')),
  }
};

module.exports = fsStub;
module.exports.readFileSync = fsStub.readFileSync;
module.exports.writeFileSync = fsStub.writeFileSync;
module.exports.existsSync = fsStub.existsSync;
module.exports.mkdirSync = fsStub.mkdirSync;
module.exports.readdirSync = fsStub.readdirSync;
module.exports.statSync = fsStub.statSync;
module.exports.createReadStream = fsStub.createReadStream;
module.exports.createWriteStream = fsStub.createWriteStream;
module.exports.promises = fsStub.promises;
`;

fs.writeFileSync(path.join(fsPath, 'index.js'), fsStubContent);
fs.writeFileSync(
  path.join(fsPath, 'package.json'),
  JSON.stringify({
    name: 'fs',
    version: '1.0.0',
    main: 'index.js',
    type: 'commonjs'
  }, null, 2)
);

console.log('✓ Created crypto, stream, and fs polyfill modules in node_modules');

