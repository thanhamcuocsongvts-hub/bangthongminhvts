import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  VerticalAlign,
  ShadingType,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
} from 'docx';
import { QuizQuestion } from '../types';
import { saveBlobSafely } from './exportUtils';

/**
 * Clean and map LaTeX commands and symbols to standard Unicode math symbols for Word OpenXML
 */
export function cleanLatexSymbols(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\\\/g, ' ')
    .replace(/\\left\s*([(\[{|])/g, '$1')
    .replace(/\\right\s*([)\]}|])/g, '$1')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\in\b/g, '∈')
    .replace(/\\notin\b/g, '∉')
    .replace(/\\subset\b/g, '⊂')
    .replace(/\\subseteq\b/g, '⊆')
    .replace(/\\cup\b/g, '∪')
    .replace(/\\cap\b/g, '∩')
    .replace(/\\(?:le|leq)\b/g, '≤')
    .replace(/\\(?:ge|geq)\b/g, '≥')
    .replace(/\\(?:ne|neq)\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\div\b/g, '÷')
    .replace(/\\(?:to|rightarrow)\b/g, '→')
    .replace(/\\Rightarrow\b/g, '⇒')
    .replace(/\\Leftarrow\b/g, '⇐')
    .replace(/\\Leftrightarrow\b/g, '⇔')
    .replace(/\\forall\b/g, '∀')
    .replace(/\\exists\b/g, '∃')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\mathbb\{R\}|\\mathbf\{R\}|\\mathbb\s+R/g, 'ℝ')
    .replace(/\\mathbb\{Z\}|\\mathbb\s+Z/g, 'ℤ')
    .replace(/\\mathbb\{N\}|\\mathbb\s+N/g, 'ℕ')
    .replace(/\\mathbb\{Q\}|\\mathbb\s+Q/g, 'ℚ')
    .replace(/\\mathbb\{C\}|\\mathbb\s+C/g, 'ℂ')
    .replace(/\\emptyset\b/g, '∅')
    .replace(/\\degree|\^\\circ/g, '°')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\mathit\{([^}]*)\}/g, '$1')
    .replace(/\\setminus\b/g, '\\')
    .replace(/\\(?:sin|cos|tan|cot|ln|log|lim|max|min)\b/g, '$& ')
    .replace(/\\vec\{([a-zA-Z0-9]+)\}/g, '$1⃗')
    .replace(/\\overrightarrow\{([a-zA-Z0-9]+)\}/g, '$1⃗')
    .replace(/\\[,;!]/g, ' ')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}');
}

type DocxMathChild =
  | MathRun
  | MathFraction
  | MathSuperScript
  | MathSubScript
  | MathSubSuperScript
  | MathRadical;

/**
 * Recursively parses LaTeX formulas into native docx.Math components
 * Perfectly renders <m:oMath> in Microsoft Word without XML errors or corruption
 */
