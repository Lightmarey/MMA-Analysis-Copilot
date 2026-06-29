const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(distDir, 'release');
const platform = process.platform;
const nodeExeName = platform === 'win32' ? 'node.exe' : 'node';
const outputName = platform === 'win32' ? 'math-copilot.exe' : 'math-copilot';
const outputPath = path.join(distDir, outputName);
const releaseOutputPath = path.join(releaseDir, outputName);
const nodeExePath = process.execPath;

console.log('Building TypeScript bundle with esbuild...');
execSync('npx esbuild src/cli/main.ts --bundle --platform=node --format=esm --target=node20 --outfile=dist/bundle.js', { stdio: 'inherit', cwd: rootDir });

console.log('Generating SEA blob...');
execSync(`node --experimental-sea-config scripts/sea-config.json`, { stdio: 'inherit', cwd: rootDir });

console.log(`Copying Node.js binary to ${outputPath}...`);
fs.copyFileSync(nodeExePath, outputPath);

console.log('Injecting SEA blob...');
execSync(`npx postject "${outputPath}" NODE_SEA_BLOB "dist/sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit', cwd: rootDir });

console.log('Preparing release runtime assets...');
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(path.join(releaseDir, 'wolfram'), { recursive: true });
fs.copyFileSync(outputPath, releaseOutputPath);
for (const file of ['protocol.wl', 'worker.wls']) {
  fs.copyFileSync(path.join(rootDir, 'wolfram', file), path.join(releaseDir, 'wolfram', file));
}
fs.writeFileSync(path.join(releaseDir, 'wma.config.example.json'), `${JSON.stringify({
  wolfram: {
    formulaTransformEnginePath: '../FormulaTransformEngine',
    backendMode: 'worker'
  },
  openai: {
    model: 'gpt-4.1-mini'
  }
}, null, 2)}\n`);

console.log('Build completed! Release bundle is at:', releaseDir);
