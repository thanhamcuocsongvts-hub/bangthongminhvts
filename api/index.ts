import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SERVERLESS_TEXT_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function buildServerlessModelConfig(model: string, baseConfig: Record<string, any> = {}): Record<string, any> {
  const cfg = { ...baseConfig };
  if (model.startsWith('gemini-4-')) {
    delete cfg.temperature;
    delete cfg.topP;
    delete cfg.topK;
    delete cfg.candidateCount;
    if (!cfg.thinkingConfig) {
      cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }
  } else {
    delete cfg.thinkingConfig;
  }
  return cfg;
}

function isServerlessFatalAuthErr(msg: string): boolean {
  return msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('API key should be set');
}

function escapeUnescapedLatexInJsonServerless(text: string): string {
  return text.replace(
    /((?:^|[^\\])(?:\\\\)*)\\(?=(?:frac|forall|times|tan|theta|tau|text|tfrac|triangle|tilde|to(?![a-zA-Z])|beta|binom|bar|begin|big|backslash|bullet|right|rightarrow|rho|rangle|rbrace|rceil|rfloor|neq|notin|nabla)|[^"\\/bfnrtu])/g,
    '$1\\\\'
  );
}

function extractCompleteObjectsServerless(text: string): any[] | null {
  const startArr = text.indexOf('[');
  if (startArr === -1) return null;
  const items: any[] = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let objStart = -1;
  for (let idx = startArr + 1; idx < text.length; idx++) {
    const ch = text[idx];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) objStart = idx;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const chunk = text.slice(objStart, idx + 1);
        try {
          items.push(JSON.parse(escapeUnescapedLatexInJsonServerless(chunk)));
        } catch {
          try {
            items.push(JSON.parse(chunk));
          } catch (_) {}
        }
        objStart = -1;
      }
    }
  }
  return items.length > 0 ? items : null;
}

function safeParseServerlessJsonWithLatex(raw: string): any {
  if (!raw) return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const escaped = escapeUnescapedLatexInJsonServerless(text);
  try {
    return JSON.parse(escaped);
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return extractCompleteObjectsServerless(escaped) || extractCompleteObjectsServerless(text);
    }
  }
}

const SL_KNOWN_LATEX = new Set([
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'vec', 'overrightarrow', 'overleftarrow',
  'overleftrightarrow', 'widehat', 'overline', 'underline', 'hat', 'bar', 'tilde', 'widetilde',
  'mathbb', 'mathcal', 'mathbf', 'mathrm', 'mathit', 'mathsf', 'text', 'textbf', 'textit',
  'operatorname', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'tg', 'cotg', 'arctg',
  'arcsin', 'arccos', 'arctan', 'ln', 'log', 'lg', 'exp', 'lim', 'int', 'iint', 'oint',
  'sum', 'prod', 'infty', 'alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon',
  'theta', 'lambda', 'mu', 'pi', 'Pi', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'Phi', 'psi',
  'omega', 'Omega', 'in', 'notin', 'subset', 'subseteq', 'supset', 'cup', 'cap', 'setminus',
  'backslash', 'emptyset', 'varnothing', 'le', 'leq', 'ge', 'geq', 'ne', 'neq', 'approx',
  'equiv', 'pm', 'mp', 'times', 'cdot', 'div', 'to', 'rightarrow', 'leftarrow', 'leftrightarrow',
  'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'forall', 'exists', 'perp', 'parallel', 'angle',
  'triangle', 'circ', 'binom', 'begin', 'end', 'quad', 'qquad', 'ldots', 'cdots', 'dots',
]);

function recoverServerlessJsonControlChars(text: string, inMathMode: boolean): string {
  if (!text) return text;
  let out = text
    .replace(/\u000c(rac|orall)\b/g, '\\f$1')
    .replace(/\u0009(imes|an|heta|au|ext|frac|riangle|ilde|o(?![a-zA-Z]))/g, '\\t$1')
    .replace(/\u0008(eta|inom|ar|egin|ig|igg|igl|igr|ackslash|ullet)/g, '\\b$1')
    .replace(/\u000d(ightarrow|ight|ho|angle|brace|ceil|floor)/g, '\\r$1');
  if (inMathMode) {
    out = out.replace(/\n(eq(?![a-zA-Z])|e(?![a-zA-Z])|otin|abla|exists|mid)/g, '\\n$1');
  }
  return out;
}

