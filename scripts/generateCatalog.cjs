const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOURCE_DIR = path.join(ROOT, 'resource');

const VERSION_META = {
  zhiping_4color: {
    id: 'zhiping_4color',
    name: '抚琴居脂评汇校八十回',
    description: '红楼梦脂评汇校本，以甲戌本、庚辰本为底本，汇集各脂本批注',
  },
  rm120: {
    id: 'rm120',
    name: '人民文学出版社一百二十回',
    description: '中国艺术研究院红楼梦研究所校注本（前八十回庚辰本，后四十回程甲本）',
  },
};

function readFirstHeading(filePath) {
  if (filePath.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.title || path.basename(filePath);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      let title = trimmed.replace(/^#+\s*/, '').trim();
      // Remove any HTML tags that might have been captured (e.g. annotations)
      title = title.replace(/<[^>]+>/g, '').trim();
      return title;
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
      .filter((file) =>
        (file.endsWith('.md') || file.endsWith('.json')) &&
        !file.includes('_raw') &&
        !file.includes('_paras') &&
        !file.includes('_blocks') &&
        !file.includes('_flat')
      )
      .sort((a, b) => {
        // Put front matter before numbered chapters
        if (a.startsWith('front')) return -1;
        if (b.startsWith('front')) return 1;
        return a.localeCompare(b);
      });
    const chapters = files.map((file) => {
      const chapterId = file.replace(/\.(md|json)$/, '');
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
