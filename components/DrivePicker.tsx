
import React, { useState } from 'react';
import { Search, FileText, X, Cloud, Loader2 } from 'lucide-react';

interface DrivePickerProps {
  onSelect: (fileName: string) => void;
  onClose: () => void;
  title: string;
}

const MOCK_FILES = [
  "Staff_List_2024_Final.xlsx",
  "Staff_Directory_HR.csv",
  "Wage_Report_Template_V2.xlsx",
  "Payroll_Template_Standard.xlsx",
  "Employee_MPF_Records.xlsx"
];

const DrivePicker: React.FC<DrivePickerProps> = ({ onSelect, onClose, title }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredFiles = MOCK_FILES.filter(f => f.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (file: string) => {
    setLoading(true);
    // Simulate fetching from Drive
    setTimeout(() => {
      onSelect(file);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-slate-800">Select {title} from Drive</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search your Google Drive..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {filteredFiles.map((file, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSelect(file)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-left transition-all group disabled:opacity-50"
              >
                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <FileText className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{file}</span>
              </button>
            ))}
            {filteredFiles.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-sm">
                No files matching "{search}"
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Connecting to Drive...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrivePicker;