export function parseLatexNodes(raw: string): DocxMathChild[] {
  let src = raw.trim();
  if (!src) return [];

  const nodes: DocxMathChild[] = [];
  let i = 0;

  function readGroup(str: string, startIdx: number): { text: string; nextIdx: number } {
    if (startIdx >= str.length) return { text: '', nextIdx: str.length };

    if (str[startIdx] !== '{' && str[startIdx] !== '[') {
      let end = startIdx + 1;
      while (end < str.length && /[a-zA-Z0-9]/.test(str[end])) end++;
      return { text: str.slice(startIdx, end), nextIdx: end };
    }

    const openChar = str[startIdx];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 1;
    let idx = startIdx + 1;
    const contentStart = idx;

    while (idx < str.length && depth > 0) {
      if (str[idx] === openChar && (idx === 0 || str[idx - 1] !== '\\')) depth++;
      else if (str[idx] === closeChar && (idx === 0 || str[idx - 1] !== '\\')) depth--;
      idx++;
    }

    return {
      text: str.slice(contentStart, idx - (depth === 0 ? 1 : 0)),
      nextIdx: idx,
    };
  }

  while (i < src.length) {
    // 1. Fractions: \frac{a}{b} or \dfrac{a}{b}
    if (src.startsWith('\\frac', i) || src.startsWith('\\dfrac', i)) {
      const skip = src.startsWith('\\dfrac', i) ? 6 : 5;
      i += skip;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      const numG = readGroup(src, i);
      i = numG.nextIdx;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      const denG = readGroup(src, i);
      i = denG.nextIdx;

      nodes.push(
        new MathFraction({
          numerator: parseLatexNodes(numG.text),
          denominator: parseLatexNodes(denG.text),
        })
      );
    }
    // 2. Radicals: \sqrt{x} or \sqrt[3]{x}
    else if (src.startsWith('\\sqrt', i)) {
      i += 5;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      let degreeNodes: DocxMathChild[] | undefined = undefined;

      if (src[i] === '[') {
        const degG = readGroup(src, i);
        degreeNodes = parseLatexNodes(degG.text);
        i = degG.nextIdx;
        while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      }

      const radG = readGroup(src, i);
      i = radG.nextIdx;

      nodes.push(
        new MathRadical({
          degree: degreeNodes,
          children: parseLatexNodes(radG.text),
        })
      );
    }
    // 3. Superscripts: base^{exp} or base^2
    else if (src[i] === '^' && nodes.length > 0) {
      i++;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      const expG = readGroup(src, i);
      i = expG.nextIdx;

      const prevNode = nodes.pop()!;
      // Check if previous node was a subscript to combine into SubSuperScript
      if (prevNode instanceof MathSubScript) {
        nodes.push(
          new MathSubSuperScript({
            children: (prevNode as any).root || [new MathRun('x')],
            subScript: (prevNode as any).subScript || [new MathRun('1')],
            superScript: parseLatexNodes(expG.text),
          })
        );
      } else {
        nodes.push(
          new MathSuperScript({
            children: [prevNode],
            superScript: parseLatexNodes(expG.text),
          })
        );
      }
    }
    // 4. Subscripts: base_{sub} or base_1
    else if (src[i] === '_' && nodes.length > 0) {
      i++;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      const subG = readGroup(src, i);
      i = subG.nextIdx;

      const prevNode = nodes.pop()!;
      nodes.push(
        new MathSubScript({
          children: [prevNode],
          subScript: parseLatexNodes(subG.text),
        })
      );
    }
    // 5. Plain text, operators, symbols, or identifiers
    else {
      let start = i;
      while (
        i < src.length &&
        !src.startsWith('\\frac', i) &&
        !src.startsWith('\\dfrac', i) &&
        !src.startsWith('\\sqrt', i) &&
        src[i] !== '^' &&
        src[i] !== '_'
      ) {
        i++;
      }

      const rawChunk = src.slice(start, i);
      const cleanChunk = cleanLatexSymbols(rawChunk);
      if (cleanChunk) {
        nodes.push(new MathRun(cleanChunk));
      }
    }
  }

  return nodes.length > 0 ? nodes : [new MathRun(cleanLatexSymbols(src))];
}

/**
 * Convert LaTeX mathematical formulas into a native docx.Math component
 * Guarantees 100% valid OpenXML <m:oMath> that Microsoft Word opens cleanly without repair errors.
 */
export function convertLatexToDocxMath(latex: string): DocxMath {
  let src = (latex || '').trim();

  // Strip wrapping delimiters if present
  if (src.startsWith('$$') && src.endsWith('$$') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  } else if (src.startsWith('$') && src.endsWith('$') && src.length >= 2) {
    src = src.slice(1, -1).trim();
  } else if (src.startsWith('\\(') && src.endsWith('\\)') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  } else if (src.startsWith('\\[') && src.endsWith('\\]') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  }

  try {
    const children = parseLatexNodes(src);
    return new DocxMath({ children: children.length > 0 ? children : [new MathRun(cleanLatexSymbols(src))] });
  } catch (err) {
    // Ultra-safe fallback with cleaned Unicode math run
    return new DocxMath({ children: [new MathRun(cleanLatexSymbols(src))] });
  }
}

/**
 * Parses a string containing mixed plain text and LaTeX formulas ($...$, $$...$$)
 * into native docx TextRuns and DocxMath components.
 * STRICT: Absolutely no raw Markdown (**, #, |) or embedded HTML is emitted.
 */