function findMatchingParenServerless(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeServerlessMathSegment(segment: string, isInsideMath: boolean): string {
  if (!segment) return segment;
  let out = recoverServerlessJsonControlChars(segment, isInsideMath);
  if (out.includes('\\\\')) {
    out = out.replace(/\\\\([a-zA-Z]{2,})/g, (full, cmd) => (SL_KNOWN_LATEX.has(cmd) ? `\\${cmd}` : full));
  }

  // Radicals & AsciiMath function calls
  out = out
    .replace(/∛\s*\(([^()]+)\)/g, '\\sqrt[3]{$1}')
    .replace(/∛\s*([a-zA-Z0-9]+)/g, '\\sqrt[3]{$1}')
    .replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√\s*([a-zA-Z0-9]+)/g, '\\sqrt{$1}')
    .replace(/(?:\\)?\broot\s*\(([^()]+)\)\s*\(([^()]+)\)/g, (_, n, x) => `\\sqrt[${n.trim()}]{${x.trim()}}`)
    .replace(/(?:\\frac|\bfrac)\s*\(([^()]+)\)\s*\(([^()]+)\)/g, (_, a, b) => `\\frac{${a.trim()}}{${b.trim()}}`)
    .replace(/(?:\\frac|\bfrac)\s*\(([^(),]+),([^()]+)\)/g, (_, a, b) => `\\frac{${a.trim()}}{${b.trim()}}`);

  const unaryMap: Record<string, (a: string) => string> = {
    '\\vec': (a) => `\\overrightarrow{${a}}`,
    vec: (a) => `\\overrightarrow{${a}}`,
    '\\hat': (a) => `\\widehat{${a}}`,
    hat: (a) => `\\widehat{${a}}`,
    widehat: (a) => `\\widehat{${a}}`,
    '\\overline': (a) => `\\overline{${a}}`,
    overline: (a) => `\\overline{${a}}`,
    '\\bar': (a) => `\\overline{${a}}`,
    bar: (a) => `\\overline{${a}}`,
    '\\sqrt': (a) => `\\sqrt{${a}}`,
    sqrt: (a) => `\\sqrt{${a}}`,
    cbrt: (a) => `\\sqrt[3]{${a}}`,
  };
  for (let pass = 0; pass < 2; pass++) {
    const callRe = /(\\?(?:vec|hat|widehat|overline|bar|sqrt|cbrt))\s*\(/g;
    let res = '';
    let idx = 0;
    let match: RegExpExecArray | null;
    while ((match = callRe.exec(out)) !== null) {
      const fnName = match[1];
      const matchStart = match.index;
      if (!fnName.startsWith('\\') && matchStart > 0 && /[a-zA-Z0-9_\\]/.test(out[matchStart - 1])) continue;
      const openIdx = matchStart + match[0].length - 1;
      const closeIdx = findMatchingParenServerless(out, openIdx);
      if (closeIdx !== -1 && unaryMap[fnName]) {
        res += out.slice(idx, matchStart) + unaryMap[fnName](out.slice(openIdx + 1, closeIdx).trim());
        idx = closeIdx + 1;
        callRe.lastIndex = idx;
      }
    }
    if (idx > 0) out = res + out.slice(idx);

    const scriptRe = /([\^_])\s*\(/g;
    let sRes = '';
    let sIdx = 0;
    while ((match = scriptRe.exec(out)) !== null) {
      const openIdx = match.index + match[0].length - 1;
      const closeIdx = findMatchingParenServerless(out, openIdx);
      if (closeIdx !== -1) {
        sRes += out.slice(sIdx, match.index) + `${match[1]}{${out.slice(openIdx + 1, closeIdx).trim()}}`;
        sIdx = closeIdx + 1;
        scriptRe.lastIndex = sIdx;
      }
    }
    if (sIdx > 0) out = sRes + out.slice(sIdx);
  }

  const supMap: Record<string, string> = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','ⁿ':'n','ⁱ':'i' };
  const subMap: Record<string, string> = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','ₙ':'n','ᵢ':'i','ⱼ':'j' };
  out = out
    .replace(/\\vec\s*\{([^}]+)\}/g, '\\overrightarrow{$1}')
    .replace(/\\vec\s+([a-zA-Z][a-zA-Z0-9']*)/g, '\\overrightarrow{$1}')
    .replace(/([a-zA-Z0-9']+)[⃗\u20D7]/g, '\\overrightarrow{$1}')
    .replace(/\\hat\s*\{([^}]+)\}/g, '\\widehat{$1}')
    .replace(/\\hat\s+([a-zA-Z0-9']+)/g, '\\widehat{$1}')
    .replace(/\\bar\s*\{([^}]+)\}/g, '\\overline{$1}')
    .replace(/\\bar\s+([a-zA-Z0-9']+)/g, '\\overline{$1}')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+/g, (m) => `^{${m.split('').map((c) => supMap[c] || c).join('')}}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋ₙᵢⱼ]+/g, (m) => `_{${m.split('').map((c) => subMap[c] || c).join('')}}`)
    .replace(/(\\mathbb\s*\{[A-Z]\}|ℝ|ℕ|ℤ|ℚ)\s*\\\s*(\\{[^}]*\\\}|\{[^}]*\})/g, '$1 \\setminus $2')
    .replace(/(?<![\\a-zA-Z])([RNZQ])\s*\\\s*(\\{[^}]*\\\}|\{[^}]*\})/g, '\\mathbb{$1} \\setminus $2')
    .replace(/\\setminus\s*(?<!\\)\{([^{}]+)(?<!\\)\}/g, '\\setminus \\{$1\\}')
    .replace(/\^\s*\{\s*\\circ\s*\}|\^\\circ|\\degree\b/g, '^{\\circ}')
    .replace(/([0-9a-zA-Z)'}\]])\s*°/g, '$1^{\\circ}');

  if (isInsideMath) {
    out = out
      .replace(/<=>/g, '\\Leftrightarrow ')
      .replace(/=>/g, '\\Rightarrow ')
      .replace(/->/g, '\\to ')
      .replace(/<=/g, '\\le ')
      .replace(/>=/g, '\\ge ')
      .replace(/!=/g, '\\neq ')
      .replace(/\+-/g, '\\pm ')
      .replace(/(?<![a-zA-Z\\])([+-]?)\s*oo(?![a-zA-Z])/g, '$1\\infty')
      .replace(/\^([+-]\d+|\d{2,}|-[a-zA-Z])/g, '^{$1}')
      .replace(/_([a-zA-Z]\d+|\d{2,}|-[a-zA-Z0-9])/g, '_{$1}')
      .replace(/(?<![a-zA-Z_])\(([^()$]+)\)\s*\/\s*\(([^()$]+)\)/g, (_, a, b) => `\\frac{${a.trim()}}{${b.trim()}}`)
      .replace(/(?<![a-zA-Z_])\(([^()$]+)\)\s*\/\s*(\\[a-zA-Z]+(?:\{[^{}]*\})?|[a-zA-Z0-9]+)/g, (_, a, b) => `\\frac{${a.trim()}}{${b.trim()}}`)
      .replace(/ℝ/g, '\\mathbb{R}').replace(/ℕ/g, '\\mathbb{N}').replace(/ℤ/g, '\\mathbb{Z}').replace(/ℚ/g, '\\mathbb{Q}')
      .replace(/∈/g, '\\in ').replace(/∉/g, '\\notin ').replace(/∞/g, '\\infty').replace(/≤/g, '\\le ').replace(/≥/g, '\\ge ').replace(/≠/g, '\\neq ')
      .replace(/\\tg\b/g, '\\tan').replace(/\\cotg\b/g, '\\cot').replace(/\\arctg\b/g, '\\arctan')
      .replace(/(?<![a-zA-Z\\])(int|iint|sum|prod)(?=\s*[_^])/g, '\\$1')
      .replace(/(?<![a-zA-Z\\])(arcsin|arccos|arctan|sin|cos|tan|cot|ln|log|lg|lim)(?![a-zA-Z])/g, '\\$1')
      .replace(/(?<!\\)%/g, '\\%');
  }

  const held: string[] = [];
  const hold = (s: string) => {
    const idx = held.length;
    held.push(s);
    return `__VLTOK_${idx}__`;
  };
  let prot = out
    .replace(/\\text\s*\{[^{}]*\}/g, hold)
    .replace(/\\(?:overrightarrow|overleftarrow|overleftrightarrow|widehat|overline|vec)\s*\{[^{}]*\}/g, hold)
    .replace(/\\[a-zA-Z]+/g, hold);

  const hasVec = out.includes('\\overrightarrow') || out.includes('\\vec');
  const hasUnitCombo =
    /(?:^|[^a-zA-Z_])[+-]?\s*\d*\s*[ijk]\s*[+-]\s*\d*\s*[jk](?![a-zA-Z0-9_])/.test(prot) ||
    /(?:^|[^a-zA-Z_])[+-]?\s*\d*\s*[ij]\s*[+-]\s*\d*\s*[ijk](?![a-zA-Z0-9_])/.test(prot) ||
    (hasVec && /=\s*[+-]?\s*\d*\s*[ijk](?:\s*[+-]|[^a-zA-Z0-9_]|$)/.test(prot));

  if (hasUnitCombo) {
    prot = prot.replace(/(?<![a-zA-Z_\\])([ijk])(?![a-zA-Z0-9_])/g, '\\overrightarrow{$1}');
  }

  return prot.replace(/__VLTOK_(\d+)__/g, (_, i) => held[Number(i)] || '');
}

function normalizeServerlessMathInText(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  const prepared = text
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  if (!prepared.includes('$')) {
    const converted = normalizeServerlessMathSegment(prepared, false);
    const hasVn = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(converted);
    if (!hasVn && (/\\(?:overrightarrow|frac|dfrac|sqrt|widehat|overline|mathbb|in|infty|int|sum|lim|le|ge|neq)/.test(converted) || /\^[0-9{+-]|_[0-9{]/.test(converted))) {
      const m = converted.match(/^([\s\S]*?)([.,;!?]+)?$/);
      const body = m?.[1]?.trim() || converted.trim();
      const punct = m?.[2] || '';
      return `$${normalizeServerlessMathSegment(body, true)}$${punct}`;
    }
    return converted;
  }
  return prepared
    .split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g)
    .map((seg) => {
      if (seg.startsWith('$$') && seg.endsWith('$$')) {
        return `$$${normalizeServerlessMathSegment(seg.slice(2, -2), true)}$$`;
      }
      if (seg.startsWith('$') && seg.endsWith('$')) {
        return `$${normalizeServerlessMathSegment(seg.slice(1, -1), true)}$`;
      }
      return normalizeServerlessMathSegment(seg, false);
    })
    .join('');
}

function stripServerlessChoicePrefix(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/^\s*[A-D]\s*[\.\)\:]\s+(?=\S)/, '').trim();
}

function extractServerlessChoiceKey(raw: any): 'A' | 'B' | 'C' | 'D' {
  const s = String(raw ?? 'A').trim().toUpperCase();
  const m1 = s.match(/^(?:ĐÁP\s*ÁN|CHỌN|KEY|ANSWER)?\s*[:\-]?\s*\(?([A-D])\)?(?:\s|$|[\.\):])/);
  if (m1) return m1[1] as 'A' | 'B' | 'C' | 'D';
  const m2 = s.match(/\b([A-D])\b/);
  if (m2) return m2[1] as 'A' | 'B' | 'C' | 'D';
  return 'A';
}

function inferServerlessPartType(q: any): 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay' {
  const rawPartType = String(q?.partType || '').toLowerCase();
  if (rawPartType === 'part_2_true_false' || (Array.isArray(q?.subStatements) && q.subStatements.length > 0)) {
    return 'part_2_true_false';
  }
  if (rawPartType === 'part_3_short_answer' || (q?.shortAnswerKey !== undefined && q?.shortAnswerKey !== null && String(q.shortAnswerKey).trim() !== '')) {
    return 'part_3_short_answer';
  }
  if (rawPartType === 'part_4_essay' || (q?.essayRubric !== undefined && q?.essayRubric !== null && String(q.essayRubric).trim() !== '')) {
    return 'part_4_essay';
  }
  return 'part_1_choice';
}

function rewriteServerlessExplanationLetter(explanation: string, oldKey: string, newKey: string): string {
  if (!explanation || oldKey === newKey) return explanation;
  return explanation
    .replace(/(Đáp\s*án(?:\s*đúng)?\s*(?:là|:)?\s*)([A-D])\b/gi, `$1${newKey}`)
    .replace(/(Chọn(?:\s*đáp\s*án|\s*câu|\s*phương\s*án)?\s*[:\-]?\s*)([A-D])\b/gi, `$1${newKey}`)
    .replace(/(Vậy\s*chọn\s*)([A-D])\b/gi, `$1${newKey}`);
}

function balanceServerlessAnswerDistribution(questions: any[], seedInput: string): any[] {
  if (!Array.isArray(questions) || questions.length === 0) return questions || [];
  const KEYS = ['A', 'B', 'C', 'D'];
  let h = 2166136261;
  for (let i = 0; i < seedInput.length; i++) {
    h ^= seedInput.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 1337;
  const rng = () => {
    state += 0x6d2b79f5;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const shuffleArr = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const eligibleIndices: number[] = [];
  questions.forEach((q, idx) => {
    const isMcq = (!q.partType || q.partType === 'part_1_choice') && Array.isArray(q.options) && q.options.length >= 4;
    if (isMcq) {
      const optsText = q.options.map((o: any) => o?.text || '').join(' ');
      if (!/cả\s+[A-D]|tất\s*cả\s*(?:các)?\s*(?:phương\s*án|đáp\s*án)|(?:phương\s*án|đáp\s*án)\s*[A-D]/i.test(optsText)) {
        eligibleIndices.push(idx);
      }
    }
  });
  if (eligibleIndices.length === 0) return questions;

  const targets: string[] = [];
  while (targets.length < eligibleIndices.length) {
    targets.push(...shuffleArr(KEYS));
  }

  return questions.map((q, qIdx) => {
    const pos = eligibleIndices.indexOf(qIdx);
    if (pos === -1) return q;
    const targetKey = targets[pos];
    const oldKey = extractServerlessChoiceKey(q.correctAnswer);
    const correctItem = q.options.find((o: any) => String(o.key || '').trim().toUpperCase().replace(/[\.\)]$/, '') === oldKey) || q.options[0];
    const distractors = shuffleArr(q.options.filter((o: any) => o !== correctItem).map((o: any) => o.text));
    let dc = 0;
    const nextOptions = KEYS.map((k) => ({ key: k, text: k === targetKey ? correctItem.text : (distractors[dc++] ?? '') }));
    return {
      ...q,
      options: nextOptions,
      correctAnswer: targetKey,
      explanation: rewriteServerlessExplanationLetter(q.explanation || '', oldKey, targetKey),
    };
  });
}

function tryEvaluateSimpleMathNumberServerless(rawExpr: string): number | null {
  let expr = String(rawExpr || '').trim();
  if (!expr) return null;
  expr = expr
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/\\text\s*\{[^}]*\}/g, '')
    .replace(/\\mathrm\s*\{[^}]*\}/g, '')
    .replace(/\\(?:left|right)\s*/g, '')
    .replace(/\\(?:d|t|c)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))')
    .replace(/\\(?:d|t|c)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/√\s*\(([^()]+)\)/g, 'sqrt($1)')
    .replace(/√\s*(\d+(?:[.,]\d+)?)/g, 'sqrt($1)')
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/[×·]/g, '*')
    .replace(/\\div|÷|:/g, '/')
    .replace(/\\pi\b|π/g, 'pi')
    .replace(/,/g, '.')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '');
  if (!expr || expr.length > 80) return null;
  let pos = 0;
  const peek = () => expr[pos] || '';
  const parseNum = (): number | null => {
    if (expr.startsWith('sqrt(', pos)) {
      pos += 5;
      const inner = parseExpr();
      if (inner === null || expr[pos] !== ')' || inner < 0) return null;
      pos++;
      return Math.sqrt(inner);
    }
    if (expr.startsWith('pi', pos)) {
      pos += 2;
      return Math.PI;
    }
    if (peek() === 'e' && (pos + 1 >= expr.length || !/[a-zA-Z]/.test(expr[pos + 1]))) {
      pos += 1;
      return Math.E;
    }
    const m = expr.slice(pos).match(/^\d+(?:\.\d+)?/);
    if (!m) return null;
    pos += m[0].length;
    return Number(m[0]);
  };
  const parsePrimary = (): number | null => {
    if (peek() === '(') {
      pos++;
      const v = parseExpr();
      if (v === null || expr[pos] !== ')') return null;
      pos++;
      return v;
    }
    return parseNum();
  };
  const parseUnary = (): number | null => {
    if (peek() === '+') { pos++; return parseUnary(); }
    if (peek() === '-') { pos++; const v = parseUnary(); return v === null ? null : -v; }
    return parsePrimary();
  };
  const parseTerm = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    while (pos < expr.length) {
      const ch = peek();
      if (ch === '*' || ch === '/') {
        pos++;
        const right = parseUnary();
        if (right === null) return null;
        if (ch === '/') {
          if (Math.abs(right) < 1e-12) return null;
          left /= right;
        } else {
          left *= right;
        }
      } else if (ch === '(' || expr.startsWith('sqrt(', pos) || expr.startsWith('pi', pos)) {
        const right = parseUnary();
        if (right === null) return null;
        left *= right;
      } else {
        break;
      }
    }
    return left;
  };
  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    while (pos < expr.length) {
      const ch = peek();
      if (ch === '+' || ch === '-') {
        pos++;
        const right = parseTerm();
        if (right === null) return null;
        left = ch === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  };
  const res = parseExpr();
  return res !== null && pos === expr.length && Number.isFinite(res) ? res : null;
}

function formatPlainShortAnswerKeyServerless(raw: string, questionText?: string): { key: string; roundedWithDecimals?: number } {
  let s = String(raw || '').trim();
  if (!s) return { key: '' };
  s = s
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/\\text\s*\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\s*\{([^}]*)\}/g, '$1')
    .trim();
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) {
    return { key: s.replace('.', ',') };
  }
  const qLower = String(questionText || '').toLowerCase();
  const hasExplicitRounding = /làm\s*tròn|hàng\s*phần|chữ\s*số\s*thập\s*phân|hàng\s*đơn\s*vị/.test(qLower);
  let decimals = 2;
  if (/hàng\s*phần\s*nghìn|3\s*chữ\s*số\s*thập\s*phân|0[.,]001/.test(qLower)) decimals = 3;
  else if (/hàng\s*phần\s*trăm|2\s*chữ\s*số\s*thập\s*phân|0[.,]01/.test(qLower)) decimals = 2;
  else if (/hàng\s*phần\s*mười|1\s*chữ\s*số\s*thập\s*phân|0[.,]1/.test(qLower)) decimals = 1;
  else if (/hàng\s*đơn\s*vị|số\s*nguyên\s*gần\s*nhất/.test(qLower)) decimals = 0;

  const numeric = tryEvaluateSimpleMathNumberServerless(s);
  if (numeric !== null && Number.isFinite(numeric)) {
    if (Math.abs(numeric - Math.round(numeric)) < 1e-9) {
      return { key: String(Math.round(numeric) || 0) };
    }
    if (!hasExplicitRounding) {
      for (let d = 1; d <= 3; d++) {
        const f = Math.pow(10, d);
        if (Math.abs(numeric * f - Math.round(numeric * f)) < 1e-7) {
          const val = Math.round(numeric * f) / f;
          return { key: String(val === 0 ? 0 : val).replace('.', ',') };
        }
      }
    }
    const factor = Math.pow(10, decimals);
    const rounded = Math.round((numeric + Number.EPSILON) * factor) / factor;
    const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
    return {
      key: (formatted === '-0' ? '0' : formatted).replace('.', ','),
      roundedWithDecimals: hasExplicitRounding ? undefined : decimals,
    };
  }
  return { key: s };
}

function ensurePart3RoundingServerless(questionText: string, roundedWithDecimals?: number): string {
  const q = String(questionText || '').trim();
  if (!q || roundedWithDecimals === undefined) return q;
  if (/làm\s*tròn|hàng\s*phần|chữ\s*số\s*thập\s*phân|hàng\s*đơn\s*vị/i.test(q)) return q;
  const suffix =
    roundedWithDecimals === 3
      ? ' (kết quả làm tròn đến hàng phần nghìn)'
      : roundedWithDecimals === 1
      ? ' (kết quả làm tròn đến hàng phần mười)'
      : roundedWithDecimals === 0
      ? ' (kết quả làm tròn đến hàng đơn vị)'
      : ' (kết quả làm tròn đến hàng phần trăm)';
  return `${q}${suffix}`;
}

