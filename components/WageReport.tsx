
import React, { useRef } from 'react';
import { Download, Printer } from 'lucide-react';
import { ProcessingResult } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface WageReportProps {
  data: ProcessingResult;
  onClose?: () => void;
  hideControls?: boolean;
}

/**
 * Utility to convert canvas to grayscale for ink saving
 */
const convertToGrayscale = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Standard luminance weights for grayscale
    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = avg;     // R
    data[i + 1] = avg; // G
    data[i + 2] = avg; // B
  }
  ctx.putImageData(imageData, 0, 0);
};

const WageReport: React.FC<WageReportProps> = ({ data, onClose, hideControls = false }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const totalWkHr = data.records.reduce((sum, r) => sum + r.WkHr, 0);
  const totalWages = data.records.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);
  
  const mpfEmployee = (data.templateType === 'MPF' && totalWages >= 7100) ? totalWages * 0.05 : 0;
  const mpfEmployer = (data.templateType === 'MPF' && totalWages >= 6000) ? totalWages * 0.05 : 0;
  
  const netWages = totalWages - mpfEmployee;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    const canvas = await html2canvas(reportRef.current, {
      scale: 1.5, // Reduced scale slightly for smaller file size, still sharp enough for A4
      useCORS: true,
      logging: false,
    });
    
    // Apply grayscale conversion
    convertToGrayscale(canvas);
    
    // Use JPEG with 0.7 quality for significantly smaller file size than PNG
    const imgData = canvas.toDataURL('image/jpeg', 0.7);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true // Enable internal PDF compression
    });
    
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    let xOffset = 0;
    let yOffset = 0;

    if (imgHeight > pageHeight) {
      const ratio = pageHeight / imgHeight;
      finalHeight = pageHeight;
      finalWidth = imgWidth * ratio;
      xOffset = (pageWidth - finalWidth) / 2;
    }
    
    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
    pdf.save(`${data.staffName}_Wage_Report_${data.monthYear}_Grayscale.pdf`);
  };

  return (
    <div className={`space-y-4 ${!hideControls ? 'animate-in fade-in duration-500' : ''}`}>
      {!hideControls && (
        <div className="flex justify-end gap-3 no-print">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-medium transition-all"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button 
            onClick={handleExportPDF}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-indigo-100 transition-all"
          >
            <Download className="w-4 h-4" /> Export PDF (Greyscale)
          </button>
        </div>
      )}

      <div 
        ref={reportRef}
        data-report-root="true"
        className={`bg-white p-6 md:p-10 text-[12px] text-slate-800 ${hideControls ? '' : 'shadow-2xl border border-slate-200 rounded-2xl'}`}
        style={{ 
          width: '210mm', 
          margin: '0 auto', 
          minHeight: hideControls ? 'auto' : '297mm',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Row */}
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight w-2/3">
            The Learning Workshop for Champions, Limited
          </h1>
          <div className={`px-3 py-1.5 rounded-lg border text-right ${data.templateType === 'MPF' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
            <span className="block text-[8px] uppercase font-bold tracking-wider opacity-60">ID</span>
            <span className="font-bold text-xs">#{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
          </div>
        </div>

        {/* Info Line: Full Name Left, Month/Year Right */}
        <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4 mb-6">
          <div className="text-left">
            <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Full Name</label>
            <div className="text-base font-bold text-slate-900 underline underline-offset-4 decoration-indigo-200 decoration-2">{data.staffName}</div>
          </div>
          <div className="text-right">
            <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Month / Year</label>
            <div className="text-base font-bold text-slate-900">{data.monthYear}</div>
          </div>
        </div>

        {/* Header Bar */}
        <div className="grid grid-cols-6 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500 text-white font-bold py-3 px-5 rounded-t-xl shadow-md relative z-10">
          <div>#</div>
          <div>Date</div>
          <div>Time In</div>
          <div>Time Out</div>
          <div>Lunch</div>
          <div>WkHr</div>
        </div>

        {/* Data Rows */}
        <div className="border-x border-b border-slate-200 rounded-b-xl mb-8 shadow-sm overflow-hidden">
          {data.records.map((rec, i) => (
            <div key={i} className={`grid grid-cols-6 py-2 px-5 border-t border-slate-100 first:border-t-0 ${i % 2 === 0 ? 'bg-white' : 'bg-indigo-50/20'}`}>
              <div className="text-slate-400 font-medium">{i + 1}</div>
              <div className="font-semibold text-slate-800">{typeof rec.Date === 'object' ? format(rec.Date as Date, 'yyyy-MM-dd') : String(rec.Date)}</div>
              <div>{rec["Time In"] || '-'}</div>
              <div>{rec["Time Out"] || '-'}</div>
              <div>{rec.Lunch || '-'}</div>
              <div className="font-bold text-indigo-700">{rec.WkHr.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Calculation Section */}
        <div className="flex justify-end">
          <div className="w-72 space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Hourly Wage</span>
              <span className="font-bold text-slate-900">${data.staffInfo.Wages.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Accumulated WkHr</span>
              <span className="font-bold text-slate-900">{totalWkHr.toFixed(2)} hrs</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-slate-900 font-bold uppercase tracking-tight text-xs">Gross Earnings</span>
              <span className="font-bold text-slate-900 text-lg">{formatCurrency(totalWages)}</span>
            </div>

            {data.templateType === 'MPF' && (
              <>
                <div className="flex justify-between items-center text-orange-600 font-bold text-xs pt-0.5">
                  <span>MPF Employee (5%)</span>
                  <span>{mpfEmployee > 0 ? `-${formatCurrency(mpfEmployee)}` : '$0.00'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[9px] italic border-b border-slate-100 pb-2">
                  <span>MPF Employer (5%)</span>
                  <span>{mpfEmployer > 0 ? `+${formatCurrency(mpfEmployer)}` : '$0.00'}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-2.5 rounded-xl mt-3 shadow-xl shadow-slate-200">
                  <span className="font-bold uppercase tracking-wider text-[9px]">Net Payable</span>
                  <span className="font-bold text-lg">{formatCurrency(netWages)}</span>
                </div>
              </>
            )}

            {data.templateType === 'Regular' && (
              <div className="flex justify-between items-center bg-indigo-600 text-white px-4 py-2.5 rounded-xl mt-3 shadow-xl shadow-indigo-200">
                <span className="font-bold uppercase tracking-wider text-[9px]">Total Payable</span>
                <span className="font-bold text-lg">{formatCurrency(totalWages)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Compact Signature Footer */}
        <div className="mt-16 grid grid-cols-2 gap-20">
          <div className="border-t border-slate-300 pt-2 text-center">
            <p className="text-slate-400 font-bold uppercase text-[8px] tracking-widest mb-1">Employee Acknowledgment</p>
            <p className="text-[10px] text-slate-400 font-medium italic">{data.staffName}</p>
          </div>
          <div className="border-t border-slate-300 pt-2 text-center">
            <p className="text-slate-400 font-bold uppercase text-[8px] tracking-widest mb-1">Authorized Approval</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WageReport;
