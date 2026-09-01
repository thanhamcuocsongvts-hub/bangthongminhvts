import React, { useMemo } from 'react';
import katex from 'katex';

interface MathFormulaRendererProps {
  content: string;
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
  formatted = formatted.replace(/\b([A-Z][a-z]?)(\d+)([A-Z][a-z]?)(\d+)([A-Z][a-z]?)(\d+)\b/g, '$1_{$2}$3_{$4}$5_{$6}');

  return formatted;
}

export const MathFormulaRenderer: React.FC<MathFormulaRendererProps> = ({
  content,
  className = '',
  isBlock = false,
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // Check if the content contains explicit LaTeX $ or $$
    const hasMathDelimiters = content.includes('$');

    if (hasMathDelimiters) {
      // Parse chunks of text and math
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

      return parts
        .map((part) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim();
            try {
              return katex.renderToString(math, { displayMode: true, throwOnError: false });
            } catch (e) {
              return `<span class="text-rose-500 font-mono">${escapeHtml(math)}</span>`;
            }
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim();
            try {
              return katex.renderToString(math, { displayMode: false, throwOnError: false });
            } catch (e) {
              return `<span class="text-rose-500 font-mono">${escapeHtml(math)}</span>`;
            }
          } else {
            return escapeHtml(part);
          }
        })
        .join('');
    }

    // If it's a designated block formula (e.g. from slide formula or quiz formula)
    if (isBlock) {
      const latex = formatScienceFormulaToLatex(content);
      try {
        return katex.renderToString(latex, { displayMode: true, throwOnError: false });
      } catch (e) {
        return escapeHtml(content);
      }
    }

    // Standard text
    return escapeHtml(content);
  }, [content, isBlock]);

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
