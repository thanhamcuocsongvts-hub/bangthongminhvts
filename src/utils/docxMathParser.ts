import JSZip from 'jszip';
import katex from 'katex';

/**
 * Helper to convert OMML (Office Open XML Math Markup) node to LaTeX
 */
export function ommlNodeToLatex(node: Element): string {
  const tagName = node.localName || node.tagName;

  if (tagName === 't') {
    let txt = node.textContent || '';
    // Normalize special math symbols
    txt = txt
      .replace(/−/g, '-')
      .replace(/×/g, '\\times ')
      .replace(/÷/g, '\\div ')
      .replace(/±/g, '\\pm ')
      .replace(/≤/g, '\\le ')
      .replace(/≥/g, '\\ge ')
      .replace(/≠/g, '\\ne ')
      .replace(/≈/g, '\\approx ')
      .replace(/≡/g, '\\equiv ')
      .replace(/∈/g, '\\in ')
      .replace(/∉/g, '\\notin ')
      .replace(/⊂/g, '\\subset ')
      .replace(/⊃/g, '\\supset ')
      .replace(/∪/g, '\\cup ')
      .replace(/∩/g, '\\cap ')
      .replace(/∅/g, '\\emptyset ')
      .replace(/∞/g, '\\infty ')
      .replace(/α/g, '\\alpha ')
      .replace(/β/g, '\\beta ')
      .replace(/γ/g, '\\gamma ')
      .replace(/θ/g, '\\theta ')
      .replace(/λ/g, '\\lambda ')
      .replace(/μ/g, '\\mu ')
      .replace(/π/g, '\\pi ')
      .replace(/σ/g, '\\sigma ')
      .replace(/φ/g, '\\phi ')
      .replace(/ω/g, '\\omega ')
      .replace(/Δ/g, '\\Delta ')
      .replace(/→/g, '\\to ')
      .replace(/⇒/g, '\\Rightarrow ')
      .replace(/⇔/g, '\\Leftrightarrow ')
      .replace(/ℝ/g, '\\mathbb{R}')
      .replace(/ℤ/g, '\\mathbb{Z}')
      .replace(/ℕ/g, '\\mathbb{N}')
      .replace(/ℚ/g, '\\mathbb{Q}');
    return txt;
  }

  if (tagName === 'r') {
    // Math Run: collect all text and child elements, ignoring formatting properties like rPr
    let text = '';
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const cTag = child.localName || child.tagName;
      if (cTag === 'rPr' || cTag === 'lit') continue;
      text += ommlNodeToLatex(child);
    }
    return text;
  }

  if (tagName === 'f') {
    // Fraction: <m:num> / <m:den>
    const numEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'num');
    const denEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'den');
    const numLatex = numEl ? ommlNodeToLatex(numEl).trim() : '';
    const denLatex = denEl ? ommlNodeToLatex(denEl).trim() : '';
    return `\\frac{${numLatex}}{${denLatex}}`;
  }

  if (tagName === 'rad') {
    // Radical: <m:deg>, <m:e>
    const degEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'deg');
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const degLatex = degEl ? ommlNodeToLatex(degEl).trim() : '';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    if (degLatex && degLatex.length > 0) {
      return `\\sqrt[${degLatex}]{${eLatex}}`;
    }
    return `\\sqrt{${eLatex}}`;
  }

  if (tagName === 'sSup') {
    // Superscript: <m:e>^<m:sup>
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const supEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sup');
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    const supLatex = supEl ? ommlNodeToLatex(supEl).trim() : '';
    return `{${eLatex}}^{${supLatex}}`;
  }

  if (tagName === 'sSub') {
    // Subscript: <m:e>_<m:sub>
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const subEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sub');
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    const subLatex = subEl ? ommlNodeToLatex(subEl).trim() : '';
    return `{${eLatex}}_{${subLatex}}`;
  }

  if (tagName === 'sSubSup') {
    // Subscript and Superscript: <m:e>_<m:sub>^<m:sup>
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const subEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sub');
    const supEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sup');
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    const subLatex = subEl ? ommlNodeToLatex(subEl).trim() : '';
    const supLatex = supEl ? ommlNodeToLatex(supEl).trim() : '';
    return `{${eLatex}}_{${subLatex}}^{${supLatex}}`;
  }

  if (tagName === 'sPre') {
    // Pre-subscript and pre-superscript
    const subEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sub');
    const supEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sup');
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const subLatex = subEl ? ommlNodeToLatex(subEl).trim() : '';
    const supLatex = supEl ? ommlNodeToLatex(supEl).trim() : '';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    return `{}_{${subLatex}}^{${supLatex}}{${eLatex}}`;
  }

  if (tagName === 'nary') {
    // N-ary operator: Integral, Sum, etc.
    const subEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sub');
    const supEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'sup');
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const chrEl = node.querySelector('chr');
    let chrVal = chrEl ? chrEl.getAttribute('m:val') || chrEl.getAttribute('val') || '∫' : '∫';

    let opLatex = '\\int';
    if (chrVal === '∑' || chrVal.toLowerCase().includes('sum')) opLatex = '\\sum';
    else if (chrVal === '∏' || chrVal.toLowerCase().includes('prod')) opLatex = '\\prod';
    else if (chrVal === '∬') opLatex = '\\iint';
    else if (chrVal === '∭') opLatex = '\\iiint';
    else if (chrVal === '∮') opLatex = '\\oint';
    else if (chrVal === '⋃' || chrVal.toLowerCase().includes('cup')) opLatex = '\\bigcup';
    else if (chrVal === '⋂' || chrVal.toLowerCase().includes('cap')) opLatex = '\\bigcap';

    const subLatex = subEl ? ommlNodeToLatex(subEl).trim() : '';
    const supLatex = supEl ? ommlNodeToLatex(supEl).trim() : '';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';

    let res = opLatex;
    if (subLatex) res += `_{${subLatex}}`;
    if (supLatex) res += `^{${supLatex}}`;
    if (eLatex) res += ` ${eLatex}`;
    return res;
  }

  if (tagName === 'd') {
    // Delimiter (parentheses, brackets)
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    const begChr = node.querySelector('begChr')?.getAttribute('m:val') ?? '(';
    const endChr = node.querySelector('endChr')?.getAttribute('m:val') ?? ')';

    let leftDelim = '\\left(';
    let rightDelim = '\\right)';

    if (begChr === '[') leftDelim = '\\left[';
    else if (begChr === '{') leftDelim = '\\left\\{';
    else if (begChr === '|') leftDelim = '\\left|';
    else if (begChr === '‖') leftDelim = '\\left\\|';
    else if (!begChr) leftDelim = '\\left.';

    if (endChr === ']') rightDelim = '\\right]';
    else if (endChr === '}') rightDelim = '\\right\\}';
    else if (endChr === '|') rightDelim = '\\right|';
    else if (endChr === '‖') rightDelim = '\\right\\|';
    else if (!endChr) rightDelim = '\\right.';

    return `${leftDelim} ${eLatex} ${rightDelim}`;
  }

  if (tagName === 'func') {
    // Function: sin, cos, tan, cot, log, ln, lim, min, max
    const fNameEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'fName');
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const fNameLatex = fNameEl ? ommlNodeToLatex(fNameEl).trim() : '';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';

    if (/^(sin|cos|tan|cot|ln|log|exp|lim|min|max)$/i.test(fNameLatex)) {
      return `\\${fNameLatex.toLowerCase()} ${eLatex}`;
    }
    return `${fNameLatex} ${eLatex}`;
  }

  if (tagName === 'eqArr') {
    // Equation Array
    const rows = Array.from(node.children).filter((c) => (c.localName || c.tagName) === 'e');
    const lines = rows.map((r) => ommlNodeToLatex(r).trim()).filter(Boolean);
    return `\\begin{aligned} ${lines.join(' \\\\ ')} \\end{aligned}`;
  }

  if (tagName === 'm') {
    // Matrix
    const rows = Array.from(node.children).filter((c) => (c.localName || c.tagName) === 'mr');
    const rowLatex = rows.map((r) => {
      const cells = Array.from(r.children).filter((c) => (c.localName || c.tagName) === 'e');
      return cells.map((c) => ommlNodeToLatex(c).trim()).join(' & ');
    });
    return `\\begin{pmatrix} ${rowLatex.join(' \\\\ ')} \\end{pmatrix}`;
  }

  if (tagName === 'bar') {
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    return `\\overline{${eEl ? ommlNodeToLatex(eEl).trim() : ''}}`;
  }

  if (tagName === 'acc') {
    // Accent (vector, hat)
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const chr = node.querySelector('chr')?.getAttribute('m:val') || '⃗';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    if (chr === '⃗' || chr === '→') return `\\vec{${eLatex}}`;
    if (chr === '^' || chr === '̂') return `\\hat{${eLatex}}`;
    if (chr === '˙' || chr === '.') return `\\dot{${eLatex}}`;
    if (chr === '¨' || chr === '..') return `\\ddot{${eLatex}}`;
    return `\\vec{${eLatex}}`;
  }

  if (tagName === 'limLow') {
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const limEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'lim');
    return `\\lim_{${limEl ? ommlNodeToLatex(limEl).trim() : ''}} ${eEl ? ommlNodeToLatex(eEl).trim() : ''}`;
  }

  if (tagName === 'limUpp') {
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const limEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'lim');
    return `\\overline{\\lim}_{${limEl ? ommlNodeToLatex(limEl).trim() : ''}} ${eEl ? ommlNodeToLatex(eEl).trim() : ''}`;
  }

  if (tagName === 'groupChr') {
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    const chr = node.querySelector('chr')?.getAttribute('m:val') || '⏟';
    const pos = node.querySelector('pos')?.getAttribute('m:val') || 'bot';
    const eLatex = eEl ? ommlNodeToLatex(eEl).trim() : '';
    if (pos === 'top' || chr === '⏞') return `\\overbrace{${eLatex}}`;
    return `\\underbrace{${eLatex}}`;
  }

  if (tagName === 'box' || tagName === 'borderBox') {
    const eEl = Array.from(node.children).find((c) => (c.localName || c.tagName) === 'e');
    return `\\boxed{${eEl ? ommlNodeToLatex(eEl).trim() : ''}}`;
  }

  // General container: recursively parse all children
  let result = '';
  for (let i = 0; i < node.children.length; i++) {
    result += ommlNodeToLatex(node.children[i]);
  }
  return result;
}