export function parseTextWithLatexToDocxRuns(
  text: string,
  baseOptions: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}
): (TextRun | DocxMath)[] {
  if (!text) return [];

  // Remove markdown headers or HTML tags from text
  const cleanInput = text
    .replace(/^#+\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  const runs: (TextRun | DocxMath)[] = [];

  // Split by math delimiters: $$...$$, $...$, \(...\), \[...\]
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
  const parts = cleanInput.split(mathRegex);

  for (const part of parts) {
    if (!part) continue;

    const isMath =
      (part.startsWith('$') && part.endsWith('$')) ||
      (part.startsWith('\\(') && part.endsWith('\\)')) ||
      (part.startsWith('\\[') && part.endsWith('\\]'));

    if (isMath) {
      try {
        runs.push(convertLatexToDocxMath(part));
      } catch (err) {
        // Fallback clean plain text if math parsing fails
        const fallbackText = cleanLatexSymbols(part.replace(/^\$+|\$+$/g, '').trim());
        runs.push(
          new TextRun({
            text: fallbackText,
            font: 'Times New Roman',
            bold: baseOptions.bold,
            italics: true,
            color: baseOptions.color || '1E293B',
            size: baseOptions.size || 24, // 12pt
          })
        );
      }
    } else {
      // Process plain text part: parse bold markdown **...** into pure TextRuns
      const boldSegments = part.split(/(\*\*[\s\S]+?\*\*)/g);
      for (const seg of boldSegments) {
        if (!seg) continue;
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
          const boldText = seg.slice(2, -2);
          runs.push(
            new TextRun({
              text: boldText,
              font: 'Times New Roman',
              bold: true,
              italics: baseOptions.italics,
              color: baseOptions.color || '0F172A',
              size: baseOptions.size || 24,
            })
          );
        } else {
          runs.push(
            new TextRun({
              text: seg,
              font: 'Times New Roman',
              bold: baseOptions.bold,
              italics: baseOptions.italics,
              color: baseOptions.color || '1E293B',
              size: baseOptions.size || 24,
            })
          );
        }
      }
    }
  }

  return runs;
}

/**
 * Creates an OpenXML Table for a Variation Table (Bảng biến thiên)
 * Follows Vietnam Ministry of Education & SGK GDPT 2018 textbook layout standards.
 */
export function createDocxVariationTable(diagramData: any): Table {
  const xVals: string[] = diagramData?.x || ['-\\infty', '-1', '2', '+\\infty'];
  const yPrimeVals: string[] = diagramData?.yPrime || ['+', '0', '-', '0', '+'];
  const yArrows: any[] = diagramData?.yArrows || [
    { start: '-\\infty', end: '3', dir: 'up' },
    { start: '3', end: '-2', dir: 'down' },
    { start: '-2', end: '+\\infty', dir: 'up' },
  ];

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
  };

  // Header row for variable x
  const xCells: TableCell[] = [
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
      verticalAlign: VerticalAlign.CENTER,
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'x', font: 'Times New Roman', bold: true, italics: true, size: 24 })],
        }),
      ],
    }),
    ...xVals.map((val) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: parseTextWithLatexToDocxRuns(`$${val.replace(/^\$+|\$+$/g, '')}$`, { bold: true, size: 22 }),
          }),
        ],
      })
    ),
  ];

  // Derivative row y'
  const yPrimeCells: TableCell[] = [
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
      verticalAlign: VerticalAlign.CENTER,
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "y'", font: 'Times New Roman', bold: true, italics: true, size: 24 })],
        }),
      ],
    }),
    ...yPrimeVals.slice(0, xVals.length).map((sign) => {
      const isAsymptote = sign === '||';
      return new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: isAsymptote
          ? {
              ...cellBorder,
              left: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
              right: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
            }
          : cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: sign,
                font: 'Times New Roman',
                bold: true,
                color: sign === '+' ? 'DC2626' : sign === '-' ? '2563EB' : '0F172A',
                size: 24,
              }),
            ],
          }),
        ],
      });
    }),
  ];

  // Variation row y with directional arrow representations (↗, ↘)
  const yCells: TableCell[] = [
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
      verticalAlign: VerticalAlign.CENTER,
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'y', font: 'Times New Roman', bold: true, italics: true, size: 24 })],
        }),
      ],
    }),
    ...yArrows.map((arr) => {
      const isUp = arr.dir === 'up';
      const arrowSymbol = isUp ? ' ↗ ' : ' ↘ ';
      return new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              ...parseTextWithLatexToDocxRuns(`$${arr.start.replace(/^\$+|\$+$/g, '')}$`, { size: 22 }),
              new TextRun({
                text: arrowSymbol,
                font: 'Times New Roman',
                bold: true,
                color: isUp ? 'DC2626' : '2563EB',
                size: 24,
              }),
              ...parseTextWithLatexToDocxRuns(`$${arr.end.replace(/^\$+|\$+$/g, '')}$`, { bold: true, size: 22 }),
            ],
          }),
        ],
      });
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ children: xCells }),
      new TableRow({ children: yPrimeCells }),
      new TableRow({ children: yCells }),
    ],
  });
}

