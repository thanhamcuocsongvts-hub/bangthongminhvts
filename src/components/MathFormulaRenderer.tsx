import React, { useMemo } from 'react';
import katex from 'katex';
import {
  normalizeAccentsAndUnicodeScripts,
  normalizeAllMathInText,
  sanitizeMathExpression,
  splitMathDelimiters,
} from '../utils/mathNormalization';

export { sanitizeMathExpression };

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

  return formatted;
}

// Normalize all vector syntaxes (vec(AB), \vec{AB}, \vec a, AB⃗) to standard SGK \overrightarrow{...}
export function normalizeVectorSyntax(text: string): string {
  if (!text) return '';
  return normalizeAccentsAndUnicodeScripts(text);
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

    const inputStr = String(rawInput);
    if (!inputStr.trim()) return '';

    const normalized = normalizeAllMathInText(inputStr).trim();
    const segments = splitMathDelimiters(normalized);
    const hasMathDelimiters = segments.some((s) => s.type === 'math' || s.type === 'display');

    if (hasMathDelimiters) {
      return segments
        .map((seg) => {
          if (seg.type === 'display') {
            const cleanMath = sanitizeMathExpression(seg.inner);
            try {
              return katex.renderToString(cleanMath, {
                displayMode: true,
                throwOnError: false,
                strict: false,
                trust: true,
              });
            } catch {
              return `<div class="my-2 p-2 font-mono text-center text-indigo-800 bg-indigo-50/70 rounded-xl">${escapeHtml(seg.inner)}</div>`;
            }
          }
          if (seg.type === 'math') {
            const cleanMath = sanitizeMathExpression(seg.inner);
            try {
              return katex.renderToString(cleanMath, {
                displayMode: isBlock,
                throwOnError: false,
                strict: false,
                trust: true,
              });
            } catch {
              return `<span class="font-mono text-indigo-700 bg-indigo-50/50 px-1 py-0.5 rounded font-medium">${escapeHtml(seg.inner)}</span>`;
            }
          }
          return escapeHtml(seg.value);
        })
        .join('');
    }

    // If designated block formula (e.g. from slide formula or quiz formula card)
    if (isBlock) {
      const latex = formatScienceFormulaToLatex(normalized);
      const cleanMath = sanitizeMathExpression(latex);
      try {
        return katex.renderToString(cleanMath, {
          displayMode: true,
          throwOnError: false,
          strict: false,
          trust: true,
        });
      } catch {
        return escapeHtml(normalized);
      }
    }

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
