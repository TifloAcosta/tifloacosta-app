function cleanText(value='') {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function xmlDoc(source='') {
  return new DOMParser().parseFromString(String(source || ''), 'application/xml');
}

function nodes(root, localName) {
  return [...(root?.getElementsByTagNameNS?.('*', localName) || [])];
}

function first(root, localName) {
  return nodes(root, localName)[0] || null;
}

function attr(node, localName) {
  if (!node) return '';
  return node.getAttribute?.(localName)
    || node.getAttributeNS?.('http://schemas.openxmlformats.org/officeDocument/2006/relationships', localName)
    || [...(node.attributes || [])].find(item => item.localName === localName)?.value
    || '';
}

function normalizePath(path='') {
  const parts = [];
  for (const raw of String(path).replace(/\\/g,'/').split('/')) {
    if (!raw || raw === '.') continue;
    if (raw === '..') parts.pop();
    else parts.push(raw);
  }
  return parts.join('/');
}

function resolvePart(basePart, target) {
  if (!target) return '';
  if (target.startsWith('/')) return normalizePath(target.slice(1));
  const base = String(basePart).includes('/') ? String(basePart).slice(0, String(basePart).lastIndexOf('/') + 1) : '';
  return normalizePath(base + target);
}

function relationshipMap(xml, basePart) {
  const map = new Map();
  if (!xml) return map;
  const doc = xmlDoc(xml);
  for (const rel of nodes(doc, 'Relationship')) {
    const id = rel.getAttribute('Id') || '';
    const target = rel.getAttribute('Target') || '';
    if (id && target) map.set(id, resolvePart(basePart, target));
  }
  return map;
}

async function optionalText(zip, path) {
  const file = zip.file(path);
  return file ? file.async('string').catch(() => '') : '';
}

function coreMetadata(coreXml, options={}) {
  const doc = coreXml ? xmlDoc(coreXml) : null;
  return {
    title: cleanText(first(doc, 'title')?.textContent) || String(options.title || ''),
    author: cleanText(first(doc, 'creator')?.textContent),
    language: String(options.language || '')
  };
}

function localCopy(language='') {
  const es = !String(language).toLowerCase().startsWith('en');
  return es ? {
    slide:(n,total,title)=> title ? `Diapositiva ${n} de ${total}: ${title}` : `Diapositiva ${n} de ${total}`,
    notes:'Notas del presentador',
    image:'Descripción de imagen',
    imageMissing:'Imagen sin descripción disponible',
    table:(r,c)=>`Tabla de ${r} filas y ${c} columnas`,
    row:n=>`Fila ${n}`,
    col:n=>`Columna ${n}`,
    sheet:name=>`Hoja: ${name}`,
    headers:'Encabezados',
    formula:'Fórmula',
    empty:'vacío'
  } : {
    slide:(n,total,title)=> title ? `Slide ${n} of ${total}: ${title}` : `Slide ${n} of ${total}`,
    notes:'Speaker notes',
    image:'Image description',
    imageMissing:'Image without an available description',
    table:(r,c)=>`Table with ${r} rows and ${c} columns`,
    row:n=>`Row ${n}`,
    col:n=>`Column ${n}`,
    sheet:name=>`Sheet: ${name}`,
    headers:'Headers',
    formula:'Formula',
    empty:'blank'
  };
}

function textRuns(root) {
  return cleanText(nodes(root, 't').map(node => node.textContent || '').join(' '));
}

function shapeText(shape) {
  return cleanText(nodes(shape, 'p').map(p => textRuns(p)).filter(Boolean).join('\n'));
}

function shapePlaceholderType(shape) {
  const ph = first(shape, 'ph');
  return ph ? (attr(ph, 'type') || 'body') : '';
}

function slideTables(doc, copy, prefix, startIndex=0) {
  const blocks = [];
  let index = startIndex;
  let tableNumber = 0;
  for (const table of nodes(doc, 'tbl')) {
    tableNumber++;
    const rows = nodes(table, 'tr');
    const colCount = rows.reduce((max,row)=>Math.max(max, nodes(row,'tc').length),0);
    blocks.push({ id:`${prefix}-${++index}`, type:'paragraph', text:copy.table(rows.length, colCount) });
    rows.forEach((row, rowIndex) => {
      const values = nodes(row, 'tc').map((cell, colIndex) => {
        const value = textRuns(cell);
        return value ? `${copy.col(colIndex + 1)}: ${value}` : '';
      }).filter(Boolean);
      if (values.length) blocks.push({
        id:`${prefix}-${++index}`,
        type:'table-cell',
        text:`${copy.row(rowIndex + 1)}. ${values.join('. ')}`
      });
    });
  }
  return { blocks, index };
}

function slideContent(slideXml, { slideNumber, slideCount, language }) {
  const doc = xmlDoc(slideXml);
  const copy = localCopy(language);
  const shapes = nodes(doc, 'sp');
  let title = '';
  const body = [];
  const images = [];

  for (const shape of shapes) {
    const text = shapeText(shape);
    const type = shapePlaceholderType(shape);
    if (!text) continue;
    if (!title && (type === 'title' || type === 'ctrTitle')) title = text;
    else body.push(text);
  }

  for (const pic of nodes(doc, 'pic')) {
    const props = nodes(pic, 'cNvPr')[0];
    const description = cleanText(props?.getAttribute?.('descr') || props?.getAttribute?.('title') || '');
    images.push(description || copy.imageMissing);
  }

  const blocks = [];
  if (title) {
    blocks.push({
      id:`pptx-slide-${slideNumber}`,
      type:'heading',
      level:2,
      text:title
    });
  }
  let index = 0;
  for (const text of body) {
    for (const paragraph of text.split(/\n+/).map(cleanText).filter(Boolean)) {
      blocks.push({ id:`pptx-${slideNumber}-${++index}`, type:'paragraph', text:paragraph });
    }
  }
  const tableResult = slideTables(doc, copy, `pptx-${slideNumber}`, index);
  blocks.push(...tableResult.blocks);
  index = tableResult.index;
  for (const description of images) {
    blocks.push({
      id:`pptx-${slideNumber}-${++index}`,
      type:'paragraph',
      text: description === copy.imageMissing ? description : `${copy.image}: ${description}`
    });
  }
  return { blocks, title };
}

function noteBlocks(notesXml, { slideNumber, language, startIndex=0 }) {
  if (!notesXml) return [];
  const doc = xmlDoc(notesXml);
  const copy = localCopy(language);
  const texts = [];
  for (const shape of nodes(doc, 'sp')) {
    const type = shapePlaceholderType(shape);
    if (['sldImg','dt','ftr','hdr','sldNum'].includes(type)) continue;
    const text = shapeText(shape);
    if (text) texts.push(text);
  }
  if (!texts.length) return [];
  const blocks = [{
    id:`pptx-${slideNumber}-notes`,
    type:'heading',
    level:3,
    text:copy.notes
  }];
  let index = startIndex;
  for (const text of texts) {
    for (const paragraph of text.split(/\n+/).map(cleanText).filter(Boolean)) {
      blocks.push({ id:`pptx-${slideNumber}-note-${++index}`, type:'paragraph', text:paragraph });
    }
  }
  return blocks;
}

function numericSuffix(path, prefix) {
  const match = String(path).match(new RegExp(`${prefix}(\\d+)\\.xml$`));
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export async function parsePptxArchive(zip, options={}) {
  const presentationPath = 'ppt/presentation.xml';
  const presentation = zip.file(presentationPath);
  if (!presentation) throw Object.assign(new Error('invalid-pptx'), { code:'invalid-pptx' });

  const [presentationXml, relXml, coreXml] = await Promise.all([
    presentation.async('string'),
    optionalText(zip, 'ppt/_rels/presentation.xml.rels'),
    optionalText(zip, 'docProps/core.xml')
  ]);
  const meta = coreMetadata(coreXml, options);
  const rels = relationshipMap(relXml, presentationPath);
  const doc = xmlDoc(presentationXml);
  let slidePaths = nodes(doc, 'sldId').map(node => rels.get(attr(node, 'id'))).filter(Boolean);
  if (!slidePaths.length) {
    slidePaths = Object.keys(zip.files)
      .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a,b)=>numericSuffix(a,'slide')-numericSuffix(b,'slide'));
  }
  if (!slidePaths.length) throw Object.assign(new Error('invalid-pptx'), { code:'invalid-pptx' });

  const blocks = [];
  const navigation = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i];
    const slideFile = zip.file(path);
    if (!slideFile) continue;
    const slideXml = await slideFile.async('string');
    const parsed = slideContent(slideXml, { slideNumber:i+1, slideCount:slidePaths.length, language:meta.language });
    blocks.push(...parsed.blocks);
    navigation.push({
      label: parsed.title || localCopy(meta.language).slide(i+1, slidePaths.length, ''),
      href: `#pptx-slide-${i+1}`,
      level: 1
    });

    const relPath = path.replace(/\/([^/]+)$/, '/_rels/$1.rels');
    const slideRelXml = await optionalText(zip, relPath);
    const slideRels = relationshipMap(slideRelXml, path);
    const notesPath = [...slideRels.values()].find(value => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(value));
    if (notesPath) {
      const notesXml = await optionalText(zip, notesPath);
      blocks.push(...noteBlocks(notesXml, { slideNumber:i+1, language:meta.language }));
    }
  }

  if (!blocks.length) throw Object.assign(new Error('empty-pptx'), { code:'empty-pptx' });
  return { ...meta, blocks, navigation };
}

