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
  ImageRun,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
  MathIntegral,
  MathSum,
  MathLimitLower,
  MathRoundBrackets,
  BuilderElement,
} from 'docx';
import { QuizQuestion } from '../types';
import { saveBlobSafely } from './exportUtils';
import {
  extractEmbeddedDiagramAndCleanText,
  renderVariationTablePng,
  renderSignTablePng,
  renderFunctionGraphPng,
  renderGeometry3DPng,
  renderPracticalIllustrationPng,
  renderPhysicsCircuitPng,
} from './docxDiagramRenderer';

/**
 * Clean and map LaTeX commands and symbols to standard Unicode math symbols for Word OpenXML.
 * Ensures zero raw backslashes (like \sin, \cos, \varphi) leak into exported Word equations.
 */
export function cleanLatexSymbols(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\\\/g, ' ')
    .replace(/\\displaystyle\b|\\textstyle\b|\\scriptstyle\b|\\limits\b|\\nolimits\b/g, '')
    .replace(/\\(?:left|right)\s*\./g, '')
    .replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*([(\[{|<⟩⟩\]}|])/g, '$1')
    .replace(/\\langle\b/g, '⟨')
    .replace(/\\rangle\b/g, '⟩')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\Gamma\b/g, 'Γ')
    .replace(/\\Sigma\b/g, 'Σ')
    .replace(/\\Pi\b/g, 'Π')
    .replace(/\\Phi\b/g, 'Φ')
    .replace(/\\Psi\b/g, 'Ψ')
    .replace(/\\Omega\b/g, 'Ω')
    .replace(/\\Lambda\b/g, 'Λ')
    .replace(/\\Theta\b/g, 'Θ')
    .replace(/\\in\b/g, '∈')
    .replace(/\\notin\b/g, '∉')
    .replace(/\\ni\b/g, '∋')
    .replace(/\\subset\b/g, '⊂')
    .replace(/\\subseteq\b/g, '⊆')
    .replace(/\\supset\b/g, '⊃')
    .replace(/\\supseteq\b/g, '⊇')
    .replace(/\\cup\b/g, '∪')
    .replace(/\\cap\b/g, '∩')
    .replace(/\\(?:le|leq|leqslant)\b/g, '≤')
    .replace(/\\(?:ge|geq|geqslant)\b/g, '≥')
    .replace(/\\(?:ne|neq)\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\simeq\b/g, '≃')
    .replace(/\\cong\b/g, '≅')
    .replace(/\\sim\b/g, '∼')
    .replace(/\\propto\b/g, '∝')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\div\b/g, '÷')
    .replace(/\\perp\b/g, '⟂')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\measuredangle\b/g, '∡')
    .replace(/\\sphericalangle\b/g, '∢')
    .replace(/\\triangle\b/g, '△')
    .replace(/\\square\b/g, '□')
    .replace(/\\odot\b/g, '⊙')
    .replace(/\\(?:to|rightarrow|longrightarrow)\b/g, '→')
    .replace(/\\(?:leftarrow|longleftarrow)\b/g, '←')
    .replace(/\\(?:leftrightarrow|longleftrightarrow)\b/g, '↔')
    .replace(/\\(?:Rightarrow|Longrightarrow)\b/g, '⇒')
    .replace(/\\(?:Leftarrow|Longleftarrow)\b/g, '⇐')
    .replace(/\\(?:Leftrightarrow|Longleftrightarrow|iff)\b/g, '⇔')
    .replace(/\\mapsto\b/g, '↦')
    .replace(/\\forall\b/g, '∀')
    .replace(/\\exists\b/g, '∃')
    .replace(/\\nexists\b/g, '∄')
    .replace(/\\(?:neg|lnot)\b/g, '¬')
    .replace(/\\land\b/g, '∧')
    .replace(/\\lor\b/g, '∨')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\(?:epsilon|varepsilon)\b/g, 'ε')
    .replace(/\\zeta\b/g, 'ζ')
    .replace(/\\eta\b/g, 'η')
    .replace(/\\(?:theta|vartheta)\b/g, 'θ')
    .replace(/\\iota\b/g, 'ι')
    .replace(/\\kappa\b/g, 'κ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\nu\b/g, 'ν')
    .replace(/\\xi\b/g, 'ξ')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\rho\b/g, 'ρ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\tau\b/g, 'τ')
    .replace(/\\upsilon\b/g, 'υ')
    .replace(/\\(?:phi|varphi)\b/g, 'φ')
    .replace(/\\chi\b/g, 'χ')
    .replace(/\\psi\b/g, 'ψ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\mathbb\{R\}|\\mathbf\{R\}|\\mathbb\s+R/g, 'ℝ')
    .replace(/\\mathbb\{Z\}|\\mathbb\s+Z/g, 'ℤ')
    .replace(/\\mathbb\{N\}|\\mathbb\s+N/g, 'ℕ')
    .replace(/\\mathbb\{Q\}|\\mathbb\s+Q/g, 'ℚ')
    .replace(/\\mathbb\{C\}|\\mathbb\s+C/g, 'ℂ')
    .replace(/\\(?:emptyset|varnothing)\b/g, '∅')
    .replace(/\^\s*\{\s*\\circ\s*\}|\^\\circ|\\degree\b|\\circ\b/g, '°')
    .replace(/\\prime\b/g, '′')
    .replace(/\\(?:ldots|dots|cdots|vdots)\b/g, '…')
    .replace(/\\setminus\b/g, '\\')
    .replace(
      /\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|lg|exp|lim|max|min|sup|inf|det|deg|mod|gcd|lcm|arg)\b/g,
      '$1 '
    )
    .replace(/\\(?:vec|overrightarrow)\{([^}]+)\}/g, '$1⃗')
    .replace(/\\(?:vec|overrightarrow)\s+([a-zA-Z0-9']+)/g, '$1⃗')
    .replace(/\\(?:widehat|hat)\{([^}]+)\}/g, '$1̂')
    .replace(/\\(?:widehat|hat)\s+([a-zA-Z0-9']+)/g, '$1̂')
    .replace(/\\(?:overline|bar)\{([^}]+)\}/g, '$1̄')
    .replace(/\\(?:overline|bar)\s+([a-zA-Z0-9']+)/g, '$1̄')
    .replace(/\\(?:widetilde|tilde)\{([^}]+)\}/g, '$1̃')
    .replace(/\\quad\b/g, '  ')
    .replace(/\\qquad\b/g, '    ')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\\([{}%&$#_])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ');
}

type DocxMathChild =
  | MathRun
  | MathFraction
  | MathSuperScript
  | MathSubScript
  | MathSubSuperScript
  | MathRadical
  | MathIntegral
  | MathSum
  | MathLimitLower
  | MathRoundBrackets
  | BuilderElement
  | any;

interface ScriptMeta {
  base: DocxMathChild[];
  sub?: DocxMathChild[];
  sup?: DocxMathChild[];
}

/**
 * Creates a native Word OMML <m:acc> accent element (vector arrow →, hat ^, overline ¯, tilde ~)
 */
export function createMathAccent(accentChar: string, innerNodes: DocxMathChild[]): BuilderElement {
  return new BuilderElement({
    name: 'm:acc',
    children: [
      new BuilderElement({
        name: 'm:accPr',
        children: [
          new BuilderElement({
            name: 'm:chr',
            attributes: {
              val: { key: 'm:val', value: accentChar },
            },
          }),
        ],
      }),
      new BuilderElement({
        name: 'm:e',
        children: innerNodes.length > 0 ? innerNodes : [new MathRun('')],
      }),
    ],
  });
}

/**
 * Creates a native Word OMML delimited matrix (<m:d> containing <m:m>) for cases, pmatrix, bmatrix, vmatrix, aligned
 */
function createMathMatrixOrCases(
  rows: DocxMathChild[][][],
  begChr: string,
  endChr: string
): BuilderElement {
  const mRows = rows.map(
    (cols) =>
      new BuilderElement({
        name: 'm:mr',
        children: cols.map(
          (cellChildren) =>
            new BuilderElement({
              name: 'm:e',
              children: cellChildren.length > 0 ? cellChildren : [new MathRun('')],
            })
        ),
      })
  );

  const matrixEl = new BuilderElement({
    name: 'm:m',
    children: mRows,
  });

  if (!begChr && !endChr) {
    return matrixEl;
  }

  return new BuilderElement({
    name: 'm:d',
    children: [
      new BuilderElement({
        name: 'm:dPr',
        children: [
          new BuilderElement({
            name: 'm:begChr',
            attributes: { val: { key: 'm:val', value: begChr } },
          }),
          new BuilderElement({
            name: 'm:endChr',
            attributes: { val: { key: 'm:val', value: endChr } },
          }),
        ],
      }),
      new BuilderElement({
        name: 'm:e',
        children: [matrixEl],
      }),
    ],
  });
}

/**
 * Creates a custom n-ary operator (e.g. \iint, \oint, \prod) using OpenXML <m:nary>
 */
function createCustomNary(
  chr: string,
  subNodes: DocxMathChild[] | undefined,
  supNodes: DocxMathChild[] | undefined,
  bodyNodes: DocxMathChild[] = [new MathRun('')]
): BuilderElement {
  return new BuilderElement({
    name: 'm:nary',
    children: [
      new BuilderElement({
        name: 'm:naryPr',
        children: [
          new BuilderElement({
            name: 'm:chr',
            attributes: { val: { key: 'm:val', value: chr } },
          }),
          new BuilderElement({
            name: 'm:limLoc',
            attributes: { val: { key: 'm:val', value: 'subSup' } },
          }),
        ],
      }),
      new BuilderElement({
        name: 'm:sub',
        children: subNodes && subNodes.length > 0 ? subNodes : [],
      }),
      new BuilderElement({
        name: 'm:sup',
        children: supNodes && supNodes.length > 0 ? supNodes : [],
      }),
      new BuilderElement({
        name: 'm:e',
        children: bodyNodes.length > 0 ? bodyNodes : [new MathRun('')],
      }),
    ],
  });
}

/**
 * Recursively parses LaTeX formulas into native docx.Math components.
 * Supports fractions, binomials, nested radicals, integrals, sums, products, limits,
 * vector/hat/overline accents, combined sub+superscripts (C_n^k, x_1^2),
 * piecewise cases (\begin{cases}), matrices, degree signs, and Greek/math symbols.
 */
export function parseLatexNodes(raw: string): DocxMathChild[] {
  let src = (raw || '').trim();
  if (!src) return [];

  // Pre-normalize Unicode accents and formatting hints
  src = src
    .replace(/\\displaystyle\b|\\textstyle\b|\\limits\b|\\nolimits\b/g, '')
    .replace(/([a-zA-Z0-9']+)[⃗\u20D7]/g, '\\overrightarrow{$1}')
    .replace(/([a-zA-Z0-9']+)̂/g, '\\widehat{$1}')
    .replace(/([a-zA-Z0-9']+)̄/g, '\\overline{$1}')
    .replace(/\^\s*\{\s*\\circ\s*\}|\^\\circ/g, '°');

  const nodes: DocxMathChild[] = [];
  const scriptMeta = new WeakMap<object, ScriptMeta>();
  let i = 0;

  function skipSpaces(str: string, idx: number): number {
    while (idx < str.length && (str[idx] === ' ' || str[idx] === '\t' || str[idx] === '\n')) idx++;
    return idx;
  }

  function readGroup(str: string, startIdx: number): { text: string; nextIdx: number } {
    const start = skipSpaces(str, startIdx);
    if (start >= str.length) return { text: '', nextIdx: str.length };

    if (str[start] !== '{' && str[start] !== '[') {
      // Check if it's a single LaTeX command like \infty or \pi
      if (str[start] === '\\') {
        let cmdEnd = start + 1;
        while (cmdEnd < str.length && /[a-zA-Z]/.test(str[cmdEnd])) cmdEnd++;
        return { text: str.slice(start, Math.max(start + 2, cmdEnd)), nextIdx: Math.max(start + 2, cmdEnd) };
      }
      // Single character / token for superscript/subscript/accent like x^2 or A_1
      return { text: str[start], nextIdx: start + 1 };
    }

    const openChar = str[start];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 1;
    let idx = start + 1;
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

  function readOptionalSubSup(str: string, startIdx: number): { sub?: string; sup?: string; nextIdx: number } {
    let idx = skipSpaces(str, startIdx);
    let sub: string | undefined;
    let sup: string | undefined;

    for (let pass = 0; pass < 2; pass++) {
      idx = skipSpaces(str, idx);
      if (str[idx] === '_' && sub === undefined) {
        const g = readGroup(str, idx + 1);
        sub = g.text;
        idx = g.nextIdx;
      } else if (str[idx] === '^' && sup === undefined) {
        const g = readGroup(str, idx + 1);
        sup = g.text;
        idx = g.nextIdx;
      } else {
        break;
      }
    }
    return { sub, sup, nextIdx: idx };
  }

  const startsCommand = (str: string, idx: number, cmd: string): boolean => {
    if (!str.startsWith(cmd, idx)) return false;
    const nextChar = str[idx + cmd.length];
    return !nextChar || !/[a-zA-Z]/.test(nextChar);
  };

  while (i < src.length) {
    // 0. Environments: \begin{cases|pmatrix|bmatrix|vmatrix|matrix|aligned}...\end{...}
    if (src.startsWith('\\begin{', i)) {
      const envMatch = src.slice(i).match(/^\\begin\{(cases|pmatrix|bmatrix|vmatrix|Vmatrix|matrix|aligned|align\*?)\}([\s\S]*?)\\end\{\1\}/);
      if (envMatch) {
        const envName = envMatch[1];
        const envBody = envMatch[2];
        i += envMatch[0].length;

        const rawLines = envBody
          .split(/\\\\/g)
          .map((l) => l.trim())
          .filter(Boolean);
        const parsedMatrix: DocxMathChild[][][] = rawLines.map((line) =>
          line.split('&').map((cell) => parseLatexNodes(cell.trim()))
        );

        let begChr = '';
        let endChr = '';
        if (envName === 'cases') {
          begChr = '{';
          endChr = '';
        } else if (envName === 'pmatrix') {
          begChr = '(';
          endChr = ')';
        } else if (envName === 'bmatrix') {
          begChr = '[';
          endChr = ']';
        } else if (envName === 'vmatrix' || envName === 'Vmatrix') {
          begChr = '|';
          endChr = '|';
        }
        nodes.push(createMathMatrixOrCases(parsedMatrix, begChr, endChr));
        continue;
      }
    }

    // 1. Fractions: \frac, \dfrac, \tfrac, \cfrac
    if (
      startsCommand(src, i, '\\frac') ||
      startsCommand(src, i, '\\dfrac') ||
      startsCommand(src, i, '\\tfrac') ||
      startsCommand(src, i, '\\cfrac')
    ) {
      const cmdLen = startsCommand(src, i, '\\frac') ? 5 : 6;
      i += cmdLen;
      const numG = readGroup(src, i);
      const denG = readGroup(src, numG.nextIdx);
      i = denG.nextIdx;

      nodes.push(
        new MathFraction({
          numerator: parseLatexNodes(numG.text),
          denominator: parseLatexNodes(denG.text),
        })
      );
      continue;
    }

    // 2. Binomials: \binom{n}{k}, \dbinom, \tbinom
    if (startsCommand(src, i, '\\binom') || startsCommand(src, i, '\\dbinom') || startsCommand(src, i, '\\tbinom')) {
      const cmdLen = startsCommand(src, i, '\\binom') ? 6 : 7;
      i += cmdLen;
      const topG = readGroup(src, i);
      const botG = readGroup(src, topG.nextIdx);
      i = botG.nextIdx;

      const noBarFrac = new BuilderElement({
        name: 'm:f',
        children: [
          new BuilderElement({
            name: 'm:fPr',
            children: [
              new BuilderElement({
                name: 'm:type',
                attributes: { val: { key: 'm:val', value: 'noBar' } },
              }),
            ],
          }),
          new BuilderElement({ name: 'm:num', children: parseLatexNodes(topG.text) }),
          new BuilderElement({ name: 'm:den', children: parseLatexNodes(botG.text) }),
        ],
      });
      nodes.push(new MathRoundBrackets({ children: [noBarFrac] }));
      continue;
    }

    // 3. Radicals: \sqrt{x} or \sqrt[n]{x}
    if (startsCommand(src, i, '\\sqrt')) {
      i += 5;
      let idx = skipSpaces(src, i);
      let degreeNodes: DocxMathChild[] | undefined;
      if (src[idx] === '[') {
        const degG = readGroup(src, idx);
        degreeNodes = parseLatexNodes(degG.text);
        idx = degG.nextIdx;
      }
      const radG = readGroup(src, idx);
      i = radG.nextIdx;

      nodes.push(
        new MathRadical({
          degree: degreeNodes,
          children: parseLatexNodes(radG.text),
        })
      );
      continue;
    }

    // 4. Integrals: \int, \iint, \oint
    if (
      startsCommand(src, i, '\\int') ||
      startsCommand(src, i, '\\iint') ||
      startsCommand(src, i, '\\oint')
    ) {
      const isDouble = startsCommand(src, i, '\\iint');
      const isContour = startsCommand(src, i, '\\oint');
      i += isDouble || isContour ? 5 : 4;
      const lim = readOptionalSubSup(src, i);
      i = lim.nextIdx;
      const subNodes = lim.sub !== undefined ? parseLatexNodes(lim.sub) : undefined;
      const supNodes = lim.sup !== undefined ? parseLatexNodes(lim.sup) : undefined;

      if (isDouble || isContour) {
        nodes.push(createCustomNary(isDouble ? '∬' : '∮', subNodes, supNodes, []));
      } else {
        nodes.push(
          new MathIntegral({
            subScript: subNodes,
            superScript: supNodes,
            children: [],
          })
        );
      }
      continue;
    }

    // 5. Sums & Products: \sum, \prod
    if (startsCommand(src, i, '\\sum') || startsCommand(src, i, '\\prod')) {
      const isProd = startsCommand(src, i, '\\prod');
      i += isProd ? 5 : 4;
      const lim = readOptionalSubSup(src, i);
      i = lim.nextIdx;
      const subNodes = lim.sub !== undefined ? parseLatexNodes(lim.sub) : undefined;
      const supNodes = lim.sup !== undefined ? parseLatexNodes(lim.sup) : undefined;

      if (isProd) {
        nodes.push(createCustomNary('∏', subNodes, supNodes, []));
      } else {
        nodes.push(
          new MathSum({
            subScript: subNodes,
            superScript: supNodes,
            children: [],
          })
        );
      }
      continue;
    }

    // 6. Limits: \lim_{...}
    if (startsCommand(src, i, '\\lim')) {
      i += 4;
      const idx = skipSpaces(src, i);
      if (src[idx] === '_') {
        const limG = readGroup(src, idx + 1);
        i = limG.nextIdx;
        nodes.push(
          new MathLimitLower({
            children: [new MathRun('lim')],
            limit: parseLatexNodes(limG.text),
          })
        );
      } else {
        nodes.push(new MathRun('lim '));
      }
      continue;
    }

    // 7. Accents: vector, hat, overline, tilde
    if (
      startsCommand(src, i, '\\overrightarrow') ||
      startsCommand(src, i, '\\vec') ||
      startsCommand(src, i, '\\widehat') ||
      startsCommand(src, i, '\\hat') ||
      startsCommand(src, i, '\\overline') ||
      startsCommand(src, i, '\\bar') ||
      startsCommand(src, i, '\\widetilde') ||
      startsCommand(src, i, '\\tilde')
    ) {
      let cmd = '\\vec';
      let accentChar = '→';
      if (startsCommand(src, i, '\\overrightarrow')) {
        cmd = '\\overrightarrow';
        accentChar = '→';
      } else if (startsCommand(src, i, '\\vec')) {
        cmd = '\\vec';
        accentChar = '→';
      } else if (startsCommand(src, i, '\\widehat')) {
        cmd = '\\widehat';
        accentChar = '^';
      } else if (startsCommand(src, i, '\\hat')) {
        cmd = '\\hat';
        accentChar = '^';
      } else if (startsCommand(src, i, '\\overline')) {
        cmd = '\\overline';
        accentChar = '¯';
      } else if (startsCommand(src, i, '\\bar')) {
        cmd = '\\bar';
        accentChar = '¯';
      } else if (startsCommand(src, i, '\\widetilde')) {
        cmd = '\\widetilde';
        accentChar = '~';
      } else if (startsCommand(src, i, '\\tilde')) {
        cmd = '\\tilde';
        accentChar = '~';
      }

      i += cmd.length;
      const argG = readGroup(src, i);
      i = argG.nextIdx;
      nodes.push(createMathAccent(accentChar, parseLatexNodes(argG.text)));
      continue;
    }

    // 8. Font / text wrappers with brace groups: \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \operatorname{...}
    if (
      startsCommand(src, i, '\\text') ||
      startsCommand(src, i, '\\mathrm') ||
      startsCommand(src, i, '\\mathbf') ||
      startsCommand(src, i, '\\mathit') ||
      startsCommand(src, i, '\\operatorname')
    ) {
      const m = src.slice(i).match(/^\\(?:text|mathrm|mathbf|mathit|operatorname)/);
      const cmdLen = m ? m[0].length : 5;
      i += cmdLen;
      const textG = readGroup(src, i);
      i = textG.nextIdx;
      const cleanedText = cleanLatexSymbols(textG.text);
      if (cleanedText) nodes.push(new MathRun(cleanedText));
      continue;
    }

    // 9. Standalone brace groups `{...}` (when not attached to a command)
    if (src[i] === '{') {
      const g = readGroup(src, i);
      i = g.nextIdx;
      const inner = parseLatexNodes(g.text);
      nodes.push(...inner);
      continue;
    }

    // 10. Superscripts: base^{exp} or base^2 (supports combining with prior subscript)
    if (src[i] === '^' && nodes.length > 0) {
      i++;
      const expG = readGroup(src, i);
      i = expG.nextIdx;
      const supNodes = parseLatexNodes(expG.text);
      const prevNode = nodes.pop()!;
      const existingMeta = scriptMeta.get(prevNode as object);

      if (existingMeta && existingMeta.sub && !existingMeta.sup) {
        const combined = new MathSubSuperScript({
          children: existingMeta.base,
          subScript: existingMeta.sub,
          superScript: supNodes,
        });
        scriptMeta.set(combined, { base: existingMeta.base, sub: existingMeta.sub, sup: supNodes });
        nodes.push(combined);
      } else {
        const base = [prevNode];
        const supEl = new MathSuperScript({
          children: base,
          superScript: supNodes,
        });
        scriptMeta.set(supEl, { base, sup: supNodes });
        nodes.push(supEl);
      }
      continue;
    }

    // 11. Subscripts: base_{sub} or base_1 (supports combining with prior superscript e.g. C^k_n)
    if (src[i] === '_' && nodes.length > 0) {
      i++;
      const subG = readGroup(src, i);
      i = subG.nextIdx;
      const subNodes = parseLatexNodes(subG.text);
      const prevNode = nodes.pop()!;
      const existingMeta = scriptMeta.get(prevNode as object);

      if (existingMeta && existingMeta.sup && !existingMeta.sub) {
        const combined = new MathSubSuperScript({
          children: existingMeta.base,
          subScript: subNodes,
          superScript: existingMeta.sup,
        });
        scriptMeta.set(combined, { base: existingMeta.base, sub: subNodes, sup: existingMeta.sup });
        nodes.push(combined);
      } else {
        const base = [prevNode];
        const subEl = new MathSubScript({
          children: base,
          subScript: subNodes,
        });
        scriptMeta.set(subEl, { base, sub: subNodes });
        nodes.push(subEl);
      }
      continue;
    }

    // 12. Regular symbols / identifiers / operators / numbers
    const start = i;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '^' || ch === '_' || ch === '{') break;
      if (ch === '\\') {
        if (
          src.startsWith('\\begin{', i) ||
          startsCommand(src, i, '\\frac') ||
          startsCommand(src, i, '\\dfrac') ||
          startsCommand(src, i, '\\tfrac') ||
          startsCommand(src, i, '\\cfrac') ||
          startsCommand(src, i, '\\binom') ||
          startsCommand(src, i, '\\dbinom') ||
          startsCommand(src, i, '\\tbinom') ||
          startsCommand(src, i, '\\sqrt') ||
          startsCommand(src, i, '\\int') ||
          startsCommand(src, i, '\\iint') ||
          startsCommand(src, i, '\\oint') ||
          startsCommand(src, i, '\\sum') ||
          startsCommand(src, i, '\\prod') ||
          startsCommand(src, i, '\\lim') ||
          startsCommand(src, i, '\\overrightarrow') ||
          startsCommand(src, i, '\\vec') ||
          startsCommand(src, i, '\\widehat') ||
          startsCommand(src, i, '\\hat') ||
          startsCommand(src, i, '\\overline') ||
          startsCommand(src, i, '\\bar') ||
          startsCommand(src, i, '\\widetilde') ||
          startsCommand(src, i, '\\tilde') ||
          startsCommand(src, i, '\\text') ||
          startsCommand(src, i, '\\mathrm') ||
          startsCommand(src, i, '\\mathbf') ||
          startsCommand(src, i, '\\mathit') ||
          startsCommand(src, i, '\\operatorname')
        ) {
          break;
        }
        // Advance past this symbol command (\alpha, \le, \sin, etc.) cleanly so script attachment binds to the symbol
        let cmdEnd = i + 1;
        while (cmdEnd < src.length && /[a-zA-Z]/.test(src[cmdEnd])) cmdEnd++;
        if (cmdEnd === i + 1 && cmdEnd < src.length) cmdEnd++; // escaped char like \{ or \,
        i = cmdEnd;
        // Stop right before subscript/superscript/brace or keep accumulating unless followed by _/^
        if (src[i] === '^' || src[i] === '_') break;
      } else {
        // If next char is ^ or _, flush multi-char prefix so ONLY the last character/identifier becomes the base of ^ or _
        if ((src[i + 1] === '^' || src[i + 1] === '_') && i > start) {
          // If accumulating letters of a variable/digit before script, split before current char
          const prevChunk = cleanLatexSymbols(src.slice(start, i));
          if (prevChunk) nodes.push(new MathRun(prevChunk));
          nodes.push(new MathRun(ch));
          i++;
          break;
        }
        i++;
      }
    }

    if (i > start) {
      const rawChunk = src.slice(start, i);
      // If we just split single-char script base inside loop above, don't double-emit
      if (!(rawChunk.length > 1 && (src[i] === '^' || src[i] === '_') && rawChunk.slice(-1) !== '}')) {
        const cleanChunk = cleanLatexSymbols(rawChunk);
        if (cleanChunk) {
          nodes.push(new MathRun(cleanChunk));
        }
      }
    } else if (i === start) {
      i++;
    }
  }

  return nodes.length > 0 ? nodes : [new MathRun(cleanLatexSymbols(src))];
}

/**
 * Convert LaTeX mathematical formulas into a native docx.Math component (<m:oMath>).
 * Guarantees valid OpenXML that Microsoft Word opens cleanly without repair errors.
 */
export function convertLatexToDocxMath(latex: string): DocxMath {
  let src = (latex || '').trim();

  if (src.startsWith('$$') && src.endsWith('$$') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  } else if (src.startsWith('$') && src.endsWith('$') && src.length >= 2) {
    src = src.slice(1, -1).trim();
  } else if (src.startsWith('\\(') && src.endsWith('\\)') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  } else if (src.startsWith('\\[') && src.endsWith('\\]') && src.length >= 4) {
    src = src.slice(2, -2).trim();
  }

  src = src
    .replace(/\\vec\s*\{([^}]+)\}/g, '\\overrightarrow{$1}')
    .replace(/\\vec\s+([a-zA-Z0-9']+)/g, '\\overrightarrow{$1}');

  try {
    const children = parseLatexNodes(src);
    return new DocxMath({
      children: children.length > 0 ? children : [new MathRun(cleanLatexSymbols(src))],
    });
  } catch {
    return new DocxMath({ children: [new MathRun(cleanLatexSymbols(src))] });
  }
}

/**
 * Splits mixed text/LaTeX segments respecting delimiters $$...$$, $...$, \(...\), \[...\],
 * without breaking on escaped \$ or nested braces inside math.
 */
function splitMixedLatexSegments(input: string): Array<{ type: 'math' | 'text'; value: string }> {
  const segments: Array<{ type: 'math' | 'text'; value: string }> = [];
  let i = 0;
  let textStart = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\' && input[i + 1] === '$') {
      i += 2;
      continue;
    }
    if (ch === '$' && input[i + 1] === '$') {
      const closeIdx = input.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        if (i > textStart) segments.push({ type: 'text', value: input.slice(textStart, i) });
        segments.push({ type: 'math', value: input.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    } else if (ch === '$') {
      let closeIdx = i + 1;
      while (closeIdx < input.length) {
        if (input[closeIdx] === '$' && input[closeIdx - 1] !== '\\') break;
        closeIdx++;
      }
      if (closeIdx < input.length && closeIdx > i + 1) {
        if (i > textStart) segments.push({ type: 'text', value: input.slice(textStart, i) });
        segments.push({ type: 'math', value: input.slice(i, closeIdx + 1) });
        i = closeIdx + 1;
        textStart = i;
        continue;
      }
    } else if (input.startsWith('\\(', i)) {
      const closeIdx = input.indexOf('\\)', i + 2);
      if (closeIdx !== -1) {
        if (i > textStart) segments.push({ type: 'text', value: input.slice(textStart, i) });
        segments.push({ type: 'math', value: input.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    } else if (input.startsWith('\\[', i)) {
      const closeIdx = input.indexOf('\\]', i + 2);
      if (closeIdx !== -1) {
        if (i > textStart) segments.push({ type: 'text', value: input.slice(textStart, i) });
        segments.push({ type: 'math', value: input.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }
    i++;
  }

  if (textStart < input.length) {
    segments.push({ type: 'text', value: input.slice(textStart) });
  }
  return segments;
}

/**
 * Wraps isolated unwrapped LaTeX commands (supporting nested braces!) into $...$
 */
function wrapUnwrappedLatexCommands(text: string): string {
  const cmds = ['\\overrightarrow', '\\vec', '\\widehat', '\\hat', '\\overline', '\\bar', '\\dfrac', '\\frac', '\\binom', '\\sqrt'];
  let out = '';
  let i = 0;

  const readBalancedBrace = (s: string, start: number): number => {
    let idx = start;
    while (idx < s.length && s[idx] === ' ') idx++;
    if (s[idx] === '[') {
      let d = 1;
      idx++;
      while (idx < s.length && d > 0) {
        if (s[idx] === '[') d++;
        else if (s[idx] === ']') d--;
        idx++;
      }
      while (idx < s.length && s[idx] === ' ') idx++;
    }
    if (s[idx] !== '{') return -1;
    let depth = 1;
    idx++;
    while (idx < s.length && depth > 0) {
      if (s[idx] === '{' && s[idx - 1] !== '\\') depth++;
      else if (s[idx] === '}' && s[idx - 1] !== '\\') depth--;
      idx++;
    }
    return idx;
  };

  while (i < text.length) {
    const matchedCmd = cmds.find((c) => text.startsWith(c, i));
    if (matchedCmd) {
      const firstEnd = readBalancedBrace(text, i + matchedCmd.length);
      if (firstEnd !== -1) {
        let totalEnd = firstEnd;
        if (matchedCmd === '\\frac' || matchedCmd === '\\dfrac' || matchedCmd === '\\binom') {
          const secondEnd = readBalancedBrace(text, firstEnd);
          if (secondEnd !== -1) totalEnd = secondEnd;
        }
        out += `$${text.slice(i, totalEnd)}$`;
        i = totalEnd;
        continue;
      }
    }
    out += text[i];
    i++;
  }

  return out.replace(/([A-Z]{1,3}[']?[⃗\u20D7])/g, '$$$1$$');
}

/**
 * Parses a string containing mixed plain text and LaTeX formulas ($...$, $$...$$, \(...\), \[...\])
 * into native docx TextRuns and DocxMath components.
 */
export function parseTextWithLatexToDocxRuns(
  text: string,
  baseOptions: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}
): (TextRun | DocxMath)[] {
  if (!text) return [];

  let cleanInput = text
    .replace(/^#+\s+/gm, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();

  const hasDelimiters = /(?<!\\)\$|\\\(|\\\[/.test(cleanInput);
  if (!hasDelimiters) {
    const isFormulaOnly =
      /(\\vec|\\overrightarrow|\\widehat|\\hat|\\frac|\\dfrac|\\sqrt|\\int|\\sum|\\lim|[A-Za-z0-9']+⃗|[A-Za-z0-9']+\u20D7)/.test(
        cleanInput
      ) ||
      (/^[a-zA-Z0-9\s()',.+\-*=/\\_^{}≤≥±∓×÷·|∈∉⊂⊆∪∩≠≈≡→⇒⇔∀∃α-ωΑ-Ω°]+$/.test(cleanInput) &&
        /[=<>≤≥±∓×÷·^_\\∈∉⊂⊆∪∩≠]/.test(cleanInput));

    if (isFormulaOnly) {
      cleanInput = `$${cleanInput}$`;
    } else {
      cleanInput = wrapUnwrappedLatexCommands(cleanInput);
    }
  }

  const runs: (TextRun | DocxMath)[] = [];
  const parts = splitMixedLatexSegments(cleanInput);

  for (const part of parts) {
    if (!part.value) continue;

    if (part.type === 'math') {
      try {
        runs.push(convertLatexToDocxMath(part.value));
      } catch {
        const fallbackText = cleanLatexSymbols(part.value.replace(/^\$+|\$+$/g, '').trim());
        runs.push(
          new TextRun({
            text: fallbackText,
            font: 'Times New Roman',
            bold: baseOptions.bold,
            italics: true,
            color: baseOptions.color || '1E293B',
            size: baseOptions.size || 24,
          })
        );
      }
    } else {
      // Handle escaped \$ and clean Markdown bold **...** & simple italics *...*
      const cleanPlain = part.value.replace(/\\\$/g, '$');
      const boldSegments = cleanPlain.split(/(\*\*[\s\S]+?\*\*)/g);
      for (const seg of boldSegments) {
        if (!seg) continue;
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
          runs.push(
            new TextRun({
              text: seg.slice(2, -2),
              font: 'Times New Roman',
              bold: true,
              italics: baseOptions.italics,
              color: baseOptions.color || '0F172A',
              size: baseOptions.size || 24,
            })
          );
        } else {
          // Strip simple single-asterisk emphasis like *chú ý* cleanly
          const deStarred = seg.replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?)]|$)/g, '$1$2');
          runs.push(
            new TextRun({
              text: deStarred,
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
 * Fallback OpenXML Table for Variation Table (used only if Canvas is unavailable e.g. headless Node)
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

  const xCells: TableCell[] = [
    new TableCell({
      width: { size: 1200, type: WidthType.DXA },
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

  const yPrimeCells: TableCell[] = [
    new TableCell({
      width: { size: 1200, type: WidthType.DXA },
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
    ...yPrimeVals.slice(0, Math.max(xVals.length, yPrimeVals.length)).map((sign) => {
      const isAsymptote = sign.trim() === '||' || sign.trim() === '|';
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

  const yCells: TableCell[] = [
    new TableCell({
      width: { size: 1200, type: WidthType.DXA },
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
      return new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              ...parseTextWithLatexToDocxRuns(`$${String(arr.start || '').replace(/^\$+|\$+$/g, '')}$`, { size: 22 }),
              new TextRun({
                text: isUp ? ' ↗ ' : ' ↘ ',
                font: 'Times New Roman',
                bold: true,
                color: isUp ? 'DC2626' : '2563EB',
                size: 24,
              }),
              ...parseTextWithLatexToDocxRuns(`$${String(arr.end || '').replace(/^\$+|\$+$/g, '')}$`, {
                bold: true,
                size: 22,
              }),
            ],
          }),
        ],
      });
    }),
  ];

  return new Table({
    width: { size: 95, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ children: xCells }),
      new TableRow({ children: yPrimeCells }),
      new TableRow({ children: yCells }),
    ],
  });
}

/**
 * Fallback OpenXML Table for Sign Table (used if Canvas is unavailable)
 */
export function createDocxSignTable(diagramData: any): Table {
  const xVals: string[] = diagramData?.x || ['-\\infty', '-2', '3', '+\\infty'];
  const rows: any[] = diagramData?.rows || [{ label: "f'(x)", signs: ['+', '0', '-', '0', '+'] }];

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
            children: parseTextWithLatexToDocxRuns(r.label || "f'(x)", { bold: true, italics: true, size: 22 }),
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
    width: { size: 95, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [new TableRow({ children: xCells }), ...dataRows],
  });
}

/**
 * Publication-grade OpenXML Table for Statistics & Data Tables (Bảng thống kê, tần số, số liệu).
 * Supports full OMML math inside every header and data cell.
 */
export function createDocxDataTable(diagramData: any): Table {
  const headers: string[] = diagramData?.headers || ['Cột 1', 'Cột 2'];
  const rows: string[][] = diagramData?.tableRows || diagramData?.rows || [];

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '334155' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '334155' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '334155' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '334155' },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
          verticalAlign: VerticalAlign.CENTER,
          borders: cellBorder,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: parseTextWithLatexToDocxRuns(String(h), { bold: true, size: 22, color: '0F172A' }),
            }),
          ],
        })
    ),
  });

  const bodyRows = rows.map((row, rIdx) => {
    const cells = headers.map((_, cIdx) => {
      const val = row[cIdx] !== undefined ? String(row[cIdx]) : '';
      return new TableCell({
        shading: rIdx % 2 === 1 ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorder,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: parseTextWithLatexToDocxRuns(val, { size: 22, bold: cIdx === 0 }),
          }),
        ],
      });
    });
    return new TableRow({ children: cells });
  });

  return new Table({
    width: { size: 95, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [headerRow, ...bodyRows],
  });
}

/**
 * Helper to wrap a rendered PNG into a centered Docx ImageRun Paragraph
 */
function createCenteredDiagramImageParagraph(
  png: { pngBytes: Uint8Array; width: number; height: number },
  caption?: string
): Paragraph[] {
  const list: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: caption ? 40 : 120 },
      children: [
        new ImageRun({
          type: 'png',
          data: png.pngBytes,
          transformation: {
            width: png.width,
            height: png.height,
          },
        }),
      ],
    }),
  ];

  if (caption) {
    list.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: caption,
            font: 'Times New Roman',
            italics: true,
            size: 20,
            color: '475569',
          }),
        ],
      })
    );
  }
  return list;
}

/**
 * Creates OpenXML Table for Part II True/False sub-statements
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
 * Resolves diagram type/data (either explicit q.diagramType or extracted from Markdown/LaTeX/keywords in q.question)
 * and renders crisp SGK visual diagrams (PNG ImageRun) or native OpenXML Tables.
 */
function resolveAndRenderQuestionContentAndDiagram(
  q: QuizQuestion
): { cleanQuestionText: string; diagramElements: (Paragraph | Table)[] } {
  const extracted = extractEmbeddedDiagramAndCleanText(q.question || '');
  const cleanQuestionText = q.diagramType ? q.question || '' : extracted.cleanContent;
  const diagramType = q.diagramType || extracted.detectedType;
  const diagramData: any = q.diagramData || extracted.detectedData;

  const elements: (Paragraph | Table)[] = [];
  if (!diagramType || !diagramData) {
    return { cleanQuestionText, diagramElements: elements };
  }

  if (diagramType === 'variation_table') {
    const png = renderVariationTablePng(diagramData);
    if (png) {
      elements.push(...createCenteredDiagramImageParagraph(png));
    } else {
      elements.push(createDocxVariationTable(diagramData));
      elements.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    }
  } else if (diagramType === 'sign_table') {
    const png = renderSignTablePng(diagramData);
    if (png) {
      elements.push(...createCenteredDiagramImageParagraph(png));
    } else {
      elements.push(createDocxSignTable(diagramData));
      elements.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    }
  } else if (diagramType === 'data_table') {
    if (diagramData.title) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 40 },
          children: [
            new TextRun({
              text: diagramData.title,
              font: 'Times New Roman',
              bold: true,
              size: 22,
              color: '1E3A8A',
            }),
          ],
        })
      );
    }
    elements.push(createDocxDataTable(diagramData));
    elements.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  } else if (diagramType === 'function_graph') {
    const png = renderFunctionGraphPng(diagramData, q.question || '');
    if (png) {
      elements.push(
        ...createCenteredDiagramImageParagraph(png, 'Hình vẽ: Đồ thị hàm số trên hệ trục tọa độ Oxy')
      );
    } else {
      const graphEq = diagramData.latex || diagramData.equation || diagramData.fn || '';
      elements.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          indent: { left: 400 },
          children: [
            new TextRun({ text: '[Đồ thị hàm số: ', font: 'Times New Roman', italics: true, size: 22, color: '2563EB', bold: true }),
            ...parseTextWithLatexToDocxRuns(graphEq ? `$${graphEq}$` : '(chuẩn SGK)', { size: 22, bold: true }),
            new TextRun({ text: ']', font: 'Times New Roman', italics: true, size: 22, color: '2563EB' }),
          ],
        })
      );
    }
  } else if (diagramType === 'geometry' || diagramType === 'geometry_3d') {
    const png = renderGeometry3DPng(diagramData);
    if (png) {
      elements.push(...createCenteredDiagramImageParagraph(png));
    } else {
      elements.push(
        new Paragraph({
          spacing: { before: 60, after: 80 },
          indent: { left: 400 },
          children: [
            new TextRun({
              text: `[Hình học không gian: ${diagramData.title || 'Minh họa chuẩn SGK'}]`,
              font: 'Times New Roman',
              italics: true,
              size: 22,
              color: '312E81',
            }),
          ],
        })
      );
    }
  } else if (diagramType === 'practical_illustration' || diagramType === 'practical') {
    const png = renderPracticalIllustrationPng(diagramData, q.question || '');
    if (png) {
      elements.push(...createCenteredDiagramImageParagraph(png));
    }
  } else if (diagramType === 'physics_circuit') {
    const png = renderPhysicsCircuitPng(diagramData);
    if (png) {
      elements.push(...createCenteredDiagramImageParagraph(png));
    }
  } else if (diagramType === 'chemistry_diagram' && diagramData.equation) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 80 },
        children: parseTextWithLatexToDocxRuns(`$${diagramData.equation}$`, { size: 23, bold: true }),
      })
    );
  }

  return { cleanQuestionText, diagramElements: elements };
}

