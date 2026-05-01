const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'resource');
const DEST = path.join(ROOT, 'public', 'resource');

if (!fs.existsSync(SOURCE)) {
  console.error(`资源目录不存在：${SOURCE}`);
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.cpSync(SOURCE, DEST, { recursive: true });
console.log(`已同步资源到 ${DEST}`);
