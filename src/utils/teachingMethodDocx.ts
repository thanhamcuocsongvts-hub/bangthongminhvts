import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { TeachingMethodPlan } from '../types';
import { parseTextWithLatexToDocxRuns } from './docxExportService';
import { saveBlobSafely } from './exportUtils';

function sanitizeFileName(name: string): string {
  return (name || 'Phuong_Phap_Giang_Day')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 72);
}

export async function exportTeachingMethodToDocx(plan: TeachingMethodPlan): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Title banner
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'CHUYÊN ĐỀ PHƯƠNG PHÁP GIẢI TOÁN & GIẢNG DẠY',
          bold: true,
          size: 22,
          color: '047857',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: parseTextWithLatexToDocxRuns(plan.title, {
        bold: true,
        size: 32,
        color: '0F172A',
      }),
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${plan.subject} • ${plan.grade} • ${plan.targetLevel}`,
          italics: true,
          size: 22,
          color: '475569',
        }),
      ],
    })
  );

  // Overview
  if (plan.recognitionSigns || plan.learningObjective) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: 'A. TỔNG QUAN & NHẬN DIỆN DẠNG BÀI',
            bold: true,
            size: 26,
            color: '065F46',
          }),
        ],
      })
    );
    if (plan.recognitionSigns) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: '• Dấu hiệu nhận biết: ', bold: true, size: 23, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(plan.recognitionSigns, { size: 23, color: '1E293B' }),
          ],
        })
      );
    }
    if (plan.learningObjective) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: '• Mục tiêu đạt được: ', bold: true, size: 23, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(plan.learningObjective, { size: 23, color: '1E293B' }),
          ],
        })
      );
    }
    if (plan.commonMistakes?.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: '• Lưu ý lỗi sai thường gặp:', bold: true, size: 23, color: 'B45309' }),
          ],
        })
      );
      plan.commonMistakes.forEach((m) => {
        children.push(
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: '- ', bold: true, size: 22, color: 'B45309' }),
              ...parseTextWithLatexToDocxRuns(m, { size: 22, color: '334155' }),
            ],
          })
        );
      });
    }
  }

  // Section 1: Steps
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'I. TRÌNH TỰ CÁC BƯỚC GIẢI',
          bold: true,
          size: 26,
          color: '065F46',
        }),
      ],
    })
  );

  plan.steps.forEach((step) => {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: `Bước ${step.stepNumber}: `, bold: true, size: 24, color: '047857' }),
          ...parseTextWithLatexToDocxRuns(step.title, { bold: true, size: 24, color: '0F172A' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 280 },
        children: parseTextWithLatexToDocxRuns(step.actionGuide, { size: 23, color: '1E293B' }),
      })
    );
    if (step.formula) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 400 },
          children: [
            new TextRun({ text: 'Công thức áp dụng: ', bold: true, italics: true, size: 22, color: '4338CA' }),
            ...parseTextWithLatexToDocxRuns(step.formula, { size: 23, color: '312E81' }),
          ],
        })
      );
    }
    if (step.keyNote) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 400 },
          children: [
            new TextRun({ text: 'Ghi nhớ: ', bold: true, italics: true, size: 21, color: 'B45309' }),
            ...parseTextWithLatexToDocxRuns(step.keyNote, { italics: true, size: 21, color: '78350F' }),
          ],
        })
      );
    }
  });

  // Section 2: Core Formulas
  if (plan.formulas.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 220, after: 100 },
        children: [
          new TextRun({
            text: 'II. HỆ THỐNG CÔNG THỨC TRỌNG TÂM',
            bold: true,
            size: 26,
            color: '4338CA',
          }),
        ],
      })
    );

    const rows = plan.formulas.map(
      (f) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: parseTextWithLatexToDocxRuns(f.name, { bold: true, size: 22, color: '0F172A' }),
                }),
              ],
            }),
            new TableCell({
              width: { size: 68, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: f.condition ? 40 : 80 },
                  children: parseTextWithLatexToDocxRuns(f.expression, { size: 23, color: '1E1B4B' }),
                }),
                ...(f.condition
                  ? [
                      new Paragraph({
                        spacing: { after: 80 },
                        children: parseTextWithLatexToDocxRuns(f.condition, { italics: true, size: 20, color: '475569' }),
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      })
    );
  }

  // Section 3: Illustrative Examples
  if (plan.examples.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: 'III. VÍ DỤ MINH HỌA',
            bold: true,
            size: 26,
            color: '065F46',
          }),
        ],
      })
    );

    plan.examples.forEach((ex, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [
            new TextRun({ text: `${ex.title || `Ví dụ ${idx + 1}`}: `, bold: true, size: 24, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(ex.problem, { size: 23, color: '0F172A' }),
          ],
        }),
        new Paragraph({
          spacing: { after: 50 },
          children: [new TextRun({ text: 'Hướng dẫn giải:', bold: true, italics: true, size: 22, color: '047857' })],
        })
      );

      ex.stepByStepSolution.forEach((st) => {
        children.push(
          new Paragraph({
            spacing: { after: 50 },
            indent: { left: 280 },
            children: [
              new TextRun({ text: `${st.stepLabel}: `, bold: true, size: 22, color: '0F172A' }),
              ...parseTextWithLatexToDocxRuns(st.content, { size: 22, color: '1E293B' }),
              ...(st.resultFormula
                ? [
                    new TextRun({ text: '  ⇒  ', bold: true, size: 22, color: '4338CA' }),
                    ...parseTextWithLatexToDocxRuns(st.resultFormula, { size: 22, color: '312E81' }),
                  ]
                : []),
            ],
          })
        );
      });

      children.push(
        new Paragraph({
          spacing: { before: 40, after: 80 },
          indent: { left: 280 },
          children: [
            new TextRun({ text: 'Kết luận: ', bold: true, size: 22, color: '047857' }),
            ...parseTextWithLatexToDocxRuns(ex.finalAnswer, { bold: true, size: 22, color: '065F46' }),
          ],
        })
      );
      if (ex.teacherTip) {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 280 },
            children: [
              new TextRun({ text: 'Mẹo giảng / Casio: ', bold: true, italics: true, size: 21, color: '0369A1' }),
              ...parseTextWithLatexToDocxRuns(ex.teacherTip, { italics: true, size: 21, color: '0C4A6E' }),
            ],
          })
        );
      }
    });
  }

  // Section 4: Similar Practice Exercises
  if (plan.exercises.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: 'IV. BÀI TẬP TƯƠNG TỰ TỰ LUYỆN',
            bold: true,
            size: 26,
            color: '065F46',
          }),
        ],
      })
    );

    plan.exercises.forEach((ex, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({ text: `Bài ${ex.index || idx + 1} (${ex.level}): `, bold: true, size: 23, color: '0F172A' }),
            ...parseTextWithLatexToDocxRuns(ex.problem, { size: 23, color: '1E293B' }),
          ],
        })
      );
    });

    // Answer Key & Solutions at the end for clean handout printing
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: 'ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT BÀI TẬP TƯƠNG TỰ',
            bold: true,
            size: 24,
            color: '4338CA',
          }),
        ],
      })
    );

    plan.exercises.forEach((ex, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `Bài ${ex.index || idx + 1} — Đáp số: `, bold: true, size: 22, color: '047857' }),
            ...parseTextWithLatexToDocxRuns(ex.shortAnswer, { bold: true, size: 22, color: '065F46' }),
          ],
        }),
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 260 },
          children: parseTextWithLatexToDocxRuns(ex.solutionSteps, { size: 21, color: '334155' }),
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveBlobSafely(blob, `${sanitizeFileName(plan.title)}.docx`);
}