/**
 * Constructs a standardized, publication-grade GDPT 2018 Word Document instance.
 */
export function buildExamDocxDocument(params: {
  title?: string;
  subject?: string;
  grade?: string;
  questions: QuizQuestion[];
  teacherName?: string;
  examCode?: string;
}): Document {
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

  const part1Questions = questions.filter((q) => !q.partType || q.partType === 'part_1_choice');
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
                children: [new TextRun({ text: 'SỞ GD&ĐT - TRƯỜNG THPT', bold: true, font: 'Times New Roman', size: 22 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `GIÁO VIÊN: ${teacherName.toUpperCase()}`, font: 'Times New Roman', size: 20 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `Mã đề thi: ${examCode}`, bold: true, font: 'Times New Roman', size: 20, color: '1E3A8A' })],
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
                children: [new TextRun({ text: title.toUpperCase(), bold: true, font: 'Times New Roman', size: 24, color: '1E3A8A' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `Môn: ${subject}  |  Khối: ${grade}`, italics: true, font: 'Times New Roman', size: 20 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Thời gian làm bài: 90 phút (Không kể phát đề)', italics: true, font: 'Times New Roman', size: 18 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(headerTable);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
      children: [
        new TextRun({
          text: '--------------------------------------------------------------------------------------------------',
          font: 'Times New Roman',
          color: '94A3B8',
          size: 18,
        }),
      ],
    })
  );

  let globalQuestionIndex = 1;

  // ==========================================
  // 2. PHẦN I: Trắc nghiệm 4 lựa chọn
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
      const { cleanQuestionText, diagramElements } = resolveAndRenderQuestionContentAndDiagram(q);

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Câu ${globalQuestionIndex}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(cleanQuestionText, { size: 24 }),
          ],
        })
      );

      children.push(...diagramElements);

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
  // 3. PHẦN II: Trắc nghiệm Đúng / Sai
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
            text:
              'Thí sinh trả lời từ câu 1 đến câu ' +
              part2Questions.length +
              '. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
            italics: true,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    let part2Index = 1;
    for (const q of part2Questions) {
      const { cleanQuestionText, diagramElements } = resolveAndRenderQuestionContentAndDiagram(q);

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Câu ${part2Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(cleanQuestionText, { size: 24 }),
          ],
        })
      );

      children.push(...diagramElements);

      if (Array.isArray(q.subStatements) && q.subStatements.length > 0) {
        children.push(createDocxTrueFalseTable(q.subStatements));
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }

      part2Index++;
      globalQuestionIndex++;
    }
  }

  // ==========================================
  // 4. PHẦN III: Trắc nghiệm Trả lời ngắn
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
      const { cleanQuestionText, diagramElements } = resolveAndRenderQuestionContentAndDiagram(q);

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({ text: `Câu ${part3Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(cleanQuestionText, { size: 24 }),
          ],
        })
      );

      children.push(...diagramElements);

      children.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: 'Đáp số: ............................................................',
              italics: true,
              font: 'Times New Roman',
              size: 22,
              color: '64748B',
            }),
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
      const { cleanQuestionText, diagramElements } = resolveAndRenderQuestionContentAndDiagram(q);

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 100 },
          children: [
            new TextRun({ text: `Bài ${part4Index}: `, bold: true, font: 'Times New Roman', size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(cleanQuestionText, { size: 24 }),
          ],
        })
      );

      children.push(...diagramElements);

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
        new TextRun({
          text: '--------------------------------------------------------------------------------------------------',
          font: 'Times New Roman',
          color: '94A3B8',
          size: 18,
        }),
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
      answerText = q.subStatements.map((s: any) => `${s.label || s.key || ''}: ${s.correct ? 'Đ' : 'S'}`).join(', ');
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

  return new Document({
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
}

/**
 * Main function to export questions to a standardized, publication-grade Word .docx document.
 */
export async function exportExamToWordDocx(params: {
  title?: string;
  subject?: string;
  grade?: string;
  questions: QuizQuestion[];
  teacherName?: string;
  examCode?: string;
}): Promise<void> {
  const doc = buildExamDocxDocument(params);
  const blob = await Packer.toBlob(doc);
  const subject = params.subject || 'Toán học';
  const grade = params.grade || 'Lớp 12';
  const cleanFilename = `DeThi_${subject.replace(/\s+/g, '_')}_${grade.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveBlobSafely(blob, cleanFilename);
}