function normalizeServerlessQuestion(q: any, idx: number, difficulty: string, subject: string, timeLimit: number) {
  const partType = inferServerlessPartType(q);
  const isTrueFalse = partType === 'part_2_true_false';
  const isShortAnswer = partType === 'part_3_short_answer';
  const isEssay = partType === 'part_4_essay';

  let partLabel = q.partLabel || 'Phần I. Câu trắc nghiệm nhiều phương án lựa chọn';
  if (isTrueFalse) {
    partLabel = q.partLabel || 'Phần II. Câu trắc nghiệm Đúng / Sai';
  } else if (isShortAnswer) {
    partLabel = q.partLabel || 'Phần III. Câu trắc nghiệm trả lời ngắn';
  } else if (isEssay) {
    partLabel = q.partLabel || 'Phần IV. Tự luận';
  }

  let subStatements: any[] | undefined = undefined;
  if (isTrueFalse && Array.isArray(q.subStatements)) {
    subStatements = q.subStatements.map((s: any, sIdx: number) => {
      const label = s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
      const statement = normalizeServerlessMathInText(s.statement || s.text || '');
      const correct = typeof s.correct === 'boolean' ? s.correct : (typeof s.isCorrect === 'boolean' ? s.isCorrect : true);
      return {
        id: `sub_${idx}_${sIdx}`,
        key: label,
        label,
        statement,
        text: statement,
        correct,
        isCorrect: correct,
      };
    });
  }

  let options: any[] = [];
  if (partType === 'part_1_choice') {
    options = Array.isArray(q.options) && q.options.length >= 2
      ? q.options.map((opt: any, oIdx: number) => {
          const cleanKey = ['A', 'B', 'C', 'D'][oIdx] || String(opt?.key || 'A').trim().toUpperCase().replace(/[\.\)]$/, '');
          const rawOptText = typeof opt === 'string' ? opt : (opt.text || `Lựa chọn ${cleanKey}`);
          const cleaned = stripServerlessChoicePrefix(rawOptText) || rawOptText;
          return {
            key: cleanKey,
            text: normalizeServerlessMathInText(cleaned),
          };
        })
      : [
          { key: 'A', text: 'Phương án A' },
          { key: 'B', text: 'Phương án B' },
          { key: 'C', text: 'Phương án C' },
          { key: 'D', text: 'Phương án D' },
        ];
  }

  let normalizedQuestion = normalizeServerlessMathInText(q.question || `Câu hỏi ${idx + 1}`);
  let finalShortKey: string | undefined = typeof q.shortAnswerKey === 'string' ? normalizeServerlessMathInText(q.shortAnswerKey) : undefined;
  let rawCorrect = isTrueFalse
    ? (subStatements && subStatements.length > 0
        ? subStatements.map((s) => `${s.label}:${s.correct ? 'Đ' : 'S'}`).join(', ')
        : String(q.correctAnswer || 'a:Đ, b:S, c:Đ, d:S'))
    : isEssay
      ? String(q.correctAnswer || 'Lời giải mẫu')
      : extractServerlessChoiceKey(q.correctAnswer);

  if (isShortAnswer) {
    const formatted = formatPlainShortAnswerKeyServerless(String(q.shortAnswerKey ?? q.correctAnswer ?? ''), normalizedQuestion);
    if (formatted.roundedWithDecimals !== undefined) {
      normalizedQuestion = ensurePart3RoundingServerless(normalizedQuestion, formatted.roundedWithDecimals);
    }
    finalShortKey = formatted.key;
    rawCorrect = formatted.key;
  }

  return {
    id: q.id || `ai_fast_q_${Date.now()}_${idx + 1}`,
    question: normalizedQuestion,
    partType,
    partLabel,
    options,
    subStatements,
    shortAnswerKey: finalShortKey || (isShortAnswer ? rawCorrect : undefined),
    essayRubric: q.essayRubric ? normalizeServerlessMathInText(String(q.essayRubric)) : (isEssay ? normalizeServerlessMathInText(q.explanation || 'Hướng dẫn chấm') : undefined),
    correctAnswer: rawCorrect,
    explanation: normalizeServerlessMathInText(q.explanation || 'Lời giải chi tiết theo chuẩn sư phạm.'),
    diagramType: q.diagramType,
    diagramData: q.diagramData,
    timeLimit: Number(q.timeLimit) || Number(timeLimit) || (isTrueFalse ? 60 : (isShortAnswer ? 45 : (isEssay ? 120 : 30))),
    difficulty: q.difficulty || difficulty,
    subject,
  };
}

// In-memory audio cache for fast serverless responses (<10ms)
const ttsAudioCache = new Map<string, { buffer: Buffer; mime: string; engine: string }>();

const VOICE_STYLE_HINTS: Record<string, { geminiVoice: string; fallbackVoice: string; style: string }> = {
  Kore: {
    geminiVoice: 'Kore',
    fallbackVoice: 'Kore',
    style: 'Bright, cheerful, energetic Vietnamese female teacher speaking at a brisk, lively, engaging classroom pace with crisp articulation',
  },
  Aoede: {
    geminiVoice: 'Zephyr',
    fallbackVoice: 'Kore',
    style: 'Engaging, expressive, dynamic Vietnamese narrator speaking at a lively, natural pace with warm vocal energy',
  },
  Zephyr: {
    geminiVoice: 'Zephyr',
    fallbackVoice: 'Kore',
    style: 'Upbeat, warm, bright Vietnamese narrator speaking at a brisk, clear, captivating pace',
  },
  Puck: {
    geminiVoice: 'Puck',
    fallbackVoice: 'Fenrir',
    style: 'High-energy, enthusiastic, vibrant Vietnamese quiz show host speaking at a brisk, punchy, exciting pace',
  },
  Charon: {
    geminiVoice: 'Charon',
    fallbackVoice: 'Fenrir',
    style: 'Confident, resonant, authoritative Vietnamese male lecturer speaking at a crisp, brisk, engaging classroom pace',
  },
  Fenrir: {
    geminiVoice: 'Fenrir',
    fallbackVoice: 'Charon',
    style: 'Sharp, dynamic, professional Vietnamese television anchor speaking at a brisk, decisive, captivating pace',
  },
};

function chunkTextForTTS(text: string, maxLen: number = 140): string[] {
  const parts = text.split(/(?<=[.!?:;\n])\s+/);
  const chunks: string[] = [];
  let cur = '';

  for (const part of parts) {
    const s = part.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = '';
      const words = s.split(/\s+/);
      let wordChunk = '';
      for (const w of words) {
        if ((wordChunk + ' ' + w).length > maxLen) {
          if (wordChunk) chunks.push(wordChunk.trim());
          wordChunk = w;
        } else {
          wordChunk = wordChunk ? `${wordChunk} ${w}` : w;
        }
      }
      if (wordChunk) cur = wordChunk;
    } else {
      if ((cur + ' ' + s).length > maxLen) {
        if (cur) chunks.push(cur);
        cur = s;
      } else {
        cur = cur ? `${cur} ${s}` : s;
      }
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function fetchSingleTtsAudio(chunk: string, lang: string): Promise<Buffer | null> {
  const encoded = encodeURIComponent(chunk);
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encoded}`,
    `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
  ];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
          Accept: 'audio/mpeg, audio/*; q=0.9, */*; q=0.5',
        },
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        if (arrayBuf.byteLength > 100) {
          return Buffer.from(arrayBuf);
        }
      }
    } catch (_) {}
  }
  return null;
}

