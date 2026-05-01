const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOURCE_DIR = path.join(ROOT, 'resource');

const VERSION_META = {
  zp80: {
    id: 'zp80',
    name: '脂评八十回',
    description: '脂评本（甲戌本、庚辰本、蒙府本）八十回',
  },
  rm120: {
    id: 'rm120',
    name: '人民文学出版社一百二十回',
    description: '中国艺术研究院红楼梦研究所校注本（前八十回庚辰本，后四十回程甲本）',
  },
};

function readFirstHeading(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('###')) {
      return trimmed.replace(/^#+\s*/, '').trim();
    }
  }
  return path.basename(filePath);
}

function buildCatalog() {
  const versions = [];
  for (const [dirName, meta] of Object.entries(VERSION_META)) {
    const dirPath = path.join(RESOURCE_DIR, dirName);
    if (!fs.existsSync(dirPath)) {
      console.warn(`目录不存在，跳过：${dirPath}`);
      continue;
    }
    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.md'))
      .sort();
    const chapters = files.map((file) => {
      const chapterId = file.replace('.md', '');
      const title = readFirstHeading(path.join(dirPath, file));
      return {
        id: chapterId,
        title,
        file: file,
      };
    });
    versions.push({
      ...meta,
      chapters,
      chapterCount: chapters.length,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    versions,
  };
}

function main() {
  const catalog = buildCatalog();
  const outputPath = path.join(RESOURCE_DIR, 'catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`已生成章节目录：${outputPath}`);
}

main();