/**
 * Render a LaTeX formula to KaTeX HTML
 */
export function renderLatexToHtml(latex: string, isBlock = false): string {
  if (!latex || !latex.trim()) return '';
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: isBlock,
      throwOnError: false,
    });
  } catch (e) {
    return `<span class="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200">${latex}</span>`;
  }
}

/**
 * Parse an element inside a paragraph (handles runs, tabs, drawings, OMML math)
 */
function parseParagraphElement(
  element: Element,
  mediaMap: Record<string, string>,
  collectedImages: string[]
): { html: string; text: string } {
  let html = '';
  let text = '';

  const tagName = element.localName || element.tagName;

  // 1. Math Object (<m:oMath> or <m:oMathPara>)
  if (tagName === 'oMath' || tagName === 'oMathPara') {
    const latex = ommlNodeToLatex(element).trim();
    if (latex) {
      const mathHtml = renderLatexToHtml(latex, tagName === 'oMathPara');
      html += ` <span class="math-inline inline-block my-0.5 align-middle font-serif text-indigo-950 font-medium">${mathHtml}</span> `;
      text += ` $${latex}$ `;
    }
    return { html, text };
  }

  // 2. Run (<w:r>)
  if (tagName === 'r') {
    // Check if run has child math object
    const mathChildren = element.querySelectorAll('m\\:oMath, oMath, m\\:oMathPara, oMathPara');
    if (mathChildren.length > 0) {
      mathChildren.forEach((mEl) => {
        const latex = ommlNodeToLatex(mEl).trim();
        if (latex) {
          const mathHtml = renderLatexToHtml(latex, false);
          html += ` <span class="math-inline inline-block my-0.5 align-middle font-serif text-indigo-950 font-medium">${mathHtml}</span> `;
          text += ` $${latex}$ `;
        }
      });
      return { html, text };
    }

    const isBold = !!element.querySelector('w\\:b, b');
    const isItalic = !!element.querySelector('w\\:i, i');
    const isUnderline = !!element.querySelector('w\\:u, u');

    // Check for tabs inside run (<w:tab/>)
    const hasTab = !!element.querySelector('w\\:tab, tab');
    if (hasTab) {
      html += '<span class="inline-block w-8 md:w-12">&emsp;&emsp;</span>';
      text += '\t';
    }

    // Check for line breaks inside run (<w:br/>)
    const hasBr = !!element.querySelector('w\\:br, br');
    if (hasBr) {
      html += '<br/>';
      text += '\n';
    }

    // Check for images inside run
    const blip = element.querySelector('a\\:blip, blip');
    const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
    if (embedId && mediaMap[embedId]) {
      const imgSrc = mediaMap[embedId];
      if (!collectedImages.includes(imgSrc)) {
        collectedImages.push(imgSrc);
        html += `<div class="my-4 flex justify-center"><img src="${imgSrc}" alt="Hình minh họa bài tập" class="max-h-80 max-w-full rounded-2xl shadow-md border border-slate-200 object-contain bg-white p-1" /></div>`;
      }
    }

    // Text nodes inside run
    const tNodes = element.querySelectorAll('w\\:t, t');
    let rText = '';
    tNodes.forEach((t) => {
      rText += t.textContent || '';
    });

    if (rText) {
      let styledText = rText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (isBold) styledText = `<strong>${styledText}</strong>`;
      if (isItalic) styledText = `<em>${styledText}</em>`;
      if (isUnderline) styledText = `<u>${styledText}</u>`;

      html += styledText;
      text += rText;
    }

    return { html, text };
  }

  // 3. Tab (<w:tab>)
  if (tagName === 'tab') {
    return {
      html: '<span class="inline-block w-8 md:w-12">&emsp;&emsp;</span>',
      text: '\t',
    };
  }

  // 4. Break (<w:br>)
  if (tagName === 'br') {
    return { html: '<br/>', text: '\n' };
  }

  // 5. Drawings / Pictures (<w:drawing>, <w:pict>)
  if (tagName === 'drawing' || tagName === 'pict') {
    const blip = element.querySelector('a\\:blip, blip');
    const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
    if (embedId && mediaMap[embedId]) {
      const imgSrc = mediaMap[embedId];
      if (!collectedImages.includes(imgSrc)) {
        collectedImages.push(imgSrc);
        html += `<div class="my-4 flex justify-center"><img src="${imgSrc}" alt="Hình minh họa bài tập" class="max-h-80 max-w-full rounded-2xl shadow-md border border-slate-200 object-contain bg-white p-1" /></div>`;
      }
    }
    return { html, text };
  }

  // 6. Structured Document Tag or other wrappers (<w:sdt>, etc.)
  for (let i = 0; i < element.children.length; i++) {
    const res = parseParagraphElement(element.children[i], mediaMap, collectedImages);
    html += res.html;
    text += res.text;
  }

  return { html, text };
}