function columnName(index) {
  let n = Number(index);
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result || 'A';
}

function columnIndex(ref='') {
  const match = String(ref).toUpperCase().match(/^([A-Z]+)/);
  if (!match) return 1;
  let value = 0;
  for (const ch of match[1]) value = value * 26 + ch.charCodeAt(0) - 64;
  return value;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = xmlDoc(xml);
  return nodes(doc, 'si').map(si => cleanText(nodes(si,'t').map(t=>t.textContent || '').join(' ')));
}

function parseStyles(xml) {
  if (!xml) return { dateStyles:new Set() };
  const doc = xmlDoc(xml);
  const custom = new Map();
  for (const numFmt of nodes(doc,'numFmt')) {
    custom.set(Number(numFmt.getAttribute('numFmtId')), numFmt.getAttribute('formatCode') || '');
  }
  const dateIds = new Set([14,15,16,17,18,19,20,21,22,45,46,47]);
  const cellXfs = first(doc,'cellXfs');
  const dateStyles = new Set();
  const xfs = cellXfs ? [...cellXfs.childNodes].filter(n=>n.nodeType===1 && n.localName==='xf') : [];
  xfs.forEach((xf,index)=>{
    const id = Number(xf.getAttribute('numFmtId') || 0);
    const fmt = custom.get(id) || '';
    if (dateIds.has(id) || /(^|[^\\])[dmyhs]/i.test(fmt.replace(/"[^"]*"/g,''))) dateStyles.add(index);
  });
  return { dateStyles };
}

function excelDate(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value)) return '';
  const adjusted = value >= 60 ? value - 1 : value;
  const date = new Date(Date.UTC(1899,11,31) + adjusted * 86400000);
  if (Number.isNaN(date.getTime())) return '';
  const iso = date.toISOString();
  return value % 1 ? iso.slice(0,16).replace('T',' ') : iso.slice(0,10);
}

