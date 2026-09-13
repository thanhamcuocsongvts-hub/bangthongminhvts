const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf-8');

const target = `        {/* ========================================================= */}
        {/* 4. OFFICE DOCUMENT VIEWER (.DOCX, .PPTX, .XLSX) VIA CYNTLER */}
        {/* ========================================================= */}
        {(fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx') && lesson.fileUrl && !lesson.fileUrl.startsWith('blob:') && lesson.fileUrl.startsWith('http') ? (
          <div className="flex-1 w-full h-full relative z-10 bg-white overflow-hidden">
            <DocViewer 
              documents={[{ uri: lesson.fileUrl, fileType: fileType, fileName: lesson.title }]}
              pluginRenderers={DocViewerRenderers}
              config={{
                header: { disableHeader: true, disableFileName: true, retainURLParams: false }
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : fileType === 'docx' ? (`

const replacement = `        {/* ========================================================= */}
        {/* 4. LOCAL DOCX VIEWER                                      */}
        {/* ========================================================= */}
        {fileType === 'docx' ? (`

content = content.replace(target, replacement);

const targetPPTX = `        {/* ========================================================= */}
        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && !(lesson.fileUrl && lesson.fileUrl.startsWith('http')) && (`;

const replacementPPTX = `        {/* ========================================================= */}
        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && lesson.fileUrl && !lesson.fileUrl.startsWith('blob:') && lesson.fileUrl.startsWith('http') ? (
          <div className="flex-1 w-full h-full relative z-10 bg-white overflow-hidden">
            <DocViewer 
              documents={[{ uri: lesson.fileUrl, fileType: fileType, fileName: lesson.title }]}
              pluginRenderers={DocViewerRenderers}
              config={{
                header: { disableHeader: true, disableFileName: true, retainURLParams: false }
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : fileType === 'pptx' && (`;

content = content.replace(targetPPTX, replacementPPTX);

fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', content);
