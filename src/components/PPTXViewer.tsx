import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export const PPTXViewer: React.FC<{ url: string }> = ({ url }) => {
  const [loading, setLoading] = useState(true);
  
  // Create Office Web Viewer URL
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  return (
    <div className="w-full h-full relative bg-slate-950 flex flex-col items-center justify-center">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
          <p className="text-slate-300 font-medium">Đang nạp trình chiếu từ Microsoft Office Viewer...</p>
          <p className="text-slate-500 text-xs mt-2">Vui lòng bấm nút "Bắt đầu trình chiếu" (Start Slide Show) ở góc dưới sau khi tải xong để giữ nguyên hiệu ứng chuyển cảnh.</p>
        </div>
      )}
      <iframe
        src={officeUrl}
        className="w-full h-full border-none"
        onLoad={() => setLoading(false)}
        title="PowerPoint Viewer"
        allowFullScreen
      />
    </div>
  );
};
