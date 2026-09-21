/**
 * Lightweight WMF (Windows Metafile) to SVG parser & converter
 * Converts 16-bit WMF binary records (used by MathType equations and legacy Word shapes)
 * into clean, standalone SVG vector strings and data URLs that render directly in modern browsers.
 */

export function wmfToSvg(buffer: ArrayBuffer | Uint8Array): string {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length < 40) return '';

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let offset = 0;

    // 1. Check for Placeable Metafile Header (magic 0x9AC6CDD7)
    let left = 0;
    let top = 0;
    let right = 1000;
    let bottom = 1000;
    let inch = 1440;

    const magic = view.getUint32(0, true);
    if (magic === 0x9ac6cdd7) {
      // Placeable header is 22 bytes
      left = view.getInt16(6, true);
      top = view.getInt16(8, true);
      right = view.getInt16(10, true);
      bottom = view.getInt16(12, true);
      inch = view.getUint16(14, true) || 1440;
      offset = 22;
    }

    // 2. Standard WMF Header
    // Type (2), HeaderSize (2), Version (2), FileSize (4), NumOfObjects (2), MaxRecordSize (4), NumOfParams (2)
    if (offset + 18 > bytes.length) return '';

    const fileType = view.getUint16(offset, true);
    const headerSize = view.getUint16(offset + 2, true);
    offset += headerSize * 2; // headerSize is in WORDs (usually 9 WORDs = 18 bytes)

    let winLeft = left;
    let winTop = top;
    let winWidth = Math.max(10, right - left);
    let winHeight = Math.max(10, bottom - top);

    const svgElements: string[] = [];

    // GDI State
    let currentPenColor = '#000000';
    let currentPenWidth = 1;
    let currentPenStyle = 'solid';
    let currentBrushColor = 'none';
    let currentTextColor = '#000000';
    let currentBkColor = 'none';

    // Object table for SELECTOBJECT
    const objectTable: Array<{ type: string; [key: string]: any }> = [];

    // 3. Process WMF Records
    while (offset + 6 <= bytes.length) {
      const recordSizeWords = view.getUint32(offset, true);
      const func = view.getUint16(offset + 4, true);

      if (recordSizeWords < 3) break; // invalid record
      const recordByteLen = recordSizeWords * 2;
      const paramOffset = offset + 6;

      // 0x0000: EOF
      if (func === 0x0000) break;

      switch (func) {
        // 0x020B: SetWindowOrg
        case 0x020b: {
          const y = view.getInt16(paramOffset, true);
          const x = view.getInt16(paramOffset + 2, true);
          winLeft = x;
          winTop = y;
          break;
        }

        // 0x020C: SetWindowExt
        case 0x020c: {
          const y = view.getInt16(paramOffset, true);
          const x = view.getInt16(paramOffset + 2, true);
          if (x !== 0) winWidth = Math.abs(x);
          if (y !== 0) winHeight = Math.abs(y);
          break;
        }

        // 0x02F0: CreatePenIndirect
        case 0x02f0: {
          const style = view.getUint16(paramOffset, true);
          const width = view.getInt16(paramOffset + 2, true);
          const r = bytes[paramOffset + 6];
          const g = bytes[paramOffset + 7];
          const b = bytes[paramOffset + 8];
          const color = `rgb(${r},${g},${b})`;
          objectTable.push({
            type: 'pen',
            color,
            width: Math.max(1, width),
            style: style === 1 ? 'dashed' : 'solid',
          });
          break;
        }

        // 0x02F2: CreateBrushIndirect
        case 0x02f2: {
          const style = view.getUint16(paramOffset, true);
          const r = bytes[paramOffset + 2];
          const g = bytes[paramOffset + 3];
          const b = bytes[paramOffset + 4];
          const color = style === 1 ? 'none' : `rgb(${r},${g},${b})`;
          objectTable.push({
            type: 'brush',
            color,
          });
          break;
        }

        // 0x012D: SelectObject
        case 0x012d: {
          const idx = view.getUint16(paramOffset, true);
          const obj = objectTable[idx];
          if (obj) {
            if (obj.type === 'pen') {
              currentPenColor = obj.color;
              currentPenWidth = obj.width;
              currentPenStyle = obj.style;
            } else if (obj.type === 'brush') {
              currentBrushColor = obj.color;
            }
          }
          break;
        }

        // 0x0209: SetTextColor
        case 0x0209: {
          const r = bytes[paramOffset];
          const g = bytes[paramOffset + 1];
          const b = bytes[paramOffset + 2];
          currentTextColor = `rgb(${r},${g},${b})`;
          break;
        }

        // 0x0201: SetBkColor
        case 0x0201: {
          const r = bytes[paramOffset];
          const g = bytes[paramOffset + 1];
          const b = bytes[paramOffset + 2];
          currentBkColor = `rgb(${r},${g},${b})`;
          break;
        }

        // 0x0325: Polyline
        case 0x0325: {
          const count = view.getInt16(paramOffset, true);
          if (count > 1) {
            const pts: string[] = [];
            for (let i = 0; i < count; i++) {
              const px = view.getInt16(paramOffset + 2 + i * 4, true);
              const py = view.getInt16(paramOffset + 4 + i * 4, true);
              pts.push(`${px},${py}`);
            }
            const strokeDash = currentPenStyle === 'dashed' ? 'stroke-dasharray="4,4"' : '';
            svgElements.push(
              `<polyline points="${pts.join(' ')}" fill="none" stroke="${currentPenColor}" stroke-width="${currentPenWidth}" ${strokeDash} stroke-linecap="round" stroke-linejoin="round" />`
            );
          }
          break;
        }

        // 0x0324: Polygon
        case 0x0324: {
          const count = view.getInt16(paramOffset, true);
          if (count > 2) {
            const pts: string[] = [];
            for (let i = 0; i < count; i++) {
              const px = view.getInt16(paramOffset + 2 + i * 4, true);
              const py = view.getInt16(paramOffset + 4 + i * 4, true);
              pts.push(`${px},${py}`);
            }
            svgElements.push(
              `<polygon points="${pts.join(' ')}" fill="${currentBrushColor}" stroke="${currentPenColor}" stroke-width="${currentPenWidth}" />`
            );
          }
          break;
        }

        // 0x041B: Rectangle
        case 0x041b: {
          const b = view.getInt16(paramOffset, true);
          const r = view.getInt16(paramOffset + 2, true);
          const t = view.getInt16(paramOffset + 4, true);
          const l = view.getInt16(paramOffset + 6, true);
          const x = Math.min(l, r);
          const y = Math.min(t, b);
          const w = Math.abs(r - l);
          const h = Math.abs(b - t);
          svgElements.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${currentBrushColor}" stroke="${currentPenColor}" stroke-width="${currentPenWidth}" />`
          );
          break;
        }

        // 0x0418: Ellipse
        case 0x0418: {
          const b = view.getInt16(paramOffset, true);
          const r = view.getInt16(paramOffset + 2, true);
          const t = view.getInt16(paramOffset + 4, true);
          const l = view.getInt16(paramOffset + 6, true);
          const cx = (l + r) / 2;
          const cy = (t + b) / 2;
          const rx = Math.abs(r - l) / 2;
          const ry = Math.abs(b - t) / 2;
          svgElements.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${currentBrushColor}" stroke="${currentPenColor}" stroke-width="${currentPenWidth}" />`
          );
          break;
        }

        // 0x0521: TextOut
        case 0x0521: {
          const count = view.getInt16(paramOffset, true);
          if (count > 0) {
            let str = '';
            for (let i = 0; i < count; i++) {
              str += String.fromCharCode(bytes[paramOffset + 2 + i]);
            }
            // Strings in WMF are word-aligned
            const stringWords = Math.floor((count + 1) / 2);
            const y = view.getInt16(paramOffset + 2 + stringWords * 2, true);
            const x = view.getInt16(paramOffset + 4 + stringWords * 2, true);
            const safeStr = str
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            svgElements.push(
              `<text x="${x}" y="${y}" fill="${currentTextColor}" font-family="Cambria, 'Times New Roman', serif" font-size="14">${safeStr}</text>`
            );
          }
          break;
        }

        // 0x0A32: ExtTextOut
        case 0x0a32: {
          const y = view.getInt16(paramOffset, true);
          const x = view.getInt16(paramOffset + 2, true);
          const count = view.getInt16(paramOffset + 4, true);
          const options = view.getUint16(paramOffset + 6, true);
          let textOffset = paramOffset + 8;
          if (options & 0x0006) {
            textOffset += 8; // skip rect if ETO_CLIPPED or ETO_OPAQUE
          }
          if (count > 0 && textOffset + count <= bytes.length) {
            let str = '';
            for (let i = 0; i < count; i++) {
              str += String.fromCharCode(bytes[textOffset + i]);
            }
            const safeStr = str
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            svgElements.push(
              `<text x="${x}" y="${y}" fill="${currentTextColor}" font-family="Cambria, 'Times New Roman', serif" font-size="14">${safeStr}</text>`
            );
          }
          break;
        }

        default:
          break;
      }

      offset += recordByteLen;
    }

    if (svgElements.length === 0) {
      return '';
    }

    const viewBox = `${winLeft} ${winTop} ${winWidth} ${winHeight}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" style="display:inline-block;vertical-align:middle;max-height:360px;overflow:visible;">${svgElements.join(
      ''
    )}</svg>`;
  } catch (err) {
    console.warn('WMF to SVG conversion notice:', err);
    return '';
  }
}

/**
 * Converts a WMF buffer directly to a data URL for <img> tags
 */
export function wmfToSvgDataUrl(buffer: ArrayBuffer | Uint8Array): string {
  const svg = wmfToSvg(buffer);
  if (!svg) return '';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
