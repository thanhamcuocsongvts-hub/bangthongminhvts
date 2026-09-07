import React, { useMemo } from 'react';
import katex from 'katex';

interface MathFormulaRendererProps {
  content?: string;
  text?: string;
  className?: string;
  isBlock?: boolean;
}

// Convert simple science / chemistry notations like H2O, CO2, C6H12O6, Fe2+, SO4^2-, -> into clean LaTeX
export function formatScienceFormulaToLatex(text: string): string {
  if (!text) return '';
  let formatted = text;

  // If already standard LaTeX with \frac or \sqrt or $, preserve it
  if (formatted.includes('\\') || formatted.includes('$')) {
    return formatted;
  }

  // Replace chemical reaction arrows
  formatted = formatted
    .replace(/<->|<=>|⇌/g, '\\rightleftharpoons ')
    .replace(/->|⟶|→/g, '\\longrightarrow ')
    .replace(/↑/g, '\\uparrow ')
    .replace(/↓/g, '\\downarrow ');

  // Format chemical formulas with numbers into subscripts, e.g., H2O -> H_2O, C6H12O6 -> C_6H_{12}O_6
  formatted = formatted.replace(/\b([A-Z][a-z]?)(\d+)\b/g, '$1_{$2}');
  formatted = formatted.replace(/\b([A-Z][a-z]?)(\d+)([A-Z][a-z]?)(\d+)\b/g, '$1_{$2}$3_{$4}');
  formatted = formatted.replace(/\b([A-Z][a-z]?)(\d+)([A-Z][a-z]?)(\d+)\b/g, '$1_{$2}$3_{$4}$5_{$6}');

  return formatted;
}

// Sanitize and adapt math expressions to guarantee 100% KaTeX compatibility without parse errors
export function sanitizeMathExpression(raw: string): string {
  if (!raw) return '';
  let math = raw.trim();

  // Normalize excessive backslashes (e.g. \\\\frac -> \\frac)
  math = math.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // Normalize common Vietnamese textbook LaTeX macros
  math = math
    .replace(/\\degree/g, '^{\\circ}')
    .replace(/\\tg\b/g, '\\tan')
    .replace(/\\cotg\b/g, '\\cot')
    .replace(/\\arctg\b/g, '\\arctan')
    .replace(/\\varDelta\b/g, '\\Delta')
    .replace(/\\empty\b/g, '\\emptyset')
    .replace(/\\parallel/g, '\\parallel ')
    .replace(/\\rightarrow/g, '\\to ')
    .replace(/\\leftrightarrow/g, '\\longleftrightarrow ')
    .replace(/\\le\b/g, '\\le ')
    .replace(/\\ge\b/g, '\\ge ')
    .replace(/\\ne\b/g, '\\neq ');

  // Wrap Vietnamese words inside math mode in \text{...} so KaTeX does not crash on non-ASCII characters
  const vietnameseWordRegex = /([a-zA-Z0-9]*[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]+[a-zA-Z0-9]*)/g;

  // Protect existing \text{...} blocks from double-wrapping
  math = math.replace(/\\text\{[^{}]*\}/g, (m) => m.replace(/./g, (c) => `__K_${c.charCodeAt(0)}__`));
  math = math.replace(vietnameseWordRegex, (word) => `\\text{ ${word} }`);
  math = math.replace(/__K_(\d+)__/g, (_, code) => String.fromCharCode(Number(code)));

  return math;
}

export const MathFormulaRenderer: React.FC<MathFormulaRendererProps> = ({
  content,
  text,
  className = '',
  isBlock = false,
}) => {
  const renderedHtml = useMemo(() => {
    const rawInput = content ?? text ?? '';
    if (!rawInput) return '';

    // Normalize LaTeX brackets \( \) -> $, \[ \] -> $$
    let normalized = rawInput
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // Auto-detect unwrapped LaTeX commands like \frac{...}{...}, \sqrt{...} if not wrapped in $
    if (!normalized.includes('$') && /\\(frac|sqrt|int|lim|vec|alpha|beta|gamma|theta|lambda|pi|Delta|infty|sum|times|le|ge|neq|approx|rightarrow|leftarrow)/.test(normalized)) {
      normalized = normalized.replace(/([a-zA-Z0-9+\-*=><\s\\{}^_()]{4,})/g, (match) => {
        if (/\\(frac|sqrt|int|lim|vec|alpha|beta|Delta|infty|sum)/.test(match)) {
          return `$${match.trim()}$`;
        }
        return match;
      });
    }

    // Check if the content contains explicit LaTeX $ or $$
    const hasMathDelimiters = normalized.includes('$');

    if (hasMathDelimiters) {
      // Parse chunks of text and math
      const parts = normalized.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

      return parts
        .map((part) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim();
            const cleanMath = sanitizeMathExpression(math);
            try {
              const rendered = katex.renderToString(cleanMath, { displayMode: true, throwOnError: false, strict: false });
              return rendered;
            } catch {
              return `<div class="my-2 p-2 font-mono text-center text-indigo-800 bg-indigo-50/70 rounded-xl">${escapeHtml(math)}</div>`;
            }
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim();
            const cleanMath = sanitizeMathExpression(math);
            try {
              const rendered = katex.renderToString(cleanMath, { displayMode: false, throwOnError: false, strict: false });
              return rendered;
            } catch {
              return `<span class="font-mono text-indigo-700 bg-indigo-50/50 px-1 py-0.5 rounded font-medium">${escapeHtml(math)}</span>`;
            }
          } else {
            return escapeHtml(part);
          }
        })
        .join('');
    }

    // If it's a designated block formula (e.g. from slide formula or quiz formula)
    if (isBlock) {
      const latex = formatScienceFormulaToLatex(normalized);
      const cleanMath = sanitizeMathExpression(latex);
      try {
        const rendered = katex.renderToString(cleanMath, { displayMode: true, throwOnError: false, strict: false });
        return rendered;
      } catch {
        return escapeHtml(normalized);
      }
    }

    // Standard text
    return escapeHtml(normalized);
  }, [content, text, isBlock]);

  return (
    <span
      className={`inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