/**
 * Format Question & Choice lines nicely so options A, B, C, D have distinct badges
 */
function formatQuestionAndChoiceHtml(pHtml: string, pText: string): string {
  const trimmedText = pText.trim();

  // Question Heading (e.g. "Câu 1.", "Câu 2:", "Bài 1:", "Ví dụ 1:")
  const isQuestionHeading = /^[\s]*(câu|bài|ví dụ|đề bài|phần)\s+\d+[\.\:\-]/i.test(trimmedText);
  if (isQuestionHeading) {
    return `<div class="mt-5 mb-2.5 p-3 rounded-2xl bg-indigo-50/80 border-l-4 border-indigo-600 font-bold text-slate-900 text-sm md:text-base shadow-2xs">${pHtml}</div>`;
  }

  // Option lines (e.g. "A. ... B. ... C. ... D. ...")
  let formattedHtml = pHtml;

  // Replace isolated A. B. C. D. with distinct option pills if needed
  formattedHtml = formattedHtml.replace(
    /(^|\s|&emsp;|\t)(<strong>)?\s*([A-D])\s*[\.\:\)](<\/strong>)?\s*/g,
    '$1<span class="inline-flex items-center justify-center font-bold px-2 py-0.5 mx-1 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs shadow-2xs">$3.</span> '
  );

  return `<p class="my-2 leading-relaxed text-slate-800 text-sm md:text-base">${formattedHtml}</p>`;
}

