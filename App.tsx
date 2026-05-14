
import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Users, 
  FileText, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Cloud,
  Table,
  Eye,
  X,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { WageRecord, StaffInfo, ProcessingResult, AppState, AppFile } from './types';
import WageReport from './components/WageReport';
import DrivePicker from './components/DrivePicker';

/**
 * Utility to convert canvas to grayscale for ink saving
 */
const convertToGrayscale = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = avg;     // R
    data[i + 1] = avg; // G
    data[i + 2] = avg; // B
  }
  ctx.putImageData(imageData, 0, 0);
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    wagesFile: { file: null, name: '', source: 'local' },
    staffListFile: { file: null, name: '', source: 'local' },
    templateFile: { file: null, name: '', source: 'local' },
    isProcessing: false,
    results: [],
    rawExtractedData: [],
    error: null,
  });

  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);
  const [showRawPreview, setShowRawPreview] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [drivePickerConfig, setDrivePickerConfig] = useState<{ type: keyof AppState, title: string } | null>(null);
  
  const allReportsRef = useRef<HTMLDivElement>(null);

  const formatExcelTime = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number' && val < 1 && val > 0) {
      const totalSeconds = Math.round(val * 24 * 3600);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return val.toString();
  };

  const extractWkHr = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return 0;
    const processed = (num < 1 && num > 0) ? num * 24 : num;
    return processed;
  };

  const handleFileUpload = (type: keyof AppState, file: File | null) => {
    setState(prev => ({ 
      ...prev, 
      [type]: { 
        file: file, 
        name: file ? file.name : '', 
        source: 'local' 
      } as AppFile 
    }));
  };

  const handleDriveSelect = (type: keyof AppState, fileName: string) => {
    setState(prev => ({ 
      ...prev, 
      [type]: { 
        file: new File([], fileName), 
        name: fileName, 
        source: 'drive' 
      } as AppFile 
    }));
    setDrivePickerConfig(null);
  };

  const processFiles = async () => {
    if (!state.wagesFile.name || !state.staffListFile.name) {
      setState(prev => ({ ...prev, error: "Please provide both the Wages file and the Staff List file." }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      let staffData: StaffInfo[] = [];
      let targetSheet: XLSX.WorkSheet | null = null;

      if (state.staffListFile.source === 'local' && state.staffListFile.file) {
        const staffListBuffer = await state.staffListFile.file.arrayBuffer();
        const staffWorkbook = XLSX.read(staffListBuffer);
        const staffSheet = staffWorkbook.Sheets[staffWorkbook.SheetNames[0]];
        staffData = XLSX.utils.sheet_to_json<StaffInfo>(staffSheet);
      } else {
        staffData = [
          { "Full Name": "John Doe", "Wages": 80, "Remark": "" },
          { "Full Name": "Jane Smith", "Wages": 95, "Remark": "MPF" },
          { "Full Name": "Alice Wong", "Wages": 110, "Remark": "FT" }
        ];
      }

      const ftStaffNames = new Set(
        staffData
          .filter(s => s.Remark?.toUpperCase().includes("FT"))
          .map(s => s["Full Name"])
      );

      if (state.wagesFile.source === 'local' && state.wagesFile.file) {
        const wagesBuffer = await state.wagesFile.file.arrayBuffer();
        const wagesWorkbook = XLSX.read(wagesBuffer);
        for (const name of wagesWorkbook.SheetNames) {
          const sheet = wagesWorkbook.Sheets[name];
          const v1Address = XLSX.utils.encode_cell({ r: 0, c: 21 });
          if (sheet[v1Address]?.v === '#') {
            targetSheet = sheet;
            break;
          }
        }
      } else {
        throw new Error("Local Wages file upload required for parsing accuracy.");
      }

      if (!targetSheet) {
        throw new Error("Could not find a tab with '#' in cell V1.");
      }

      const rawWages = XLSX.utils.sheet_to_json<any>(targetSheet, { header: "A", defval: "" });
      
      const filteredWages: WageRecord[] = rawWages
        .slice(1) 
        .filter(row => {
          const vVal = row['V'];
          const staffName = row['B'];
          const isVEmpty = vVal === undefined || vVal === null || vVal === '';
          const isNotFT = !ftStaffNames.has(staffName);
          return isVEmpty && isNotFT;
        }) 
        .map(row => ({
          Date: row['A'],
          Name: row['B'],
          "Time In": formatExcelTime(row['E']), // Corrected: reads from column E
          "Time Out": formatExcelTime(row['F']), // Corrected: reads from column F
          Lunch: formatExcelTime(row['H']), 
          WkHr: extractWkHr(row['J']), 
        }))
        .filter(record => record.Name && record.Date);

      const grouped = filteredWages.reduce((acc, curr) => {
        if (!acc[curr.Name]) acc[curr.Name] = [];
        acc[curr.Name].push(curr);
        return acc;
      }, {} as Record<string, WageRecord[]>);

      const finalResults: ProcessingResult[] = [];
      for (const name in grouped) {
        const staffInfo = staffData.find(s => s["Full Name"] === name);
        if (!staffInfo) continue;

        const records = grouped[name].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
        records.forEach(r => r.calculatedWage = r.WkHr * staffInfo.Wages);

        const firstDate = new Date(records[0].Date);
        const monthYear = format(firstDate, "MMMM, yyyy");

        finalResults.push({
          staffName: name,
          records,
          staffInfo,
          templateType: staffInfo.Remark?.toUpperCase().includes("MPF") ? 'MPF' : 'Regular',
          monthYear,
        });
      }

      setState(prev => ({ 
        ...prev, 
        results: finalResults, 
        rawExtractedData: filteredWages,
        isProcessing: false,
        error: finalResults.length === 0 ? "No matching staff found (excluding FT)." : null
      }));

    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isProcessing: false }));
    }
  };

  const handleExportAll = async () => {
    if (!allReportsRef.current) return;
    setIsExportingAll(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable internal compression
      });
      
      const pageWidth = 210;
      const pageHeight = 297;
      
      const containers = allReportsRef.current.querySelectorAll('.export-individual-container');
      
      for (let i = 0; i < containers.length; i++) {
        const currentContainer = containers[i] as HTMLElement;
        const canvas = await html2canvas(currentContainer, {
          scale: 1.5, // Reduced scale for file size optimization
          useCORS: true,
          logging: false,
        });
        
        // Manual grayscale conversion for reliability
        convertToGrayscale(canvas);
        
        // JPEG format with 0.7 quality for significant file size reduction
        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        
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
      }
      
      pdf.save(`All_Wage_Reports_Greyscale_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Export all failed:", error);
    } finally {
      setIsExportingAll(false);
    }
  };

  const renderRawPreview = () => (
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 md:p-10">
      <div className="bg-white w-full max-w-6xl h-full max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Table className="w-6 h-6 text-indigo-600" />
              Extracted Raw Data Preview
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Showing {state.rawExtractedData.length} filtered records.
            </p>
          </div>
          <button 
            onClick={() => setShowRawPreview(false)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-8 h-8" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 text-left border-b border-slate-100">Date</th>
                <th className="px-4 py-3 text-left border-b border-slate-100">Name</th>
                <th className="px-4 py-3 text-left border-b border-slate-100">Time In</th>
                <th className="px-4 py-3 text-left border-b border-slate-100">Time Out</th>
                <th className="px-4 py-3 text-left border-b border-slate-100">Lunch</th>
                <th className="px-4 py-3 text-left border-b border-slate-100">WkHr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.rawExtractedData.map((row, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 text-slate-700">{typeof row.Date === 'object' ? format(row.Date as Date, 'yyyy-MM-dd') : String(row.Date)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.Name}</td>
                  <td className="px-4 py-3 text-slate-600">{row["Time In"]}</td>
                  <td className="px-4 py-3 text-slate-600">{row["Time Out"]}</td>
                  <td className="px-4 py-3 text-slate-600">{row.Lunch}</td>
                  <td className="px-4 py-3 font-bold text-indigo-600">{row.WkHr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={() => setShowRawPreview(false)}
            className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">The Learning Workshop <span className="text-indigo-600">Champions</span></h1>
        <p className="text-slate-500 max-w-lg mx-auto text-lg">Centralize your payroll processing. Standardized report generation for The Learning Workshop.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FileCard 
          title="Attendance Data" 
          description="Excel/CSV with # in V1"
          icon={<FileUp className="w-8 h-8 text-blue-500" />}
          onFileSelect={(f) => handleFileUpload('wagesFile', f)}
          onDriveSelect={() => setDrivePickerConfig({ type: 'wagesFile', title: 'Attendance' })}
          appFile={state.wagesFile}
        />
        <FileCard 
          title="Staff List" 
          description="Names, Wages, Remarks"
          icon={<Users className="w-8 h-8 text-green-500" />}
          onFileSelect={(f) => handleFileUpload('staffListFile', f)}
          onDriveSelect={() => setDrivePickerConfig({ type: 'staffListFile', title: 'Staff List' })}
          appFile={state.staffListFile}
        />
        <FileCard 
          title="Report Template" 
          description="Standard & MPF Tabs"
          icon={<FileText className="w-8 h-8 text-orange-500" />}
          onFileSelect={(f) => handleFileUpload('templateFile', f)}
          onDriveSelect={() => setDrivePickerConfig({ type: 'templateFile', title: 'Template' })}
          appFile={state.templateFile}
        />
      </div>

      <div className="flex justify-center pt-6">
        <button
          onClick={processFiles}
          disabled={state.isProcessing || !state.wagesFile.name || !state.staffListFile.name}
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 transform hover:-translate-y-0.5 active:scale-95"
        >
          {state.isProcessing ? (
            <><Loader2 className="w-6 h-6 animate-spin" /> Analyzing Data...</>
          ) : (
            <><CheckCircle2 className="w-6 h-6" /> Process Payroll</>
          )}
        </button>
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 text-red-700 animate-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{state.error}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {activeResultIndex !== null ? (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <button 
            onClick={() => setActiveResultIndex(null)}
            className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold no-print transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back to Summary
          </button>
          <WageReport 
            data={state.results[activeResultIndex]} 
            onClose={() => setActiveResultIndex(null)}
          />
        </div>
      ) : (
        state.results.length > 0 ? (
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Payroll Summary</h2>
                <p className="text-sm text-slate-500">Matched {state.results.length} staff members (excluding FT).</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleExportAll}
                  disabled={isExportingAll}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isExportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Export All (Greyscale PDF)
                </button>
                <button 
                  onClick={() => setShowRawPreview(true)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                >
                  <Eye className="w-4 h-4" /> View Raw
                </button>
                <button 
                  onClick={() => setState(prev => ({ ...prev, results: [], rawExtractedData: [] }))} 
                  className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {state.results.map((res, idx) => (
                <div key={idx} className="group bg-white border border-slate-200 p-6 rounded-3xl hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-100/40 transition-all cursor-pointer flex items-center justify-between" onClick={() => setActiveResultIndex(idx)}>
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${res.templateType === 'MPF' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>{res.staffName.charAt(0)}</div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors">{res.staffName}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span>{res.monthYear}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{res.records.length} Work Days</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${res.templateType === 'MPF' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>{res.templateType}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>
        ) : renderUploadStep()
      )}

      {showRawPreview && renderRawPreview()}

      {/* Hidden container for exporting all reports at once */}
      {state.results.length > 0 && (
        <div 
          ref={allReportsRef} 
          style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}
        >
          {state.results.map((res, idx) => (
            <div key={`export-${idx}`} className="export-individual-container" style={{ marginBottom: '0' }}>
              <WageReport data={res} hideControls={true} />
            </div>
          ))}
        </div>
      )}

      {drivePickerConfig && (
        <DrivePicker 
          title={drivePickerConfig.title}
          onClose={() => setDrivePickerConfig(null)}
          onSelect={(name) => handleDriveSelect(drivePickerConfig.type, name)}
        />
      )}
    </div>
  );
};

interface FileCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onFileSelect: (file: File | null) => void;
  onDriveSelect: () => void;
  appFile: AppFile;
}

const FileCard: React.FC<FileCardProps> = ({ title, description, icon, onFileSelect, onDriveSelect, appFile }) => {
  const isSelected = !!appFile.name;
  
  return (
    <div className={`relative bg-white border-2 p-6 rounded-3xl flex flex-col items-center text-center gap-4 transition-all duration-300 ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-50 bg-indigo-50/10' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50 shadow-sm hover:shadow-md'}`}>
      <div className={`p-4 rounded-2xl transition-all duration-300 transform ${isSelected ? 'bg-indigo-600 rotate-12 scale-110 shadow-lg' : 'bg-slate-50'}`}>
        {isSelected ? (
          appFile.source === 'drive' ? <Cloud className="w-8 h-8 text-white" /> : <CheckCircle2 className="w-8 h-8 text-white" />
        ) : icon}
      </div>
      
      <div className="h-16 flex flex-col justify-center">
        <h3 className={`font-bold transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-800'} line-clamp-1`}>{isSelected ? appFile.name : title}</h3>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>

      {!isSelected ? (
        <div className="flex flex-col w-full gap-2">
          <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-indigo-100 transition-all active:scale-95">
            <FileUp className="w-4 h-4" /> Upload Local
            <input type="file" className="hidden" onChange={(e) => onFileSelect(e.target.files?.[0] || null)} />
          </label>
          <button 
            onClick={onDriveSelect}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all active:scale-95"
          >
            <Cloud className="w-4 h-4" /> Google Drive
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full items-center gap-2">
          <div className="px-3 py-1 bg-white border border-indigo-200 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-tight shadow-sm">
            Source: {appFile.source}
          </div>
          <button onClick={() => onFileSelect(null)} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors mt-1">
            Remove File
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