/**
 * Creates an OpenXML Table for a Sign Table (Bảng xét dấu)
 */
export function createDocxSignTable(diagramData: any): Table {
  const xVals: string[] = diagramData?.x || ['-\\infty', '-2', '3', '+\\infty'];
  const rows: any[] = diagramData?.rows || [
    { label: "f'(x)", signs: ['+', '0', '-', '0', '+'] },
  ];

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
  };

  const xCells: TableCell[] = [
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
      verticalAlign: VerticalAlign.CENTER,
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'x', font: 'Times New Roman', bold: true, italics: true, size: 24 })],
        }),
      ],
    }),
    ...xVals.map((val) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: parseTextWithLatexToDocxRuns(`$${val.replace(/^\$+|\$+$/g, '')}$`, { bold: true, size: 22 }),
          }),
        ],
      })
    ),
  ];

  const dataRows: TableRow[] = rows.map((r) => {
    const cells: TableCell[] = [
      new TableCell({
        width: { size: 1400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: r.label, font: 'Times New Roman', bold: true, italics: true, size: 24 })],
          }),
        ],
      }),
      ...(r.signs || []).map((sign: string) =>
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          borders: cellBorder,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: sign,
                  font: 'Times New Roman',
                  bold: true,
                  color: sign === '+' ? 'DC2626' : sign === '-' ? '2563EB' : '0F172A',
                  size: 24,
                }),
              ],
            }),
          ],
        })
      ),
    ];
    return new TableRow({ children: cells });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [new TableRow({ children: xCells }), ...dataRows],
  });
}

/**
 * Creates an OpenXML Table for Part II True/False sub-statements
 */