function cellValue(cell, sharedStrings, styles) {
  const type = cell.getAttribute('t') || '';
  const styleIndex = Number(cell.getAttribute('s') || -1);
  const value = cleanText(first(cell,'v')?.textContent || '');
  if (type === 'inlineStr') return cleanText(nodes(cell,'t').map(t=>t.textContent || '').join(' '));
  if (type === 's') return sharedStrings[Number(value)] ?? '';
  if (type === 'b') return value === '1' ? 'Sí' : 'No';
  if (type === 'str') return value;
  if (styles.dateStyles.has(styleIndex) && value) return excelDate(value) || value;
  return value;
}

function looksNumeric(value) {
  const text = String(value).trim();
  return text !== '' && Number.isFinite(Number(text.replace(',','.')));
}

function hasHeaderRow(rows) {
  if (rows.length < 2) return false;
  const firstRow = rows[0].cells.filter(cell=>cell.value !== '');
  if (firstRow.length < 2) return false;
  const textual = firstRow.filter(cell=>!looksNumeric(cell.value)).length;
  const nextValues = rows.slice(1,3).flatMap(row=>row.cells).filter(cell=>cell.value !== '');
  return textual / firstRow.length >= 0.6 && nextValues.length >= 2;
}

function parseSheetRows(xml, sharedStrings, styles) {
  const doc = xmlDoc(xml);
  const result = [];
  for (const row of nodes(doc,'row')) {
    const rowNumber = Number(row.getAttribute('r') || result.length + 1);
    const cells = [];
    for (const cell of [...row.childNodes].filter(n=>n.nodeType===1 && n.localName==='c')) {
      const ref = cell.getAttribute('r') || '';
      const col = columnIndex(ref);
      const formula = cleanText(first(cell,'f')?.textContent || '');
      const value = cellValue(cell, sharedStrings, styles);
      if (!value && !formula) continue;
      cells.push({ col, ref:ref || `${columnName(col)}${rowNumber}`, value, formula });
    }
    if (cells.length) result.push({ rowNumber, cells });
  }
  return result;
}

