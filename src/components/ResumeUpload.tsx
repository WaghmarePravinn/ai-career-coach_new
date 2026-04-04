import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ResumeUploadProps {
  onUpload: (text: string) => void;
  currentText?: string;
  loading?: boolean;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onUpload, currentText, loading: externalLoading }) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isLoading = internalLoading || externalLoading;

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInternalLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await extractTextFromDocx(file);
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT.');
      }

      if (!text.trim()) {
        throw new Error('Could not extract text from the file. It might be empty or an image-based PDF.');
      }

      onUpload(text);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      console.error(err);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative group">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isLoading}
        />
        <div className={`
          border-2 border-dashed rounded-2xl p-10 transition-all flex flex-col items-center justify-center gap-4
          ${isLoading ? 'bg-bg-hover/30 border-border-alt' : 
            success ? 'bg-emerald-primary/5 border-emerald-primary/30' : 
            error ? 'bg-red-500/5 border-red-500/30' : 
            'bg-bg border-border group-hover:border-emerald-primary group-hover:bg-emerald-primary/5'}
        `}>
          {isLoading ? (
            <>
              <div className="relative">
                <Loader2 className="w-12 h-12 text-emerald-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-emerald-primary rounded-full animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary text-lg">Processing Resume...</p>
                <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">Extracting Intelligence & Vectorizing</p>
              </div>
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-primary" />
              <div className="text-center">
                <p className="font-bold text-emerald-primary text-lg">Resume Vectorized!</p>
                <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">Memory Node Updated</p>
              </div>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="text-center">
                <p className="font-bold text-red-500 text-lg">Upload Interrupted</p>
                <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-bg-card border border-border text-emerald-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10" />
              </div>
              <div className="text-center">
                <p className="font-extrabold text-text-primary text-xl tracking-tight">Initialize Resume</p>
                <p className="text-xs text-text-muted font-mono uppercase tracking-[0.2em] mt-2">PDF · DOCX · TXT</p>
              </div>
            </>
          )}
        </div>
      </div>
      
      {currentText && !isLoading && !error && (
        <div className="mt-6 p-5 bg-bg-card rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em] font-mono flex items-center gap-1.5">
              <FileText size={12} className="text-emerald-primary" /> Current Data Stream
            </span>
            <span className="text-[9px] text-text-muted font-mono">{currentText.length} Chars</span>
          </div>
          <div className="max-h-32 overflow-y-auto text-[11px] text-text-secondary font-mono whitespace-pre-wrap leading-relaxed opacity-60">
            {currentText}
          </div>
        </div>
      )}
    </div>
  );
};