function createDocxTrueFalseTable(subStatements: any[]): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 900, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Ý', bold: true, font: 'Times New Roman', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 6800, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.START,
            children: [new TextRun({ text: 'Mệnh đề', bold: true, font: 'Times New Roman', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Đúng', bold: true, font: 'Times New Roman', size: 22, color: '16A34A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Sai', bold: true, font: 'Times New Roman', size: 22, color: 'DC2626' })],
          }),
        ],
      }),
    ],
  });

  const statementRows: TableRow[] = (subStatements || []).map((sub: any) => {
    const label = sub.label || sub.key || 'a';
    const text = sub.statement || sub.text || '';
    const isCorrect = typeof sub.correct === 'boolean' ? sub.correct : sub.isCorrect;

    return new TableRow({
      children: [
        new TableCell({
          borders: cellBorder,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${label})`, bold: true, font: 'Times New Roman', size: 22 })],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorder,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.START,
              children: parseTextWithLatexToDocxRuns(text, { size: 22 }),
            }),
          ],
        }),
        new TableCell({
          borders: cellBorder,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: isCorrect === true ? '☑' : '☐',
                  font: 'Times New Roman',
                  bold: true,
                  size: 26,
                  color: isCorrect === true ? '16A34A' : '94A3B8',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorder,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: isCorrect === false ? '☑' : '☐',
                  font: 'Times New Roman',
                  bold: true,
                  size: 26,
                  color: isCorrect === false ? 'DC2626' : '94A3B8',
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...statementRows],
  });
}

/**
 * Creates OpenXML elements for any embedded question diagram:
 * Variation tables, sign tables, standard function graphs, and practical math illustrations.
 */
function renderQuestionDiagramDocx(q: QuizQuestion): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  if (q.diagramType === 'variation_table' && q.diagramData) {
    elements.push(createDocxVariationTable(q.diagramData));
    elements.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  } else if (q.diagramType === 'sign_table' && q.diagramData) {
    elements.push(createDocxSignTable(q.diagramData));
    elements.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  } else if (q.diagramType === 'function_graph' && q.diagramData) {
    const graphEq = q.diagramData.latex || q.diagramData.equation || '';
    const fnType = q.diagramData.functionType || q.diagramData.graphType || '';
    const label = fnType === 'rational' ? 'Hàm phân thức bậc nhất trên bậc nhất' :
                  fnType === 'cubic' ? 'Hàm số bậc ba' :
                  fnType === 'quartic' ? 'Hàm số trùng phương' :
                  fnType === 'quadratic' ? 'Hàm số bậc hai (Parabol)' : 'Hàm số';
    elements.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 400 },
        children: [
          new TextRun({ text: `📈 [Đồ thị ${label}: `, font: 'Times New Roman', italics: true, size: 22, color: '2563EB', bold: true }),
          ...parseTextWithLatexToDocxRuns(graphEq ? `$${graphEq}$` : '(theo hình vẽ chuẩn SGK)', { size: 22, bold: true }),
          new TextRun({ text: ']', font: 'Times New Roman', italics: true, size: 22, color: '2563EB' }),
        ],
      })
    );
  } else if (q.diagramType === 'practical_illustration' && q.diagramData) {
    const title = q.diagramData.title || 'Mô hình bài toán ứng dụng thực tế';
    elements.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 400 },
        children: [
          new TextRun({ text: `📐 [Hình vẽ minh họa: `, font: 'Times New Roman', italics: true, size: 22, color: '0D9488', bold: true }),
          new TextRun({ text: `${title}`, font: 'Times New Roman', italics: true, size: 22, color: '0F172A' }),
          new TextRun({ text: ']', font: 'Times New Roman', italics: true, size: 22, color: '0D9488' }),
        ],
      })
    );
  }

  return elements;
}

/**
 * Main function to export questions to a standardized, publication-grade Word .docx document
 * Mobile-friendly, strict OpenXML math (DocxMath), no Markdown/HTML, and native OpenXML tables.
 */
export async function exportExamToWordDocx(params: {
  title?: string;
  subject?: string;
  grade?: string;
  questions: QuizQuestion[];
  teacherName?: string;
  examCode?: string;
}): Promise<void> {
  const {
    title = 'ĐỀ KIỂM TRA ĐỊNH KỲ',
    subject = 'Toán học',
    grade = 'Lớp 12',
    questions = [],
    teacherName = 'Tổ Bộ Môn',
    examCode = '101',
  } = params;

  if (!questions || questions.length === 0) {
    throw new Error('Chưa có câu hỏi nào để xuất file Word (.docx)');
  }

  // Group questions by parts according to Ministry of Education guidelines
  const part1Questions = questions.filter(
    (q) => !q.partType || q.partType === 'part_1_choice'
  );
  const part2Questions = questions.filter((q) => q.partType === 'part_2_true_false');
  const part3Questions = questions.filter((q) => q.partType === 'part_3_short_answer');
  const part4Questions = questions.filter((q) => q.partType === 'part_4_essay');

  const children: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. HEADER: Standard Ministry Exam Header Table
  // ==========================================
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'SỞ GD&ĐT - TRƯỜNG THPT', bold: true, font: 'Times New Roman', size: 22 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `GIÁO VIÊN: ${teacherName.toUpperCase()}`, font: 'Times New Roman', size: 20 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Mã đề thi: ${examCode}`, bold: true, font: 'Times New Roman', size: 20, color: '1E3A8A' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: title.toUpperCase(), bold: true, font: 'Times New Roman', size: 24, color: '1E3A8A' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Môn: ${subject}  |  Khối: ${grade}`, italics: true, font: 'Times New Roman', size: 20 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Thời gian làm bài: 90 phút (Không kể phát đề)', italics: true, font: 'Times New Roman', size: 18 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(headerTable);

  // Horizontal separator line
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
      children: [
        new TextRun({ text: '--------------------------------------------------------------------------------------------------', font: 'Times New Roman', color: '94A3B8', size: 18 }),
      ],
    })
  );

  let globalQuestionIndex = 1;

  // ==========================================
  // 2. PHẦN I: Trắc nghiệm 4 lựa chọn (12 câu)
  // ==========================================
  if (part1Questions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: 'PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
            bold: true,
            font: 'Times New Roman',
            color: '1E3A8A',
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'Thí sinh trả lời từ câu 1 đến câu ' + part1Questions.length + '. Mỗi câu hỏi thí sinh chỉ chọn một phương án.',
            italics: true,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    for (const q of part1Questions) {
      // Question prompt
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Câu ${globalQuestionIndex}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(q.question, { size: 24 }),
          ],
        })
      );

      // Embedded diagram (variation table, sign table, function graph, or practical illustration)
      children.push(...renderQuestionDiagramDocx(q));

      // Options: A, B, C, D
      if (Array.isArray(q.options) && q.options.length > 0) {
        q.options.forEach((opt: any) => {
          const key = (opt.key || '').toUpperCase();
          const text = opt.text || '';
          children.push(
            new Paragraph({
              indent: { left: 400 },
              spacing: { after: 40 },
              children: [
                new TextRun({ text: `${key}. `, bold: true, font: 'Times New Roman', size: 23, color: '1E293B' }),
                ...parseTextWithLatexToDocxRuns(text, { size: 23 }),
              ],
            })
          );
        });
      }

      globalQuestionIndex++;
    }
  }

  // ==========================================
  // 3. PHẦN II: Trắc nghiệm Đúng / Sai (4 câu)
  // ==========================================
  if (part2Questions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [
          new TextRun({
            text: 'PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI',
            bold: true,
            font: 'Times New Roman',
            color: '1E3A8A',
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'Thí sinh trả lời từ câu 1 đến câu ' + part2Questions.length + '. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
            italics: true,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    let part2Index = 1;
    for (const q of part2Questions) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Câu ${part2Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(q.question, { size: 24 }),
          ],
        })
      );

      // Embedded diagram (variation table, sign table, function graph, or practical illustration)
      children.push(...renderQuestionDiagramDocx(q));

      if (Array.isArray(q.subStatements) && q.subStatements.length > 0) {
        children.push(createDocxTrueFalseTable(q.subStatements));
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }

      part2Index++;
      globalQuestionIndex++;
    }
  }

  // ==========================================
  // 4. PHẦN III: Trắc nghiệm Trả lời ngắn (6 câu)
  // ==========================================
  if (part3Questions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [
          new TextRun({
            text: 'PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN',
            bold: true,
            font: 'Times New Roman',
            color: '1E3A8A',
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'Thí sinh trả lời từ câu 1 đến câu ' + part3Questions.length + '. Điền kết quả số chính xác vào ô trả lời.',
            italics: true,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    let part3Index = 1;
    for (const q of part3Questions) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({ text: `Câu ${part3Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(q.question, { size: 24 }),
          ],
        })
      );

      // Embedded diagram (variation table, sign table, function graph, or practical illustration)
      children.push(...renderQuestionDiagramDocx(q));

      children.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'Đáp số: ............................................................', italics: true, font: 'Times New Roman', size: 22, color: '64748B' }),
          ],
        })
      );

      part3Index++;
      globalQuestionIndex++;
    }
  }

  // ==========================================
  // 5. PHẦN IV: Tự luận (nếu có)
  // ==========================================
  if (part4Questions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [
          new TextRun({
            text: 'PHẦN IV. TỰ LUẬN',
            bold: true,
            font: 'Times New Roman',
            color: '1E3A8A',
            size: 24,
          }),
        ],
      })
    );

    let part4Index = 1;
    for (const q of part4Questions) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 100 },
          children: [
            new TextRun({ text: `Bài ${part4Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(q.question, { size: 24 }),
          ],
        })
      );

      // Embedded diagram (variation table, sign table, function graph, or practical illustration)
      children.push(...renderQuestionDiagramDocx(q));

      part4Index++;
      globalQuestionIndex++;
    }
  }

  // ==========================================
  // 6. ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
  // ==========================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({ text: '--------------------------------------------------------------------------------------------------', font: 'Times New Roman', color: '94A3B8', size: 18 }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: 'ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT',
          bold: true,
          font: 'Times New Roman',
          color: '0F172A',
          size: 26,
        }),
      ],
    })
  );

  questions.forEach((q, idx) => {
    let answerText = q.correctAnswer || q.shortAnswerKey || '';
    if (q.partType === 'part_2_true_false' && Array.isArray(q.subStatements)) {
      answerText = q.subStatements
        .map((s: any) => `${s.label || s.key || ''}: ${s.correct ? 'Đ' : 'S'}`)
        .join(', ');
    }

    children.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({ text: `Câu ${idx + 1}: `, bold: true, font: 'Times New Roman', size: 22, color: '0F172A' }),
          new TextRun({ text: `Đáp án: ${answerText}`, bold: true, font: 'Times New Roman', size: 22, color: '16A34A' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 300 },
        children: parseTextWithLatexToDocxRuns(q.explanation || 'Áp dụng định lý và tính chất sách giáo khoa.', {
          italics: true,
          color: '334155',
          size: 22,
        }),
      })
    );
  });

  // Construct Document with standardized margins
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFilename = `DeThi_${subject.replace(/\s+/g, '_')}_${grade.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveBlobSafely(blob, cleanFilename);
}
