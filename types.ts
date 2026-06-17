
export interface WageRecord {
  Date: string | Date;
  Name: string;
  "Time In": string;
  "Time Out": string;
  Lunch: string | number;
  WkHr: number;
  SchHr?: number;
  EarlyIN?: number;
  LateIN?: number;
  EarlyOUT?: number;
  OT?: number;
  LateNett?: number;
  OTNett?: number;
  Status?: string;
  "Staff Type"?: string;
  "Wage $/hr"?: number;
  "Pay $"?: number;
  calculatedWage?: number;
  source?: 'csv' | 'xlsx' | 'json';
}

export interface StaffInfo {
  "Full Name": string;
  Wages: number;
  Remark: string; // "FT", "MPF", or empty
  type?: string;   // from JSON format
  since?: string;
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
  source: 'local' | 'drive' | 'json';
}

export interface AppState {
  wagesFile: AppFile;
  staffListFile: AppFile;
  templateFile: AppFile;
  isProcessing: boolean;
  results: ProcessingResult[];
  rawExtractedData: WageRecord[];
  error: string | null;
}
