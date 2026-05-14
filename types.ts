
export interface WageRecord {
  Date: string | Date;
  Name: string;
  "Time In": string;
  "Time Out": string;
  Lunch: string | number;
  WkHr: number;
  calculatedWage?: number;
}

export interface StaffInfo {
  "Full Name": string;
  Wages: number;
  Remark: string; // "MPF" or empty
}

export interface ProcessingResult {
  staffName: string;
  records: WageRecord[];
  staffInfo: StaffInfo;
  templateType: 'Regular' | 'MPF';
  monthYear: string;
}

export interface AppFile {
  file: File | null;
  name: string;
  source: 'local' | 'drive';
}

export interface AppState {
  wagesFile: AppFile;
  staffListFile: AppFile;
  templateFile: AppFile;
  isProcessing: boolean;
  results: ProcessingResult[];
  rawExtractedData: WageRecord[]; // New field to store all extracted rows
  error: string | null;
}