function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-gemini-api-key'
  );
  res.setHeader('Access-Control-Expose-Headers', 'X-TTS-Engine');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';

  if (url.includes('/api/health') || url === '/api') {
    return res.status(200).json({ status: 'ok', server: 'vercel-serverless' });
  }

  const apiKey =
    (req.headers['x-gemini-api-key'] as string) ||
    req.body?.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // 0. High-Fidelity Text-To-Speech Route (Gemini Audio + Google TTS Fallback)
  if (url.includes('/api/tts')) {
    try {
      const parsedUrl = new URL(url, 'https://localhost');
      const text = String(req.query?.text || parsedUrl.searchParams.get('text') || '').trim();
      if (!text) {
        return res.status(400).send('Text is required');
      }

      const requestedLang = String(req.query?.lang || parsedUrl.searchParams.get('lang') || 'vi');
      const lang = requestedLang.toLowerCase().startsWith('en') ? 'en' : 'vi';
      const requestedVoice = String(
        req.query?.voice ||
        req.query?.preset ||
        parsedUrl.searchParams.get('voice') ||
        parsedUrl.searchParams.get('preset') ||
        'Kore'
      ).trim();
      const validVoices = ['Kore', 'Aoede', 'Zephyr', 'Puck', 'Charon', 'Fenrir'];
      const voice = validVoices.includes(requestedVoice) ? requestedVoice : 'Kore';
      const presetId = String(req.query?.preset || parsedUrl.searchParams.get('preset') || voice).trim();
      const allowGemini = Boolean(ai) && parsedUrl.searchParams.get('useGemini') !== '0';
      const cacheKey = `${allowGemini ? 'g38' : 'gt'}:${voice}:${presetId}:${lang}:${text}`;

      if (ttsAudioCache.has(cacheKey)) {
        const cached = ttsAudioCache.get(cacheKey)!;
        res.setHeader('Content-Type', cached.mime);
        res.setHeader('X-TTS-Engine', cached.engine);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', cached.buffer.length);
        return res.send(cached.buffer);
      }

      // 1. Gemini 3.8 Neural TTS (expressive multi-voice speechMetadata) when API key is configured
      if (allowGemini && ai) {
        try {
          const voiceSpec = VOICE_STYLE_HINTS[voice] || VOICE_STYLE_HINTS.Kore;
          const langStylePrefix =
            lang === 'en'
              ? 'Natural English pronunciation. '
              : 'Natural standard Vietnamese pronunciation (miền Bắc/chuẩn SGK). ';
          const speechStyle = `${langStylePrefix}${voiceSpec.style}`;

          const tryGenerateGeminiTts = async (modelName: string, targetVoice: string) => {
            return ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text,
                      speechMetadata: {
                        style: speechStyle,
                      },
                    } as any,
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: targetVoice,
                    },
                  },
                },
              },
            });
          };

          let response: any = null;
          try {
            response = await Promise.race([
              tryGenerateGeminiTts('gemini-3.8-flash-lite-tts', voiceSpec.geminiVoice),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini TTS timeout')), 5500)),
            ]);
          } catch {
            try {
              response = await Promise.race([
                tryGenerateGeminiTts('gemini-3.8-flash-tts', voiceSpec.fallbackVoice),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini flash TTS timeout')), 5000)),
              ]);
            } catch (_) {}
          }

          const parts = response?.candidates?.[0]?.content?.parts;
          let audioBase64 = '';
          let mimeType = 'audio/wav';
          if (parts) {
            for (const p of parts) {
              if (p.inlineData?.data) {
                audioBase64 = p.inlineData.data;
                if (p.inlineData.mimeType) mimeType = p.inlineData.mimeType;
                break;
              }
            }
          }

          if (audioBase64) {
            const rawBytes = Buffer.from(audioBase64, 'base64');
            const hasRiffHeader = rawBytes.length > 12 && rawBytes.toString('ascii', 0, 4) === 'RIFF';
            let wavBuffer = rawBytes;
            if (!hasRiffHeader && (mimeType.includes('pcm') || mimeType.includes('raw') || mimeType.includes('l16'))) {
              wavBuffer = pcmToWavBuffer(rawBytes, 24000);
              mimeType = 'audio/wav';
            } else if (hasRiffHeader) {
              mimeType = 'audio/wav';
            }
            if (ttsAudioCache.size > 200) {
              const firstKey = ttsAudioCache.keys().next().value;
              if (firstKey) ttsAudioCache.delete(firstKey);
            }
            ttsAudioCache.set(cacheKey, { buffer: wavBuffer, mime: mimeType, engine: 'gemini-3.8' });
            res.setHeader('Content-Type', mimeType);
            res.setHeader('X-TTS-Engine', 'gemini-3.8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Length', wavBuffer.length);
            return res.send(wavBuffer);
          }
        } catch (geminiErr) {
          console.warn('[Vercel Serverless] Gemini 3.8 TTS error, falling back to Google TTS:', geminiErr);
        }
      }

      // 2. Fast Google Translate TTS Stream with parallel chunk fetching
      const chunks = chunkTextForTTS(text, 180);
      const chunkPromises = chunks.map((chunk) => fetchSingleTtsAudio(chunk, lang));
      const chunkResults = await Promise.all(chunkPromises);
      const audioBuffers: Buffer[] = chunkResults.filter((b): b is Buffer => b !== null);

      if (audioBuffers.length === 0) {
        return res.status(502).send('Không thể tạo giọng đọc tiếng Việt từ máy chủ');
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      if (ttsAudioCache.size > 200) {
        const firstKey = ttsAudioCache.keys().next().value;
        if (firstKey) ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, { buffer: combinedBuffer, mime: 'audio/mpeg', engine: 'google-translate' });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-TTS-Engine', 'google-translate');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', combinedBuffer.length);
      return res.send(combinedBuffer);
    } catch (err: any) {
      console.error('[Vercel Serverless] /api/tts error:', err);
      return res.status(500).send('Lỗi máy chủ TTS: ' + (err?.message || String(err)));
    }
  }

  // Helper: Generates curriculum-standard questions when AI is offline or without API key
  const generateServerFallbackQuestions = (
    prompt: string,
    subject: string = 'Toán học',
    count: number = 5,
    difficulty: string = 'Thông hiểu',
    timeLimit: number = 30
  ) => {
    const isMath = subject.includes('Toán');
    const isChem = subject.includes('Hóa');
    const isPhys = subject.includes('Lý');
    const cleanTopic = (prompt || '').trim() || `${subject} Kiến thức trọng tâm`;

    const qs: any[] = [];
    for (let i = 1; i <= count; i++) {
      let qText = `Câu ${i}: Cho kiến thức về "${cleanTopic}". Khẳng định nào sau đây là đúng?`;
      let optA = `Khẳng định chính xác về ${cleanTopic} theo chuẩn chương trình SGK mới`;
      let optB = `Mệnh đề chưa chuẩn xác hoặc thiếu điều kiện ràng buộc`;
      let optC = `Trường hợp suy luận sai lầm thường gặp khi áp dụng công thức`;
      let optD = `Giá trị đối nghịch với định lý chuẩn`;

      if (isMath) {
        if (i === 1) {
          qText = `Câu 1: Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$ và có bảng xét dấu đạo hàm. Điểm cực đại của hàm số là điểm mà tại đó đạo hàm $f'(x)$ đổi dấu như thế nào?`;
          optA = `Từ dương $(+)$ sang âm $(-)$ khi qua điểm đó`;
          optB = `Từ âm $(-)$ sang dương $(+)$ khi qua điểm đó`;
          optC = `Luôn mang dấu dương $(+)$`;
          optD = `Không đổi dấu khi qua điểm đó`;
        } else if (i === 2) {
          qText = `Câu 2: Nguyên hàm của hàm số $f(x) = 2x + \\cos x$ là:`;
          optA = `$F(x) = x^2 + \\sin x + C$`;
          optB = `$F(x) = x^2 - \\sin x + C$`;
          optC = `$F(x) = 2 - \\sin x + C$`;
          optD = `$F(x) = 2x^2 + \\cos x + C$`;
        } else if (i === 3) {
          qText = `Câu 3: Trong không gian $Oxyz$, cho mặt phẳng $(P): 2x - y + 3z - 4 = 0$. Vectơ nào sau đây là một vectơ pháp tuyến của $(P)$?`;
          optA = `$\\vec{n} = (2; -1; 3)$`;
          optB = `$\\vec{n} = (2; 1; 3)$`;
          optC = `$\\vec{n} = (-2; -1; 3)$`;
          optD = `$\\vec{n} = (2; -1; -4)$`;
        }
      } else if (isChem) {
        if (i === 1) {
          qText = `Câu 1: Chất nào sau đây là đồng phân của este etyl axetat ($CH_3COOC_2H_5$)?`;
          optA = `Axit butanoic ($CH_3CH_2CH_2COOH$)`;
          optB = `Metyl axetat ($CH_3COOCH_3$)`;
          optC = `Etyl fomat ($HCOOC_2H_5$)`;
          optD = `Axit axetic ($CH_3COOH$)`;
        }
      } else if (isPhys) {
        if (i === 1) {
          qText = `Câu 1: Một con lắc lò xo có độ cứng $k$, vật nhỏ khối lượng $m$. Chu kỳ dao động điều hòa của con lắc là:`;
          optA = `$T = 2\\pi \\sqrt{\\frac{m}{k}}$`;
          optB = `$T = 2\\pi \\sqrt{\\frac{k}{m}}$`;
          optC = `$T = \\frac{1}{2\\pi} \\sqrt{\\frac{m}{k}}$`;
          optD = `$T = 2\\pi \\sqrt{\\frac{g}{l}}$`;
        }
      }

      qs.push({
        id: `fb_q_${Date.now()}_${i}`,
        question: qText,
        options: [
          { key: 'A', text: optA },
          { key: 'B', text: optB },
          { key: 'C', text: optC },
          { key: 'D', text: optD },
        ],
        correctAnswer: 'A',
        explanation: `Lời giải chuẩn xác sư phạm cho ${cleanTopic}. Phương án A đúng lý thuyết.`,
        difficulty,
        timeLimit: Number(timeLimit) || 30,
      });
    }
    return qs;
  };

  // 1. Handwriting Recognition
  if (url.includes('/api/ai/recognize-handwriting') && req.method === 'POST') {
    if (!ai) {
      return res.status(200).json({ text: '' });
    }
    const { imageBase64, mimeType = 'image/jpeg', context = 'bài giảng lớp học' } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh' });
    }
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    let lastErr = '';
    for (const model of SERVERLESS_TEXT_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                {
                  text: `[VAI TRÒ]: Bạn là một GIÁO VIÊN VIỆT NAM ĐỌC VÀ CHẤM CHỮ VIẾT TAY TRÊN BẢNG LỚP HỌC.
Dù chữ viết xấu, viết ẩu, viết vội, nét nghệch ngoạc, thiếu dấu hoặc dính nét, hãy dựa vào ngữ cảnh: ${context} để đọc và suy luận ĐÚNG 100% từ ngữ hoặc công thức toán học/tiếng Việt.
CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN ĐÃ NHẬN DIỆN, KHÔNG GIẢI THÍCH, KHÔNG NGOẶC KÉP.
TUYỆT ĐỐI KHÔNG mở đầu bằng 'Ảnh 1:', 'Hình 1:', 'Ảnh 1', 'Image 1:', 'Trong ảnh:' hay bất kỳ tiền tố nào.`,
                },
              ],
            },
          ],
          config: buildServerlessModelConfig(model, {
            temperature: 0.1,
          }),
        });
        let text = (response.text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
        text = text.replace(/^(ảnh|hình|image|picture)\s*\d*\s*[:\-–—]\s*/i, '');
        text = text.replace(/^trong\s+(ảnh|hình|bức ảnh)\s*\d*\s*(là|hiển thị|chứa)?\s*[:\-–—]?\s*/i, '');
        text = text.replace(/^(đây là|nội dung trong ảnh là|văn bản trong ảnh là|chữ trong ảnh là)\s*[:\-–—]?\s*/i, '');
        if (text.toLowerCase().trim() === 'ảnh 1' || text.toLowerCase().trim() === 'hình 1') {
          text = '1';
        }
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
          text = text.slice(1, -1).trim();
        }
        return res.status(200).json({ success: true, text });
      } catch (e: any) {
        lastErr = e?.message || String(e);
        if (isServerlessFatalAuthErr(lastErr)) break;
      }
    }
    return res.status(200).json({ success: true, text: '' });
  }

  // 2. Generate Quiz (Solve-First Accuracy Pipeline)
  if (url.includes('/api/ai/generate-quiz') && req.method === 'POST') {
    const { topic, subject = 'Toán học', grade = 'Lớp 12', count = 5, difficulty = 'Thông hiểu' } = req.body || {};
    const numQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);

    if (ai) {
      let lastErr = '';
      for (const model of SERVERLESS_TEXT_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `Soạn ${numQuestions} câu hỏi trắc nghiệm chất lượng cao, CHÍNH XÁC TUYỆT ĐỐI về chủ đề: "${topic}". Môn: ${subject}, Khối: ${grade}, Mức độ: ${difficulty}.
QUY TRÌNH GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (BẮT BUỘC):
1. Đọc kỹ đề ("question"), tính toán và giải hoàn chỉnh ra đáp số trong "explanation" TRƯỚC.
2. Đặt kết quả tính được ở "explanation" vào một trong 4 phương án A/B/C/D của "options" (3 phương án còn lại là nhiễu hợp lý; KHÔNG ghi "A. ", "B. " vào "text").
3. Sau khi đã có "options", kiểm tra lại đối chiếu để điền "correctAnswer" CHÍNH XÁC TUYỆT ĐỐI khớp với chữ cái chứa kết quả ở "explanation".
4. Toàn bộ công thức toán/lý/hóa dùng LaTeX chuẩn bọc trong $...$ (escape \\\\ trong JSON): phân số \\\\frac{a}{b}, căn thức \\\\sqrt{x}, mũ/chỉ số bọc ngoặc x^{n+1}, C_n^k, tích phân \\\\int_a^b, giới hạn \\\\lim_{x \\to +\\\\infty}, tập hợp \\\\mathbb{R} \\\\setminus \\\\{1\\\\}, góc \\\\widehat{ABC}, độ ^{\\\\circ}, véctơ $\\\\overrightarrow{AB}$, $\\\\overrightarrow{a}$, $\\\\overrightarrow{i}$, $\\\\overrightarrow{j}$, $\\\\overrightarrow{k}$ (TUYỆT ĐỐI KHÔNG viết ASCII vec(AB), frac(a,b), sqrt(x), <=, >=, oo).
Trả về JSON array thuần túy theo ĐÚNG THỨ TỰ FIELD sau:
[{"id":"q1","question":"...","explanation":"Giải chi tiết ra kết quả...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correctAnswer":"B","timeLimit":30}]`,
            config: buildServerlessModelConfig(model, {
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            }),
          });
          const parsed = safeParseServerlessJsonWithLatex(response.text || '[]');
          const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions || [];
          if (rawQuestions && rawQuestions.length > 0) {
            const normalized = rawQuestions.map((q: any, idx: number) =>
              normalizeServerlessQuestion(q, idx, difficulty, subject, 30)
            );
            return res.status(200).json({
              success: true,
              questions: balanceServerlessAnswerDistribution(normalized, `${topic}_${Date.now()}`),
            });
          }
        } catch (e: any) {
          lastErr = e?.message || String(e);
          console.warn(`[Vercel Serverless] Quiz with ${model} failed, trying next...`, lastErr);
          if (isServerlessFatalAuthErr(lastErr)) break;
        }
      }
    }

    const fallback = generateServerFallbackQuestions(topic, subject, numQuestions, difficulty);
    return res.status(200).json({ success: true, questions: fallback, fallback: true });
  }

  // 3. Fast Matrix Quiz & Prompt Quiz (Solve-First 2-Phase Parallel Batched Engine)
  if (url.includes('/api/ai/fast-matrix-quiz') && req.method === 'POST') {
    const {
      prompt = '',
      matrixFile,
      subject = 'Toán học',
      grade = 'Lớp 12',
      count = 5,
      difficulty = 'Thông hiểu',
      timeLimit = 30,
      isMatrixMode = false,
    } = req.body || {};

    const hasUploadedFile = Boolean(matrixFile && (matrixFile.text || matrixFile.base64));
    const isAutoMatrix = count === 'auto_matrix';
    const isMatrixExplicit = isMatrixMode === true || isAutoMatrix || hasUploadedFile;
    const numQuestions = hasUploadedFile || isAutoMatrix ? 22 : Math.min(Math.max(Number(count) || 5, 1), 50);
    const rawUserPrompt = (prompt || '').trim();
    const isGenericDefaultPrompt =
      hasUploadedFile &&
      (!rawUserPrompt ||
        rawUserPrompt.toLowerCase() === 'khảo sát hàm số và đồ thị' ||
        rawUserPrompt.toLowerCase() === 'tạo đề theo ma trận đề tải lên');
    const userPrompt = isGenericDefaultPrompt ? '' : rawUserPrompt;

    if (!ai) {
      return res.status(403).json({
        success: false,
        error: 'Chưa cấu hình Gemini API Key. Vui lòng thiết lập API Key để tạo đề từ ma trận.',
      });
    }

    const matrixText = String(matrixFile?.text || '').trim();
    const hasRichExtractedText = matrixText.length >= 150;
    const isImageUpload = Boolean(matrixFile?.mimeType?.startsWith('image/'));
    const shouldAttachBinary = Boolean(
      matrixFile?.base64 &&
        matrixFile?.mimeType &&
        matrixFile.base64.length < 15_000_000 &&
        (isImageUpload || !hasRichExtractedText)
    );
    const cleanInlinePart = shouldAttachBinary
      ? {
          inlineData: {
            mimeType: matrixFile.mimeType,
            data: matrixFile.base64.replace(/^data:.*?;base64,/, ''),
          },
        }
      : null;

    type SLMatrixSlot = {
      n: number;
      partType: 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay';
      level: string;
      topic: string;
    };

    const normalizeSLPart = (raw: any): SLMatrixSlot['partType'] => {
      const s = String(raw || '').toLowerCase();
      if (s.includes('2') || s.includes('true_false') || s.includes('dung_sai') || s.includes('đúng')) return 'part_2_true_false';
      if (s.includes('3') || s.includes('short') || s.includes('tra_loi_ngan') || s.includes('ngắn')) return 'part_3_short_answer';
      if (s.includes('4') || s.includes('essay') || s.includes('tu_luan') || s.includes('tự luận')) return 'part_4_essay';
      return 'part_1_choice';
    };

    const buildDefaultBgdSlots = (scopeTopic: string): SLMatrixSlot[] => {
      const t = scopeTopic || `${subject} ${grade}`;
      const list: SLMatrixSlot[] = [];
      const p1Levels = [
        'Nhận biết', 'Nhận biết', 'Nhận biết', 'Nhận biết',
        'Nhận biết', 'Nhận biết', 'Thông hiểu', 'Thông hiểu',
        'Thông hiểu', 'Thông hiểu', 'Vận dụng', 'Vận dụng',
      ];
      for (let i = 0; i < 12; i++) {
        list.push({ n: i + 1, partType: 'part_1_choice', level: p1Levels[i] || difficulty, topic: `${t} (dạng ${i + 1})` });
      }
      for (let i = 0; i < 4; i++) {
        list.push({ n: 13 + i, partType: 'part_2_true_false', level: i < 2 ? 'Thông hiểu' : 'Vận dụng', topic: `${t} - Mệnh đề Đúng/Sai #${i + 1}` });
      }
      for (let i = 0; i < 6; i++) {
        list.push({ n: 17 + i, partType: 'part_3_short_answer', level: i < 2 ? 'Thông hiểu' : 'Vận dụng', topic: `${t} - Trả lời ngắn #${i + 1}` });
      }
      return list;
    };

    let resolvedSubject = subject;
    let resolvedGrade = grade;
    let slots: SLMatrixSlot[] = [];

    if (hasUploadedFile) {
      const planParts: any[] = [];
      if (cleanInlinePart) planParts.push(cleanInlinePart);
      if (matrixText) {
        planParts.push({
          text: `NỘI DUNG MA TRẬN / ĐỀ CƯƠNG ("${matrixFile?.fileName || 'matrix'}"):\n"""\n${matrixText.slice(0, 16000)}\n"""`,
        });
      }
      planParts.push({
        text: `Đọc kỹ ma trận/đề cương trên (môn gợi ý: ${subject}, khối: ${grade}${userPrompt ? `, yêu cầu: ${userPrompt}` : ''}).
Trả về ĐÚNG JSON khung danh sách từng câu hỏi cần tạo:
{
  "subject": "Tên môn học đúng trong tệp",
  "grade": "Khối lớp đúng trong tệp (ví dụ: Lớp 12)",
  "items": [
    { "n": 1, "partType": "part_1_choice", "level": "Nhận biết", "topic": "Tên chủ đề/dạng bài chính xác theo ma trận (10-18 từ)" }
  ]
}
Quy tắc:
- Nếu tệp ghi rõ số câu Phần I (part_1_choice), Phần II (part_2_true_false), Phần III (part_3_short_answer), Phần IV (part_4_essay) -> liệt kê ĐÚNG tổng số câu và loại câu từng phần đó (tối đa 36 câu).
- Nếu tệp chỉ nêu chủ đề -> lập 22 câu chuẩn BGD (12 part_1_choice, 4 part_2_true_false, 6 part_3_short_answer) bám 100% chuyên đề trong tệp.`,
      });

      try {
        const planRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{ role: 'user', parts: planParts }],
          config: buildServerlessModelConfig('gemini-3.1-flash-lite', {
            responseMimeType: 'application/json',
            systemInstruction: 'Bạn là chuyên gia phân tích ma trận đề thi GDPT 2018. Chỉ xuất JSON ngắn gọn liệt kê từng vị trí câu hỏi, KHÔNG giải đề ở bước này.',
          }),
        });
        const parsedPlan = safeParseServerlessJsonWithLatex(planRes.text || '');
        if (parsedPlan?.subject) resolvedSubject = String(parsedPlan.subject);
        if (parsedPlan?.grade) resolvedGrade = String(parsedPlan.grade);
        const rawItems = Array.isArray(parsedPlan?.items)
          ? parsedPlan.items
          : Array.isArray(parsedPlan)
            ? parsedPlan
            : [];
        if (rawItems.length > 0) {
          slots = rawItems.slice(0, 36).map((it: any, i: number) => ({
            n: Number(it?.n) || i + 1,
            partType: normalizeSLPart(it?.partType),
            level: String(it?.level || difficulty),
            topic: String(it?.topic || userPrompt || `${resolvedSubject} ${resolvedGrade}`).slice(0, 220),
          }));
        }
      } catch (planErr: any) {
        const msg = planErr?.message || String(planErr);
        if (isServerlessFatalAuthErr(msg)) {
          return res.status(403).json({ success: false, error: 'Chưa cấu hình hoặc sai Gemini API Key.' });
        }
        console.warn('[Vercel Serverless Phase 1] Blueprint fallback:', msg);
      }
      if (slots.length === 0) {
        slots = buildDefaultBgdSlots(userPrompt || matrixFile?.fileName || `${resolvedSubject} ${resolvedGrade}`);
      }
    } else if (isMatrixExplicit) {
      slots = buildDefaultBgdSlots(userPrompt || `${subject} ${grade}`);
    } else {
      for (let i = 0; i < numQuestions; i++) {
        slots.push({
          n: i + 1,
          partType: 'part_1_choice',
          level: difficulty,
          topic: `${userPrompt || `${subject} ${grade}`} (câu ${i + 1})`,
        });
      }
    }

    const BATCH_SIZE = slots.length <= 8 ? slots.length : 6;
    const batches: SLMatrixSlot[][] = [];
    for (let i = 0; i < slots.length; i += BATCH_SIZE) {
      batches.push(slots.slice(i, i + BATCH_SIZE));
    }

    const compactFileContext =
      hasUploadedFile && matrixText
        ? `\nNgữ cảnh trích từ tệp "${matrixFile?.fileName || ''}" (tham khảo đúng thuật ngữ/công thức/dạng toán):\n"""\n${matrixText.slice(0, 5000)}\n"""`
        : '';

    const batchSystemInstruction = `Bạn là Chuyên gia Khảo thí & Toán/Khoa học chuẩn GDPT 2018 (${resolvedSubject} - ${resolvedGrade}).
QUY TRÌNH GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (BẮT BUỘC ĐỂ ĐẢM BẢO CHÍNH XÁC 100%):
1. Đề bài ("question") phải chặt chẽ, đủ dữ kiện, có DUY NHẤT 1 đáp số chính xác. KHÔNG ra câu vô nghiệm hoặc sai số liệu.
2. TÍNH TOÁN & VIẾT LỜI GIẢI ("explanation") TRƯỚC: Thực hiện đầy đủ phép tính từng bước để tìm ra đáp số cuối cùng.
3. VỚI CÂU PHẦN I (part_1_choice): Sau khi có đáp số ở "explanation", đặt ĐÚNG đáp số đó vào một trong 4 phương án A/B/C/D trong "options", tạo 3 phương án nhiễu hợp lý gần giống kết quả thật (không trùng lặp), rồi ĐỐI CHIẾU LẠI để ghi "correctAnswer" CHÍNH XÁC TUYỆT ĐỐI khớp với chữ cái chứa đáp số đúng (TUYỆT ĐỐI KHÔNG tự ý chọn bừa chữ cái không khớp lời giải; KHÔNG ghi "A. ", "B. " vào "text").
4. VỚI CÂU PHẦN II (part_2_true_false): Mỗi ý a, b, c, d giải và kết luận "correct" (true/false) thật chuẩn xác; đặt "correctAnswer" khớp đúng từng ý (ví dụ "a:Đ, b:S, c:Đ, d:S").
5. VỚI CÂU PHẦN III (part_3_short_answer - Chuẩn phiếu trả lời ngắn BGD 2025): Kết quả cuối cùng PHẢI là 1 giá trị số duy nhất (tối đa 4-5 ký tự gồm dấu trừ/dấu phẩy, ví dụ "12", "-4", "2,5", "0,87"). Nếu kết quả ra phân số thập phân vô hạn (1/3, 7/6...), chứa căn thức (\\\\sqrt{2}, \\\\sqrt{3}...), $\\\\pi$, $e$, $\\\\ln$... BẮT BUỘC ghi rõ yêu cầu làm tròn ngay cuối đề bài "question" (ví dụ: "(kết quả làm tròn đến hàng phần trăm)" hoặc "(kết quả làm tròn đến hàng phần mười)"); đồng thời "shortAnswerKey" và "correctAnswer" CHỈ ĐƯỢC chứa số thập phân đã làm tròn bằng dấu phẩy (ví dụ "0,87" hoặc "-1,33"), TUYỆT ĐỐI KHÔNG để ký hiệu LaTeX ($...$, \\\\frac, \\\\sqrt) hay phân số trong "shortAnswerKey".
6. TOÀN BỘ CÔNG THỨC TOÁN/LÝ/HÓA DÙNG LATEX CHUẨN BỌC 100% TRONG $...$ (escape \\\\ trong JSON): phân số \\\\frac{a}{b}, căn thức \\\\sqrt{x}, mũ/chỉ số bọc ngoặc x^{n+1}, C_n^k, tích phân \\\\int_a^b, giới hạn \\\\lim_{x \\to +\\\\infty}, tập hợp \\\\mathbb{R} \\\\setminus \\\\{1\\\\}, góc \\\\widehat{ABC}, độ ^{\\\\circ}, véctơ \\\\overrightarrow{AB}, \\\\overrightarrow{a}, \\\\overrightarrow{i}, \\\\overrightarrow{j}, \\\\overrightarrow{k}. TUYỆT ĐỐI KHÔNG viết ASCII như vec(AB), frac(a,b), sqrt(x), <=, >=, oo.`;

    const parseBatch = (raw: string): any[] => {
      let parsed = safeParseServerlessJsonWithLatex(raw);
      if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
        parsed = parsed.questions;
      }
      return Array.isArray(parsed) ? parsed : [];
    };

    let lastErr = '';
    const runBatch = async (batchSlots: SLMatrixSlot[], batchIdx: number): Promise<any[]> => {
      const slotSpecs = batchSlots
        .map((s) => {
          const typeLabel =
            s.partType === 'part_1_choice'
              ? 'Phần I (part_1_choice, 4 lựa chọn A/B/C/D)'
              : s.partType === 'part_2_true_false'
                ? 'Phần II Đúng/Sai (part_2_true_false, đủ 4 ý a,b,c,d)'
                : s.partType === 'part_3_short_answer'
                  ? 'Phần III Trả lời ngắn (part_3_short_answer)'
                  : 'Phần IV Tự luận (part_4_essay)';
          return `- Câu số ${s.n}: ${typeLabel} | Mức độ: ${s.level} | Nội dung: ${s.topic}`;
        })
        .join('\n');

      const batchParts: any[] = [];
      if (cleanInlinePart) batchParts.push(cleanInlinePart);
      batchParts.push({
        text: `Hãy soạn ĐÚNG ${batchSlots.length} câu hỏi sau cho đề ${resolvedSubject} (${resolvedGrade}):
${slotSpecs}
${userPrompt ? `Yêu cầu chung của giáo viên: "${userPrompt}"` : ''}${compactFileContext}

Chỉ trả về mảng JSON thuần túy gồm đúng ${batchSlots.length} phần tử theo ĐÚNG THỨ TỰ FIELD (giải trong "explanation" trước khi xuất "options" & "correctAnswer"):
- Phần I: { "slotNumber": 1, "partType": "part_1_choice", "partLabel": "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn", "question": "...", "explanation": "Các bước giải chi tiết ra đáp số...", "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctAnswer": "C", "difficulty": "Nhận biết", "timeLimit": ${timeLimit} }
- Phần II: { "slotNumber": 13, "partType": "part_2_true_false", "partLabel": "Phần II. Câu trắc nghiệm Đúng / Sai", "question": "...", "explanation": "Phân tích từng ý a, b, c, d...", "subStatements": [{"label":"a","statement":"...","correct":true},{"label":"b","statement":"...","correct":false},{"label":"c","statement":"...","correct":true},{"label":"d","statement":"...","correct":false}], "correctAnswer": "a:Đ, b:S, c:Đ, d:S", "options": [], "difficulty": "Thông hiểu", "timeLimit": 60 }
- Phần III: { "slotNumber": 17, "partType": "part_3_short_answer", "partLabel": "Phần III. Câu trắc nghiệm trả lời ngắn", "question": "...", "explanation": "Giải chi tiết ra kết quả...", "shortAnswerKey": "2,5", "correctAnswer": "2,5", "options": [], "difficulty": "Vận dụng", "timeLimit": 45 }
- Phần IV: { "slotNumber": 23, "partType": "part_4_essay", "partLabel": "Phần IV. Tự luận", "question": "...", "explanation": "Lời giải chi tiết...", "essayRubric": "...", "correctAnswer": "Đáp số", "options": [], "difficulty": "Vận dụng", "timeLimit": 120 }`,
      });

      for (const model of SERVERLESS_TEXT_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: batchParts }],
            config: buildServerlessModelConfig(model, {
              responseMimeType: 'application/json',
              systemInstruction: batchSystemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            }),
          });
          const items = parseBatch(response.text || '');
          if (items.length > 0) return items;
        } catch (err: any) {
          lastErr = err?.message || String(err);
          console.warn(`[Vercel Serverless Batch ${batchIdx + 1}] ${model} failed:`, lastErr);
          if (isServerlessFatalAuthErr(lastErr)) throw err;
        }
      }
      return [];
    };

    try {
      const batchResults = await Promise.all(batches.map((b, idx) => runBatch(b, idx)));
      const parsed = batchResults.flat();

      if (parsed.length > 0) {
        const questions = balanceServerlessAnswerDistribution(
          parsed.map((q: any, idx: number) =>
            normalizeServerlessQuestion(q, idx, difficulty, resolvedSubject, Number(timeLimit) || 30)
          ),
          `${userPrompt || matrixFile?.fileName || resolvedGrade}_${Date.now()}`
        );
        return res.status(200).json({ success: true, questions });
      }
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }

    const isAuth = isServerlessFatalAuthErr(lastErr);
    const isQuota = lastErr.includes('RESOURCE_EXHAUSTED') || lastErr.includes('429');
    return res.status(isAuth ? 403 : isQuota ? 429 : 502).json({
      success: false,
      error: isAuth
        ? 'Chưa cấu hình hoặc sai Gemini API Key.'
        : isQuota
          ? 'Hệ thống AI đang quá tải giới hạn lượt gọi (429). Vui lòng thử lại sau ít giây.'
          : `Không thể phân tích ma trận bằng AI (${lastErr ? lastErr.slice(0, 120) : 'phản hồi rỗng'}). Vui lòng thử lại.`,
    });
  }

  // 4. AI Independent Reflection & Critique (Re-solves every question from scratch)
  if (url.includes('/api/ai/critique-quiz') && req.method === 'POST') {
    const { questions = [], subject = 'Toán học', grade = 'Lớp 12' } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách câu hỏi đang trống.' });
    }
    if (!ai) {
      return res.status(403).json({ success: false, error: 'Chưa cấu hình Gemini API Key để phản biện đề.' });
    }

    try {
      const BATCH_SIZE = 5;
      const indexedQuestions = questions.slice(0, 50).map((q: any, idx: number) => ({
        questionIndex: idx,
        questionId: String(q?.id || `q_${idx + 1}`),
        partType: inferServerlessPartType(q),
        question: String(q?.question || ''),
        options: Array.isArray(q?.options) ? q.options : [],
        subStatements: Array.isArray(q?.subStatements) ? q.subStatements : undefined,
        shortAnswerKey: q?.shortAnswerKey,
        currentCorrectAnswer: String(q?.correctAnswer || ''),
        currentExplanation: String(q?.explanation || ''),
      }));

      const batches: Array<typeof indexedQuestions> = [];
      for (let i = 0; i < indexedQuestions.length; i += BATCH_SIZE) {
        batches.push(indexedQuestions.slice(i, i + BATCH_SIZE));
      }

      const critiqueSystemInstruction = `Bạn là CHỦ TỊCH HỘI ĐỒNG PHẢN BIỆN & THẨM ĐỊNH ĐỀ THI ĐỘC LẬP (${subject} - ${grade}, chuẩn GDPT 2018).
NHIỆM VỤ TỐI THƯỢNG: Đọc và TỰ GIẢI LẠI TỪNG CÂU HỎI TỪ CON SỐ 0. TUYỆT ĐỐI KHÔNG TIN TƯỞNG MÙ QUÁNG "currentCorrectAnswer" HAY "currentExplanation".

QUY TRÌNH THẨM ĐỊNH TỪNG CÂU:
1. Kiểm tra đề bài ("question"): Có thiếu giả thiết/điều kiện, sai số liệu, mập mờ câu chữ hoặc có thể hiểu nhiều nghĩa không?
2. Tự giải độc lập từng bước từ đầu ("reSolvedSteps"), tính ra đáp số chuẩn xác 100%.
3. Phân loại "status" CHÍNH XÁC vào 1 trong 4 giá trị:
   - "ok": Đề bài rõ ràng, chặt chẽ; có đúng 1 đáp án duy nhất khớp với kết quả tự giải; và "currentCorrectAnswer" ĐÃ ĐÚNG 100% (với Phần II thì cả 4 ý a,b,c,d đều đúng chân trị).
   - "wrong_answer": Đề bài rõ ràng, phương án đúng ĐÃ NẰM TRONG 4 phương án A/B/C/D, NHƯNG "currentCorrectAnswer" đang chấm NHẦM chữ cái khác (ví dụ giải ra A nhưng ứng dụng lưu B), HOẶC ý Đúng/Sai Phần II / đáp số Phần III đang gắn sai. Khi đó: giữ nguyên đề & options nếu đã chuẩn, chỉ trả về "suggestedPatch" sửa lại đúng "correctAnswer" (hoặc "subStatements"/"shortAnswerKey") và "explanation".
   - "no_correct_option": Kết quả tự giải KHÔNG xuất hiện trong 4 phương án A/B/C/D, HOẶC có >= 2 phương án đúng/trùng lặp giá trị. Khi đó: trả về "suggestedPatch" cung cấp đủ 4 phương án "options" A, B, C, D phân biệt với đúng 1 đáp án đúng, kèm "correctAnswer" và "explanation".
   - "ambiguous": Đề bài chưa rõ ràng, thiếu dữ kiện, sai công thức/số liệu dẫn tới vô nghiệm hoặc không xác định được đáp án duy nhất. Với câu Phần III (part_3_short_answer): nếu đáp số là phân số vô hạn, căn thức, $\\\\pi, e$ mà đề CHƯA ghi yêu cầu làm tròn (hàng phần mười / phần trăm), HOẶC "shortAnswerKey" đang chứa LaTeX/phân số/căn thay vì số thập phân gọn, cũng ĐÁNH DẤU "ambiguous" và trả về "suggestedPatch" thêm yêu cầu làm tròn vào cuối "question" + quy đổi "shortAnswerKey" và "correctAnswer" thành số thập phân đã làm tròn chuẩn (ví dụ "0,87").
4. TOÀN BỘ CÔNG THỨC TOÁN/LÝ/HÓA TRONG "reSolvedSteps", "reason", "suggestedPatch" DÙNG LATEX CHUẨN BỌC TRONG $...$ (escape \\\\ trong JSON, véctơ dùng \\\\overrightarrow{AB}, phân số \\\\frac{a}{b}). KHÔNG viết "A. ", "B. " vào "options[].text".
5. Nếu "status" !== "ok", BẮT BUỘC phải có "suggestedPatch" đầy đủ và đã được kiểm tra khớp 100% giữa kết quả giải và "correctAnswer"!`;

      const parseArr = (raw: string): any[] => {
        let parsed = safeParseServerlessJsonWithLatex(raw);
        if (!parsed) {
          try { parsed = JSON.parse(raw); } catch (_) {}
        }
        if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as any).items)) {
          parsed = (parsed as any).items;
        }
        if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as any).results)) {
          parsed = (parsed as any).results;
        }
        return Array.isArray(parsed) ? parsed : [];
      };

      const runCritiqueBatch = async (batch: typeof indexedQuestions): Promise<any[]> => {
        const prompt = `Hãy phản biện, giải lại độc lập từ đầu và thẩm định chính xác từng câu trong ${batch.length} câu sau:
${JSON.stringify(batch)}

Trả về ĐÚNG 1 mảng JSON thuần túy gồm ${batch.length} phần tử, mỗi phần tử có cấu trúc:
{
  "questionId": "...",
  "questionIndex": 0,
  "status": "ok" | "wrong_answer" | "no_correct_option" | "ambiguous",
  "reason": "Nhận xét ngắn gọn rõ ràng (nếu lỗi ghi rõ lỗi gì, đáp án cũ sai ở đâu).",
  "reSolvedSteps": "Các bước giải độc lập chi tiết ra đáp số chuẩn bằng LaTeX $...$.",
  "verifiedCorrectAnswer": "A",
  "suggestedPatch": {
    "question": "(chỉ cần nếu sửa đề, hoặc giữ nguyên)",
    "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
    "subStatements": [],
    "shortAnswerKey": "...",
    "correctAnswer": "A",
    "explanation": "Lời giải chuẩn xác khớp hoàn toàn đáp án..."
  }
}`;
        let lastBatchErr: any;
        for (const model of SERVERLESS_TEXT_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: buildServerlessModelConfig(model, {
                responseMimeType: 'application/json',
                systemInstruction: critiqueSystemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
              }),
            });
            const items = parseArr((response.text || '').trim());
            if (items.length > 0) return items;
          } catch (err: any) {
            lastBatchErr = err;
            if (isServerlessFatalAuthErr(err?.message || String(err))) throw err;
          }
        }
        if (lastBatchErr) throw lastBatchErr;
        return [];
      };

      const batchResults = await Promise.all(
        batches.map((b) =>
          runCritiqueBatch(b).catch((err) => {
            console.warn('[Vercel Serverless Critique Batch] Error:', err?.message || err);
            return b.map((item) => ({
              questionId: item.questionId,
              questionIndex: item.questionIndex,
              status: 'ok',
              reason: 'Chưa phản biện được câu này do nghẽn mạng.',
              reSolvedSteps: item.currentExplanation || '',
              verifiedCorrectAnswer: item.currentCorrectAnswer,
            }));
          })
        )
      );

      const flatRaw = batchResults.flat();
      const byId = new Map<string, any>();
      const byIdx = new Map<number, any>();
      flatRaw.forEach((r: any) => {
        if (r?.questionId) byId.set(String(r.questionId), r);
        if (typeof r?.questionIndex === 'number') byIdx.set(r.questionIndex, r);
      });

      const sanitizedCritiques = indexedQuestions.map((orig) => {
        const raw = byId.get(orig.questionId) || byIdx.get(orig.questionIndex) || {};
        const validStatuses = new Set(['ok', 'wrong_answer', 'no_correct_option', 'ambiguous']);
        let status = validStatuses.has(raw.status) ? raw.status : 'ok';
        const reSolvedSteps = normalizeServerlessMathInText(String(raw.reSolvedSteps || orig.currentExplanation || ''));
        const reason = normalizeServerlessMathInText(String(raw.reason || (status === 'ok' ? 'Đề rõ ràng và đáp án chính xác.' : 'Cần kiểm tra lại câu hỏi/đáp án.')));

        let verifiedCorrectAnswer = String(raw.verifiedCorrectAnswer || orig.currentCorrectAnswer || 'A');
        if (orig.partType === 'part_1_choice') {
          verifiedCorrectAnswer = extractServerlessChoiceKey(verifiedCorrectAnswer);
        } else if (orig.partType === 'part_3_short_answer') {
          const targetQText =
            typeof raw?.suggestedPatch?.question === 'string' && raw.suggestedPatch.question.trim()
              ? raw.suggestedPatch.question
              : orig.question;
          verifiedCorrectAnswer = formatPlainShortAnswerKeyServerless(verifiedCorrectAnswer, targetQText).key;
        }

        let suggestedPatch: any = undefined;
        if (status !== 'ok' && raw.suggestedPatch && typeof raw.suggestedPatch === 'object') {
          const patch = { ...raw.suggestedPatch };
          const cleanPatch: any = {
            explanation: normalizeServerlessMathInText(String(patch.explanation || reSolvedSteps || orig.currentExplanation)),
            correctAnswer: String(patch.correctAnswer || verifiedCorrectAnswer),
          };
          if (typeof patch.question === 'string' && patch.question.trim()) {
            cleanPatch.question = normalizeServerlessMathInText(patch.question.trim());
          }
          if (orig.partType === 'part_1_choice') {
            const baseOpts = Array.isArray(patch.options) && patch.options.length >= 4 ? patch.options : orig.options;
            if (Array.isArray(baseOpts) && baseOpts.length >= 4) {
              cleanPatch.options = ['A', 'B', 'C', 'D'].map((k, oIdx) => {
                const found = baseOpts.find((o: any) => String(o?.key || '').trim().toUpperCase().replace(/[\.\)]$/, '') === k) || baseOpts[oIdx];
                const txt = typeof found === 'string' ? found : String(found?.text || `Phương án ${k}`);
                return { key: k, text: normalizeServerlessMathInText(stripServerlessChoicePrefix(txt) || txt) };
              });
            }
            cleanPatch.correctAnswer = extractServerlessChoiceKey(cleanPatch.correctAnswer || verifiedCorrectAnswer);
            verifiedCorrectAnswer = cleanPatch.correctAnswer;
          } else if (orig.partType === 'part_2_true_false') {
            const baseSubs = Array.isArray(patch.subStatements) && patch.subStatements.length > 0 ? patch.subStatements : orig.subStatements;
            if (Array.isArray(baseSubs) && baseSubs.length > 0) {
              cleanPatch.subStatements = baseSubs.map((s: any, sIdx: number) => {
                const label = s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
                const statement = normalizeServerlessMathInText(s.statement || s.text || '');
                const correct = typeof s.correct === 'boolean' ? s.correct : Boolean(s.isCorrect);
                return { id: s.id || `sub_${orig.questionIndex}_${sIdx}`, key: label, label, statement, text: statement, correct, isCorrect: correct };
              });
              cleanPatch.correctAnswer = cleanPatch.subStatements.map((s: any) => `${s.label}:${s.correct ? 'Đ' : 'S'}`).join(', ');
              verifiedCorrectAnswer = cleanPatch.correctAnswer;
            }
          } else if (orig.partType === 'part_3_short_answer') {
            const formattedShort = formatPlainShortAnswerKeyServerless(
              String(patch.shortAnswerKey ?? patch.correctAnswer ?? verifiedCorrectAnswer),
              cleanPatch.question || orig.question
            );
            if (formattedShort.roundedWithDecimals !== undefined) {
              cleanPatch.question = ensurePart3RoundingServerless(cleanPatch.question || orig.question, formattedShort.roundedWithDecimals);
            }
            cleanPatch.shortAnswerKey = formattedShort.key;
            cleanPatch.correctAnswer = formattedShort.key;
            verifiedCorrectAnswer = formattedShort.key;
          }

          if (
            status === 'wrong_answer' &&
            orig.partType === 'part_1_choice' &&
            cleanPatch.correctAnswer === extractServerlessChoiceKey(orig.currentCorrectAnswer) &&
            !cleanPatch.question
          ) {
            status = 'ok';
          } else {
            suggestedPatch = cleanPatch;
          }
        } else if (status !== 'ok') {
          suggestedPatch = {
            correctAnswer: verifiedCorrectAnswer,
            explanation: reSolvedSteps || orig.currentExplanation,
          };
        }

        return {
          questionId: orig.questionId,
          questionIndex: orig.questionIndex,
          status,
          reason,
          reSolvedSteps,
          verifiedCorrectAnswer,
          ...(suggestedPatch ? { suggestedPatch } : {}),
        };
      });

      return res.status(200).json({ success: true, items: sanitizedCritiques });
    } catch (e: any) {
      const msg = e?.message || String(e);
      return res.status(isServerlessFatalAuthErr(msg) ? 403 : 502).json({
        success: false,
        error: isServerlessFatalAuthErr(msg)
          ? 'Chưa cấu hình hoặc sai Gemini API Key.'
          : `Không thể phản biện đề lúc này (${msg.slice(0, 120)}).`,
      });
    }
  }

  // 5. Generate Similar Isomorphic Online Exam Variants (Adaptive 4-question batches)
  if (url.includes('/api/ai/generate-exam-variants') && req.method === 'POST') {
    const {
      questions = [],
      variantCount = 2,
      distinctCount,
      subject = 'Toán học',
      grade = 'Lớp 12',
      title = 'Đề kiểm tra online',
    } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Danh sách câu hỏi gốc đang trống.' });
    }
    if (!ai) {
      return res.status(403).json({ success: false, error: 'Chưa cấu hình Gemini API Key.' });
    }

    const requestedSets = Number(distinctCount) || (Math.min(20, Math.max(2, Number(variantCount) || 2)) - 1);
    const extraCount = Math.min(3, Math.max(1, requestedSets));

    try {
      const compactSource = questions.slice(0, 36).map((q: any, i: number) => ({
        idx: i + 1,
        partType: inferServerlessPartType(q),
        question: q.question,
        options: q.options,
        subStatements: q.subStatements,
        shortAnswerKey: q.shortAnswerKey,
        correctAnswer: q.correctAnswer,
      }));

      const BATCH_SIZE = 4;
      const batches: Array<typeof compactSource> = [];
      for (let i = 0; i < compactSource.length; i += BATCH_SIZE) {
        batches.push(compactSource.slice(i, i + BATCH_SIZE));
      }

      const parseArr = (rawText: string): any[] => {
        let parsed = safeParseServerlessJsonWithLatex(rawText);
        if (!parsed) {
          try { parsed = JSON.parse(rawText); } catch (_) {}
        }
        if (parsed && !Array.isArray(parsed)) {
          if (Array.isArray((parsed as any).questions)) parsed = (parsed as any).questions;
          else if (Array.isArray((parsed as any).items)) parsed = (parsed as any).items;
        }
        return Array.isArray(parsed) ? parsed : [];
      };

      let hydrogenBusy = false;

      const runVariantBatch = async (setIdx: number, batchItems: typeof compactSource): Promise<any[]> => {
        const prompt = `Bạn là Chuyên gia Khảo thí Bộ GD&ĐT Việt Nam.
Hãy tạo BỘ CÂU HỎI TƯƠNG ĐƯƠNG #${setIdx + 2} cho đề "${title}" (${subject} - ${grade}) từ ${batchItems.length} câu gốc sau:
${JSON.stringify(batchItems)}

QUY TẮC BẮT BUỘC:
1. PHẢI BIẾN ĐỔI ĐỀ (KHÔNG CHÉP NGUYÊN VĂN ĐỀ GỐC): Giữ nguyên dạng toán/kiến thức và độ khó, NHƯNG thay đổi số liệu, hệ số, biểu thức hàm số hoặc giả thiết tương đương.
2. GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (ĐÚNG THỨ TỰ FIELD JSON):
   - "idx": giữ nguyên đúng số idx từ câu gốc.
   - "question": đề bài mới với số liệu mới.
   - "explanation": Giải ngắn gọn súc tích (1-3 câu) từ đầu theo số liệu mới ra đúng đáp số (KHÔNG ghi cứng chữ cái đáp án).
   - "options" (cho part_1_choice): 4 phương án A/B/C/D phân biệt (KHÔNG ghi "A. " vào text), có ĐÚNG 1 phương án khớp kết quả vừa giải.
   - "subStatements" (cho part_2_true_false): đủ 4 ý a, b, c, d với "correct": true/false chuẩn theo số liệu mới.
   - "shortAnswerKey" (cho part_3_short_answer): 1 con số duy nhất (tối đa 4-5 ký tự, ví dụ "12", "2,5", "-0,87"). Nếu ra phân số vô hạn, căn thức, $\\\\pi, e$... BẮT BUỘC thêm yêu cầu làm tròn vào cuối "question" như "(kết quả làm tròn đến hàng phần trăm)" hoặc "(hàng phần mười)" và chỉ xuất số thập phân đã làm tròn bằng dấu phẩy vào "shortAnswerKey" & "correctAnswer" (KHÔNG để LaTeX hay phân số trong shortAnswerKey).
   - "correctAnswer": xuất SAU CÙNG, khớp tuyệt đối 100% với đáp số vừa giải.
3. Công thức toán/lý/hóa dùng LaTeX chuẩn bọc trong $...$, véctơ dùng \\\\overrightarrow{AB}, escape \\\\ trong JSON.
Trả về ĐÚNG 1 mảng JSON thuần túy gồm ${batchItems.length} phần tử.`;

        const candidateModels = hydrogenBusy
          ? (['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as const)
          : SERVERLESS_TEXT_MODELS;

        for (const model of candidateModels) {
          try {
            const resp = await Promise.race([
              ai.models.generateContent({
                model,
                contents: prompt,
                config: buildServerlessModelConfig(model, {
                  responseMimeType: 'application/json',
                  systemInstruction: 'Bạn là chuyên gia tạo đề thi tương đương chuẩn GDPT 2018. Luôn đổi mới số liệu/hàm số và tự giải chính xác từng bước trước khi xuất options và correctAnswer.',
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
                }),
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout for ${model}`)), 35000)
              ),
            ]);
            const items = parseArr((resp.text || '').trim());
            if (items.length > 0) return items;
          } catch (err: any) {
            const msg = err?.message || String(err);
            if (isServerlessFatalAuthErr(msg)) throw err;
            if (model.startsWith('gemini-4') && (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand'))) {
              hydrogenBusy = true;
            }
          }
        }
        return [];
      };

      const tasks: Array<{ setIdx: number; batch: typeof compactSource }> = [];
      for (let s = 0; s < extraCount; s++) {
        for (const batch of batches) {
          tasks.push({ setIdx: s, batch });
        }
      }

      const collectedBySet: any[][] = Array.from({ length: extraCount }, () => []);
      const CONCURRENCY = 4;
      let cursor = 0;
      const worker = async () => {
        while (cursor < tasks.length) {
          const t = tasks[cursor++];
          const items = await runVariantBatch(t.setIdx, t.batch);
          if (items.length > 0) collectedBySet[t.setIdx].push(...items);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));

      const cleanedVariants: any[] = [];
      for (let vIdx = 0; vIdx < extraCount; vIdx++) {
        const rawItems = collectedBySet[vIdx];
        if (!rawItems || rawItems.length === 0) continue;

        const byIdx = new Map<number, any>();
        rawItems.forEach((item: any, arrIdx: number) => {
          const n = Number(item?.idx);
          if (Number.isFinite(n) && n >= 1 && n <= compactSource.length) {
            byIdx.set(n - 1, item);
          } else if (!byIdx.has(arrIdx)) {
            byIdx.set(arrIdx, item);
          }
        });

        const normQs = compactSource.map((origQ, qIdx) => {
          const raw = byIdx.get(qIdx) || rawItems[qIdx];
          if (!raw || typeof raw !== 'object' || !raw.question) {
            return normalizeServerlessQuestion(questions[qIdx], qIdx, String(questions[qIdx]?.difficulty || 'Thông hiểu'), subject, Number(questions[qIdx]?.timeLimit || 30));
          }
          return normalizeServerlessQuestion(
            {
              ...questions[qIdx],
              ...raw,
              partType: inferServerlessPartType(origQ),
              partLabel: raw.partLabel || questions[qIdx]?.partLabel,
            },
            qIdx,
            String(raw.difficulty || questions[qIdx]?.difficulty || 'Thông hiểu'),
            subject,
            Number(raw.timeLimit || questions[qIdx]?.timeLimit || 30)
          );
        });

        cleanedVariants.push({
          code: String(102 + vIdx),
          questions: balanceServerlessAnswerDistribution(normQs, `sl_var_${vIdx}_${Date.now()}`),
        });
      }

      if (cleanedVariants.length > 0) {
        return res.status(200).json({ success: true, variants: cleanedVariants, usedAI: true });
      }
      return res.status(502).json({ success: false, error: 'AI tạm thời chưa tạo được đề tương tự mới.' });
    } catch (err: any) {
      const msg = err?.message || String(err);
      return res.status(isServerlessFatalAuthErr(msg) ? 403 : 502).json({
        success: false,
        error: isServerlessFatalAuthErr(msg)
          ? 'Chưa cấu hình hoặc sai Gemini API Key.'
          : `Không thể tạo đề tương tự lúc này (${msg.slice(0, 120)}).`,
      });
    }
  }

  // 6. Generate Structured Teaching Method (Phương Pháp Giảng Dạy)
  if (url.includes('/api/ai/generate-teaching-method') && req.method === 'POST') {
    const {
      prompt: rawPrompt = '',
      subject = 'Toán học',
      grade = 'Lớp 12',
      targetLevel = 'Chuẩn SGK (Thông hiểu - Vận dụng)',
      exerciseCount = 4,
      mode = 'full',
      methodMode = 'by_type',
      textbookLesson = '',
      fastMode = false,
      existingMethod = null,
    } = req.body || {};

    const cleanLesson = String(textbookLesson || '').trim();
    const trimmedPrompt = String(rawPrompt || '').trim() || cleanLesson;
    if (!trimmedPrompt && mode !== 'more_exercises') {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn bài học SGK hoặc nhập yêu cầu nội dung cần lập phương pháp giảng dạy.' });
    }
    if (!ai) {
      return res.status(403).json({ success: false, error: 'Chưa cấu hình Gemini API Key.' });
    }

    const parseJsonObjectRobust = (rawText: string): any => {
      if (!rawText) return null;
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const candidates: string[] = [cleaned];
      const startObj = cleaned.indexOf('{');
      const endObj = cleaned.lastIndexOf('}');
      if (startObj !== -1 && endObj > startObj) {
        candidates.push(cleaned.slice(startObj, endObj + 1));
      }
      for (const candidate of candidates) {
        const escaped = escapeUnescapedLatexInJsonServerless(candidate);
        for (const variant of [escaped, candidate]) {
          try {
            const parsed = JSON.parse(variant);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return parsed;
            }
          } catch (_) {}
        }
      }
      return null;
    };

    const parseJsonArrayRobust = (rawText: string): any[] => {
      const parsed = safeParseServerlessJsonWithLatex(rawText);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).exercises)) {
        return (parsed as any).exercises;
      }
      return [];
    };

    const normMath = (val: any): string => (val === null || val === undefined ? '' : normalizeServerlessMathInText(String(val)));
    const count = Math.min(Math.max(Number(exerciseCount) || 4, 2), 6);

    const callModelWithFallback = async (promptText: string, systemInstruction: string, timeoutMs: number) => {
      const modelsOrder = fastMode
        ? (['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as const)
        : SERVERLESS_TEXT_MODELS;
      let lastErr: any = null;
      for (const model of modelsOrder) {
        try {
          return await Promise.race([
            ai.models.generateContent({
              model,
              contents: promptText,
              config: buildServerlessModelConfig(model, {
                responseMimeType: 'application/json',
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s for ${model}`)), timeoutMs)),
          ]);
        } catch (err: any) {
          lastErr = err;
          if (isServerlessFatalAuthErr(err?.message || String(err))) throw err;
        }
      }
      throw lastErr || new Error('All models failed');
    };

    try {
      if (mode === 'more_exercises' && existingMethod) {
        const existingProblems = Array.isArray(existingMethod.exercises)
          ? existingMethod.exercises.map((e: any) => e.problem).slice(0, 8)
          : [];
        const morePrompt = `Bạn là chuyên gia sư phạm môn ${subject} (${grade}) theo chương trình GDPT 2018 (bộ SGK Kết nối tri thức với cuộc sống).
Dựa trên phương pháp: "${existingMethod.title || trimmedPrompt}"
Các bước giải chuẩn: ${JSON.stringify((existingMethod.steps || []).map((s: any) => s.title))}
Các công thức trọng tâm: ${JSON.stringify((existingMethod.formulas || []).map((f: any) => `${f.name}: ${f.expression}`))}
Các bài đã có (KHÔNG ĐƯỢC TRÙNG LẶP): ${JSON.stringify(existingProblems)}

Hãy tạo thêm ĐÚNG ${count} BÀI TẬP TƯƠNG TỰ MỚI cho học sinh luyện tập, thay đổi hoàn toàn số liệu/hàm số/ngữ cảnh, phân mức độ từ Cơ bản -> Thông hiểu -> Vận dụng.
QUY TẮC BẮT BUỘC:
1. Giải chính xác từng bài trước rồi mới viết "shortAnswer".
2. Mọi công thức toán/lý/hóa bọc trong $...$, escape \\\\ trong JSON.
3. Trả về ĐÚNG 1 mảng JSON gồm ${count} phần tử:
[
  {
    "level": "Cơ bản | Thông hiểu | Vận dụng",
    "problem": "Đề bài đầy đủ...",
    "hint": "Gợi ý hướng đi theo các bước đã học (1-2 câu)...",
    "solutionSteps": "Lời giải chi tiết từng bước từ đầu đến cuối...",
    "shortAnswer": "Đáp số cuối cùng gọn, chính xác 100%"
  }
]`;

        const resp = await callModelWithFallback(
          morePrompt,
          'Bạn là giáo viên giỏi chuyên môn. Tự giải cẩn thận từng bước trước khi xuất đáp án để đảm bảo độ chính xác tuyệt đối.',
          24000
        );
        const arr = parseJsonArrayRobust((resp.text || '').trim());
        if (arr.length === 0) {
          return res.status(502).json({ success: false, error: 'AI chưa trả về được danh sách bài tập tương tự mới.' });
        }
        const startIdx = Array.isArray(existingMethod.exercises) ? existingMethod.exercises.length : 0;
        const exercises = arr.map((ex: any, i: number) => ({
          id: `ex_${Date.now()}_${i + 1}`,
          index: startIdx + i + 1,
          level: String(ex.level || (i === 0 ? 'Cơ bản' : i === arr.length - 1 ? 'Vận dụng' : 'Thông hiểu')),
          problem: normMath(ex.problem || ''),
          hint: normMath(ex.hint || ''),
          solutionSteps: normMath(ex.solutionSteps || ''),
          shortAnswer: normMath(ex.shortAnswer || ''),
        }));
        return res.status(200).json({ success: true, exercises });
      }

      const isTextbookMode = methodMode === 'by_textbook';
      const textbookContext = isTextbookMode
        ? `\nCHẾ ĐỘ BIÊN SOẠN: THEO BÀI HỌC SGK "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG" (CHƯƠNG TRÌNH GDPT 2018).
- Bài học SGK mục tiêu: "${cleanLesson || trimmedPrompt}" (${subject} - ${grade}).
${rawPrompt && rawPrompt.trim() && rawPrompt.trim() !== cleanLesson ? `- Yêu cầu/trọng tâm bổ sung từ giáo viên: "${rawPrompt.trim()}".\n` : ''}- BẮT BUỘC bám sát cấu trúc, định nghĩa, định lý, ký hiệu và thuật ngữ chuẩn của bộ SGK Kết nối tri thức với cuộc sống (GDPT 2018).`
        : `\nCHẾ ĐỘ BIÊN SOẠN: THEO DẠNG BÀI / YÊU CẦU CỤ THỂ CỦA GIÁO VIÊN (${subject} - ${grade}, chuẩn GDPT 2018).
- Nội dung/Đề bài yêu cầu: "${trimmedPrompt}"
- Nếu yêu cầu có chứa một đề bài cụ thể thì Ví dụ 1 BẮT BUỘC giải chính xác bài toán đó theo đúng trình tự các bước ở mục steps.`;

      const fullPrompt = `Bạn là Chuyên gia Sư phạm hàng đầu Việt Nam (${subject} - ${grade}, Chương trình GDPT 2018 - bộ SGK Kết nối tri thức với cuộc sống).
${textbookContext}
Mức độ mục tiêu: ${targetLevel}

Hãy biên soạn BỘ PHƯƠNG PHÁP GIẢNG DẠY súc tích, chuẩn mực, chính xác 100% để trình chiếu giảng trực tiếp gồm:
1. Tổng quan nhận diện dạng bài & những sai lầm học sinh hay mắc.
2. Trình tự các bước giải tổng quát (3 đến 5 bước rõ ràng, kèm công thức áp dụng và lưu ý).
3. Hệ thống công thức / định lý trọng tâm (2 đến 5 công thức chuẩn).
4. Ví dụ minh họa (1 ví dụ tiêu biểu giải chi tiết từng bước khớp hoàn toàn với trình tự ở mục 2, kèm mẹo kiểm tra bằng Casio fx-580VN X nếu phù hợp).
5. Đúng ${count} BÀI TẬP TƯƠNG TỰ tự luyện (từ Cơ bản đến Thông hiểu, Vận dụng), mỗi bài có gợi ý ngắn, lời giải từng bước súc tích và đáp số cuối cùng chính xác 100%.

QUY TẮC KỸ THUẬT BẮT BUỘC:
- Mọi công thức Toán/Lý/Hóa/Sinh dùng LaTeX chuẩn SGK Việt Nam bọc trong $...$ (vectơ dùng \\overrightarrow{AB}, phân số \\frac{a}{b}). Trong JSON phải escape dấu \\ thành \\\\.
- Tự tính toán cẩn thận từ đầu đến cuối trước khi xuất đáp số.
- Trả về ĐÚNG 1 đối tượng JSON hợp lệ theo mẫu:
{
  "title": "Tên phương pháp / Bài học ngắn gọn",
  "recognitionSigns": "Dấu hiệu nhận biết dạng bài (hoặc trọng tâm kiến thức bài học SGK)...",
  "learningObjective": "Mục tiêu kiến thức & kỹ năng...",
  "commonMistakes": ["Sai lầm hay gặp 1...", "Sai lầm hay gặp 2..."],
  "steps": [
    { "stepNumber": 1, "title": "Tên bước 1", "actionGuide": "Hướng dẫn thực hiện (1-3 câu)...", "formula": "$...$", "keyNote": "Mẹo nhớ / bẫy..." }
  ],
  "formulas": [
    { "name": "Tên công thức", "expression": "$...$", "condition": "Điều kiện áp dụng..." }
  ],
  "examples": [
    {
      "title": "Ví dụ minh họa 1",
      "problem": "Đề bài ví dụ...",
      "stepByStepSolution": [ { "stepLabel": "Bước 1", "content": "...", "resultFormula": "$...$" } ],
      "finalAnswer": "Đáp số cuối cùng...",
      "teacherTip": "Mẹo giảng hoặc kiểm tra bằng Casio fx-580VN X..."
    }
  ],
  "exercises": [
    { "level": "Cơ bản", "problem": "Đề bài...", "hint": "Gợi ý...", "solutionSteps": "Lời giải chi tiết...", "shortAnswer": "Đáp số" }
  ]
}`;

      const resp = await callModelWithFallback(
        fullPrompt,
        'Bạn là Chuyên gia Khảo thí & Sư phạm Bộ GD&ĐT (SGK Kết nối tri thức 2018). Trả về đúng 1 JSON object hợp lệ, công thức LaTeX chuẩn SGK và lời giải chính xác tuyệt đối.',
        24000
      );
      const parsed = parseJsonObjectRobust((resp.text || '').trim());
      if (!parsed) {
        return res.status(502).json({ success: false, error: 'AI chưa trả về đúng định dạng phương pháp giảng dạy.' });
      }
      const now = new Date().toISOString();
      const methodPlan = {
        id: `method_${Date.now()}`,
        title: normMath(parsed.title || cleanLesson || trimmedPrompt.slice(0, 120)),
        prompt: isTextbookMode && cleanLesson
          ? `${cleanLesson}${rawPrompt && rawPrompt.trim() && rawPrompt.trim() !== cleanLesson ? ` — ${rawPrompt.trim()}` : ''} (SGK Kết nối tri thức)`
          : trimmedPrompt,
        subject,
        grade,
        targetLevel,
        recognitionSigns: normMath(parsed.recognitionSigns || ''),
        learningObjective: normMath(parsed.learningObjective || ''),
        commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes.map((m: any) => normMath(m)).filter(Boolean) : [],
        steps: Array.isArray(parsed.steps)
          ? parsed.steps.map((s: any, idx: number) => ({
              stepNumber: Number(s.stepNumber) || idx + 1,
              title: normMath(s.title || `Bước ${idx + 1}`),
              actionGuide: normMath(s.actionGuide || s.description || ''),
              formula: normMath(s.formula || ''),
              keyNote: normMath(s.keyNote || ''),
            }))
          : [],
        formulas: Array.isArray(parsed.formulas)
          ? parsed.formulas.map((f: any) => ({
              name: normMath(f.name || 'Công thức trọng tâm'),
              expression: normMath(f.expression || f.formula || ''),
              condition: normMath(f.condition || ''),
            }))
          : [],
        examples: Array.isArray(parsed.examples)
          ? parsed.examples.map((ex: any, idx: number) => ({
              title: normMath(ex.title || `Ví dụ minh họa ${idx + 1}`),
              problem: normMath(ex.problem || ''),
              stepByStepSolution: Array.isArray(ex.stepByStepSolution)
                ? ex.stepByStepSolution.map((st: any, sIdx: number) => ({
                    stepLabel: normMath(st.stepLabel || `Bước ${sIdx + 1}`),
                    content: normMath(st.content || ''),
                    resultFormula: normMath(st.resultFormula || ''),
                  }))
                : [],
              finalAnswer: normMath(ex.finalAnswer || ''),
              teacherTip: normMath(ex.teacherTip || ''),
            }))
          : [],
        exercises: Array.isArray(parsed.exercises)
          ? parsed.exercises.map((ex: any, idx: number) => ({
              id: `ex_${Date.now()}_${idx + 1}`,
              index: idx + 1,
              level: String(ex.level || (idx === 0 ? 'Cơ bản' : idx === parsed.exercises.length - 1 ? 'Vận dụng' : 'Thông hiểu')),
              problem: normMath(ex.problem || ''),
              hint: normMath(ex.hint || ''),
              solutionSteps: normMath(ex.solutionSteps || ''),
              shortAnswer: normMath(ex.shortAnswer || ''),
            }))
          : [],
        createdAt: now,
        updatedAt: now,
      };
      return res.status(200).json({ success: true, method: methodPlan });
    } catch (err: any) {
      const msg = err?.message || String(err);
      return res.status(isServerlessFatalAuthErr(msg) ? 403 : 502).json({
        success: false,
        error: isServerlessFatalAuthErr(msg)
          ? 'Chưa cấu hình hoặc sai Gemini API Key.'
          : `Không thể tạo phương pháp giảng dạy lúc này (${msg.slice(0, 120)}).`,
      });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found on serverless router' });
}

