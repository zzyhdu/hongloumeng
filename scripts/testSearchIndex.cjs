const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOURCE_DIR = path.join(ROOT, 'resource');
const CATALOG_PATH = path.join(RESOURCE_DIR, 'catalog.json');
const INDEX_DIR = path.join(RESOURCE_DIR, 'search-index');
const REQUIRED_ENTRY_FIELDS = [
  'id',
  'versionId',
  'chapterId',
  'chapterTitle',
  'chapterOrder',
  'blockIndex',
  'blockType',
  'scope',
  'text',
  'normalizedText',
];
const NOTE_SCOPES = new Set(['annotation', 'footnote']);

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseKeywords(query) {
  return query
    .trim()
    .split(/\s+/)
    .map(normalizeText)
    .filter(Boolean);
}

function searchEntries(entries, query, { includeNotes = false, limit = 200 } = {}) {
  const keywords = parseKeywords(query);
  if (!keywords.length) return [];

  const results = [];
  for (const entry of entries) {
    if (!includeNotes && NOTE_SCOPES.has(entry.scope)) continue;
    if (!keywords.every((keyword) => entry.normalizedText.includes(keyword))) continue;
    results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}

function assertIndexShape(catalog, version, indexFile) {
  assert.strictEqual(indexFile.versionId, version.id);
  assert.strictEqual(indexFile.versionName, version.name);
  assert.strictEqual(indexFile.chapterCount, version.chapterCount);
  assert.ok(Array.isArray(indexFile.entries), `${version.id} entries should be an array`);
  assert.ok(indexFile.entries.length > 0, `${version.id} should have entries`);

  const chapterMap = new Map(version.chapters.map((chapter, order) => [chapter.id, { chapter, order }]));
  const chapterBlockCounts = new Map();

  for (const chapter of version.chapters) {
    const chapterPath = path.join(RESOURCE_DIR, version.id, chapter.file);
    const chapterData = readJSON(chapterPath);
    chapterBlockCounts.set(chapter.id, chapterData.blocks.length);
  }

  for (const entry of indexFile.entries) {
    for (const field of REQUIRED_ENTRY_FIELDS) {
      assert.ok(Object.prototype.hasOwnProperty.call(entry, field), `${entry.id || version.id} missing ${field}`);
    }

    const chapterInfo = chapterMap.get(entry.chapterId);
    assert.ok(chapterInfo, `${entry.id} references unknown chapter`);
    assert.strictEqual(entry.versionId, version.id);
    assert.strictEqual(entry.chapterTitle, chapterInfo.chapter.title);
    assert.strictEqual(entry.chapterOrder, chapterInfo.order);
    assert.ok(entry.blockIndex >= 0, `${entry.id} has invalid blockIndex`);
    assert.ok(entry.blockIndex < chapterBlockCounts.get(entry.chapterId), `${entry.id} blockIndex out of range`);
    assert.strictEqual(entry.normalizedText, normalizeText(entry.text), `${entry.id} normalizedText mismatch`);
  }
}

function assertSearchBehavior(indexFile) {
  const daiyu = searchEntries(indexFile.entries, '黛玉');
  assert.ok(daiyu.length > 0, `${indexFile.versionId} should find 黛玉`);
  assert.ok(daiyu.every((entry) => !NOTE_SCOPES.has(entry.scope)), 'default search should exclude notes');

  const baoyuDaiyu = searchEntries(indexFile.entries, '宝玉 黛玉');
  assert.ok(baoyuDaiyu.length > 0, `${indexFile.versionId} should find 宝玉 黛玉`);
  assert.ok(
    baoyuDaiyu.every((entry) => entry.normalizedText.includes('宝玉') && entry.normalizedText.includes('黛玉')),
    'multi-keyword search should require all keywords'
  );

  const limited = searchEntries(indexFile.entries, '宝玉', { limit: 3 });
  assert.ok(limited.length <= 3, 'search should respect limit');

  if (indexFile.versionId === 'zhiping_4color') {
    const crossSpanPhrase = searchEntries(indexFile.entries, '是总其全部之名也', { includeNotes: true });
    assert.ok(
      crossSpanPhrase.some((entry) => entry.chapterId === '000' && entry.blockIndex === 1),
      'search should match phrases split across adjacent spans'
    );
  }

  const noteEntry = indexFile.entries.find((entry) => NOTE_SCOPES.has(entry.scope) && entry.text.length >= 2);
  if (noteEntry) {
    const keyword = noteEntry.text.slice(0, Math.min(4, noteEntry.text.length));
    const withNotes = searchEntries(indexFile.entries, keyword, { includeNotes: true, limit: 200 });
    assert.ok(
      withNotes.some((entry) => entry.id === noteEntry.id),
      `${indexFile.versionId} should find note entries when includeNotes is true`
    );
  }
}

function main() {
  const catalog = readJSON(CATALOG_PATH);
  assert.ok(Array.isArray(catalog.versions) && catalog.versions.length > 0, 'catalog should have versions');

  for (const version of catalog.versions) {
    const indexPath = path.join(INDEX_DIR, `${version.id}.json`);
    assert.ok(fs.existsSync(indexPath), `missing index file: ${indexPath}`);
    const indexFile = readJSON(indexPath);
    assertIndexShape(catalog, version, indexFile);
    assertSearchBehavior(indexFile);
  }

  console.log('搜索索引测试通过');
}

main();