export async function parseXlsxArchive(zip, options={}) {
  const workbookPath = 'xl/workbook.xml';
  const workbook = zip.file(workbookPath);
  if (!workbook) throw Object.assign(new Error('invalid-xlsx'), { code:'invalid-xlsx' });

  const [workbookXml, relXml, sharedXml, stylesXml, coreXml] = await Promise.all([
    workbook.async('string'),
    optionalText(zip, 'xl/_rels/workbook.xml.rels'),
    optionalText(zip, 'xl/sharedStrings.xml'),
    optionalText(zip, 'xl/styles.xml'),
    optionalText(zip, 'docProps/core.xml')
  ]);
  const meta = coreMetadata(coreXml, options);
  const copy = localCopy(meta.language);
  const rels = relationshipMap(relXml, workbookPath);
  const sharedStrings = parseSharedStrings(sharedXml);
  const styles = parseStyles(stylesXml);
  const doc = xmlDoc(workbookXml);
  const blocks = [];
  const navigation = [];
  let globalIndex = 0;

  for (const sheet of nodes(doc,'sheet')) {
    const name = cleanText(sheet.getAttribute('name') || '') || `Sheet ${navigation.length + 1}`;
    const path = rels.get(attr(sheet,'id'));
    if (!path || !zip.file(path)) continue;
    const rows = parseSheetRows(await zip.file(path).async('string'), sharedStrings, styles);
    const anchor = `xlsx-sheet-${navigation.length + 1}`;
    blocks.push({ id:anchor, type:'heading', level:2, text:copy.sheet(name) });
    navigation.push({ label:name, href:`#${anchor}`, level:1 });
    if (!rows.length) {
      blocks.push({ id:`xlsx-${++globalIndex}`, type:'paragraph', text:copy.empty });
      continue;
    }

    const headerMode = hasHeaderRow(rows);
    const headers = new Map();
    if (headerMode) {
      for (const cell of rows[0].cells) headers.set(cell.col, cell.value);
      blocks.push({
        id:`xlsx-${++globalIndex}`,
        type:'paragraph',
        text:`${copy.headers}: ${rows[0].cells.map(cell=>cell.value).filter(Boolean).join(', ')}`
      });
    }

    for (const row of rows.slice(headerMode ? 1 : 0)) {
      const parts = row.cells.map(cell => {
        const label = headerMode && headers.get(cell.col) ? headers.get(cell.col) : copy.col(columnName(cell.col));
        if (cell.value) return `${label}: ${cell.value}`;
        if (cell.formula) return `${label}: ${copy.formula} ${cell.formula}`;
        return '';
      }).filter(Boolean);
      if (!parts.length) continue;
      blocks.push({
        id:`xlsx-${++globalIndex}`,
        type:'table-cell',
        text:`${copy.row(row.rowNumber)}. ${parts.join('. ')}`
      });
    }
  }

  if (!blocks.length) throw Object.assign(new Error('empty-xlsx'), { code:'empty-xlsx' });
  return { ...meta, blocks, navigation };
}