/**
 * Deep parser for Microsoft Word (.docx) that extracts:
 * 1. Embedded raster images (PNG, JPEG, GIF) with base64 Data URLs
 * 2. OMML Math equations (<m:oMath>) converted to KaTeX/LaTeX
 * 3. Tables formatted as responsive HTML tables
 * 4. Text and question/choice layout formatted as clean HTML
 */
export async function parseDocxWithFullMathAndMedia(arrayBuffer: ArrayBuffer): Promise<{
  html: string;
  rawText: string;
}> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Extract and map media relations (word/_rels/document.xml.rels)
    const relsXmlStr = await zip.file('word/_rels/document.xml.rels')?.async('string');
    const mediaMap: Record<string, string> = {}; // rId -> base64 DataURL

    if (relsXmlStr) {
      const parser = new DOMParser();
      const relsDoc = parser.parseFromString(relsXmlStr, 'application/xml');
      const relationships = relsDoc.querySelectorAll('Relationship');

      for (let i = 0; i < relationships.length; i++) {
        const rel = relationships[i];
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        const type = rel.getAttribute('Type') || '';

        if (id && target && (type.includes('image') || target.startsWith('media/'))) {
          const mediaPath = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^word\//, '')}`;
          const mediaFile = zip.file(mediaPath) || zip.file(`word/${target}`) || zip.file(target);
          if (mediaFile) {
            const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
              const base64 = await mediaFile.async('base64');
              const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
              mediaMap[id] = `data:${mime};base64,${base64}`;
            }
          }
        }
      }
    }

    // 2. Parse word/document.xml
    const docXmlStr = await zip.file('word/document.xml')?.async('string');
    if (!docXmlStr) {
      throw new Error('Không tìm thấy tệp word/document.xml trong file docx.');
    }

    const parser = new DOMParser();
    const docXml = parser.parseFromString(docXmlStr, 'application/xml');

    const bodyEl = docXml.querySelector('w\\:body, body');
    if (!bodyEl) {
      throw new Error('Không tìm thấy thẻ body trong document.xml.');
    }

    const htmlBlocks: string[] = [];
    const textLines: string[] = [];
    const collectedImages: string[] = [];

    // Traverse direct body children (paragraphs <w:p> and tables <w:tbl>)
    const bodyChildren = Array.from(bodyEl.children);

    bodyChildren.forEach((node) => {
      const nodeTag = node.localName || node.tagName;

      // 1. PARAGRAPH (<w:p>)
      if (nodeTag === 'p') {
        let pHtml = '';
        let pText = '';

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          const cTag = child.localName || child.tagName;
          if (cTag === 'pPr') continue; // Skip paragraph properties

          const res = parseParagraphElement(child, mediaMap, collectedImages);
          pHtml += res.html;
          pText += res.text;
        }

        if (pHtml.trim() || pText.trim()) {
          const block = formatQuestionAndChoiceHtml(pHtml, pText);
          htmlBlocks.push(block);
          textLines.push(pText.trim());
        }
        return;
      }

      // 2. TABLE (<w:tbl>)
      if (nodeTag === 'tbl') {
        let tableHtml = '<div class="my-4 overflow-x-auto"><table class="min-w-full border-collapse border border-slate-300 rounded-xl bg-white text-xs md:text-sm">';
        const rows = Array.from(node.querySelectorAll('w\\:tr, tr'));

        rows.forEach((row, rIdx) => {
          tableHtml += `<tr class="${rIdx === 0 ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}">`;
          const cells = Array.from(row.querySelectorAll('w\\:tc, tc'));

          cells.forEach((cell) => {
            let cellHtml = '';
            let cellText = '';
            const cellParas = Array.from(cell.querySelectorAll('w\\:p, p'));

            cellParas.forEach((cp) => {
              for (let i = 0; i < cp.children.length; i++) {
                const child = cp.children[i];
                if ((child.localName || child.tagName) === 'pPr') continue;
                const res = parseParagraphElement(child, mediaMap, collectedImages);
                cellHtml += res.html;
                cellText += res.text;
              }
            });

            tableHtml += `<td class="border border-slate-200 p-2.5 align-top">${cellHtml || '&nbsp;'}</td>`;
            if (cellText.trim()) textLines.push(cellText.trim());
          });

          tableHtml += '</tr>';
        });

        tableHtml += '</table></div>';
        htmlBlocks.push(tableHtml);
      }
    });

    const finalHtml = htmlBlocks.join('\n');
    const finalRawText = textLines.join('\n');

    return {
      html: finalHtml,
      rawText: finalRawText,
    };
  } catch (e) {
    console.warn('Deep Docx Math & Media parser notice:', e);
    throw e;
  }
}

