const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOURCE_DIR = path.join(ROOT, 'resource');
const CATALOG_PATH = path.join(RESOURCE_DIR, 'catalog.json');
const OUTPUT_DIR = path.join(RESOURCE_DIR, 'search-index');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(text) {
  return cleanText(text).toLowerCase();
}

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

function joinInlineParts(parts) {
  return cleanText(parts.filter(Boolean).join(''));
}

function joinSeparatedParts(parts) {
  return cleanText(parts.filter(Boolean).join(' '));
}

function textFromSpan(span, context) {
  switch (span.type) {
    case 'text':
      return span.content || '';
    case 'annotation':
      return span.content || '';
    case 'correction':
      return span.inserted || span.deleted || '';
    case 'footnote_ref':
      return '';
    default:
      throw new Error(`未知 span 类型：${span.type} (${context})`);
  }
}

function collectSpanText(spans, context) {
  const readableParts = [];
  const annotationParts = [];
  const allParts = [];

  for (const span of spans || []) {
    const text = textFromSpan(span, context);
    allParts.push(text);

    if (span.type === 'annotation') {
      annotationParts.push(text);
    } else {
      readableParts.push(text);
    }
  }

  return {
    readableText: joinInlineParts(readableParts),
    annotationText: joinInlineParts(annotationParts),
    allText: joinInlineParts(allParts),
  };
}

function addEntry(entries, {
  versionId,
  chapterId,
  chapterTitle,
  chapterOrder,
  blockIndex,
  blockType,
  scope,
  text,
  sequence,
}) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return;

  entries.push({
    id: `${versionId}:${chapterId}:${blockIndex}:${scope}:${sequence}`,
    versionId,
    chapterId,
    chapterTitle,
    chapterOrder,
    blockIndex,
    blockType,
    scope,
    text: cleanText(text),
    normalizedText,
  });
}

function entriesFromBlock({ versionId, chapterId, chapterTitle, chapterOrder, block, blockIndex }) {
  const entries = [];
  const base = {
    versionId,
    chapterId,
    chapterTitle,
    chapterOrder,
    blockIndex,
    blockType: block.type,
  };

  switch (block.type) {
    case 'heading':
      addEntry(entries, { ...base, scope: 'title', text: block.text || '', sequence: 0 });
      break;

    case 'paragraph': {
      const { readableText, annotationText } = collectSpanText(
        block.spans,
        `${versionId}/${chapterId} block ${blockIndex}`
      );
      addEntry(entries, { ...base, scope: 'body', text: readableText, sequence: 0 });
      addEntry(entries, { ...base, scope: 'annotation', text: annotationText, sequence: 1 });
      break;
    }

    case 'poetry': {
      const poetryParts = [];
      const annotationParts = [];
      for (const [lineIndex, line] of (block.lines || []).entries()) {
        const { readableText, annotationText } = collectSpanText(
          line,
          `${versionId}/${chapterId} block ${blockIndex} line ${lineIndex}`
        );
        poetryParts.push(readableText);
        annotationParts.push(annotationText);
      }
      addEntry(entries, { ...base, scope: 'poetry', text: joinSeparatedParts(poetryParts), sequence: 0 });
      addEntry(entries, { ...base, scope: 'annotation', text: joinSeparatedParts(annotationParts), sequence: 1 });
      break;
    }

    case 'annotation_block': {
      const { allText } = collectSpanText(
        block.spans,
        `${versionId}/${chapterId} block ${blockIndex}`
      );
      addEntry(entries, {
        ...base,
        scope: 'annotation',
        text: allText,
        sequence: 0,
      });
      break;
    }

    case 'footnote': {
      const { allText } = collectSpanText(
        block.spans,
        `${versionId}/${chapterId} block ${blockIndex}`
      );
      addEntry(entries, {
        ...base,
        scope: 'footnote',
        text: allText,
        sequence: 0,
      });
      break;
    }

    default:
      throw new Error(`未知 block 类型：${block.type} (${versionId}/${chapterId} block ${blockIndex})`);
  }

  return entries;
}

function buildVersionIndex(version) {
  const entries = [];

  for (const [chapterOrder, chapter] of version.chapters.entries()) {
    const chapterPath = path.join(RESOURCE_DIR, version.id, chapter.file);
    if (!fs.existsSync(chapterPath)) {
      throw new Error(`章节文件不存在：${chapterPath}`);
    }

    const chapterData = readJSON(chapterPath);
    if (!Array.isArray(chapterData.blocks)) {
      throw new Error(`章节缺少 blocks：${chapterPath}`);
    }

    for (const [blockIndex, block] of chapterData.blocks.entries()) {
      entries.push(...entriesFromBlock({
        versionId: version.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterOrder,
        block,
        blockIndex,
      }));
    }
  }

  if (!entries.length) {
    throw new Error(`版本索引为空：${version.id}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    versionId: version.id,
    versionName: version.name,
    chapterCount: version.chapterCount,
    entries,
  };
}

function main() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`目录文件不存在，请先生成 catalog：${CATALOG_PATH}`);
  }

  const catalog = readJSON(CATALOG_PATH);
  if (!Array.isArray(catalog.versions) || !catalog.versions.length) {
    throw new Error('catalog.json 中没有可用版本');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const version of catalog.versions) {
    const indexFile = buildVersionIndex(version);
    const outputPath = path.join(OUTPUT_DIR, `${version.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(indexFile), 'utf8');
    console.log(`已生成搜索索引：${outputPath} (${indexFile.entries.length} 条)`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