/**
 * Robust binary extractor for legacy Word 97-2003 (.doc) files
 */
export function extractTextFromDocBinary(buffer: ArrayBuffer): { text: string; html: string } {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(uint8);

    // Filter printable characters and Vietnamese Unicode
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
    const lines = text
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 2 && !/^[\s\-_=+#*]+$/.test(l));

    const cleanLines = lines.filter((l) => {
      // Must contain readable letters
      return /[a-zA-Zà-ỹÀ-Ỹ0-9]/.test(l);
    });

    const rawText = cleanLines.join('\n');

    const html = cleanLines
      .map((line) => {
        const isQuestion = /^[\s]*(câu|bài|ví dụ|đề bài|phần)\s+\d+[\.\:\-]/i.test(line);
        if (isQuestion) {
          return `<div class="mt-4 mb-2 p-3 rounded-xl bg-indigo-50 border-l-4 border-indigo-600 font-bold text-slate-900">${line}</div>`;
        }
        return `<p class="my-1.5 leading-relaxed text-slate-800">${line}</p>`;
      })
      .join('\n');

    return { text: rawText, html };
  } catch (e) {
    return {
      text: 'Tài liệu Word (.doc)',
      html: '<p class="text-slate-600">Đã nạp tệp Word (.doc). Sẵn sàng trình chiếu và xem trực tiếp.</p>',
    };
  }
}
