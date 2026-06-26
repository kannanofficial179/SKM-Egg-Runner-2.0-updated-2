export type QRCodeType = 'Regular' | 'Golden' | 'Campaign' | 'Developer';
export type QRCodeStatus = 'active' | 'disabled' | 'exhausted';

export interface QRCodeRecord {
  id: string;
  code: string;
  type: QRCodeType;
  prefix: string;
  batch: string;
  maxPlays: number;
  playCount: number;
  active: boolean;
  createdAt: Date;
  lastScannedAt?: Date;
  scansToday: number;
}

export interface QRDashboardStats {
  totalGenerated:  number;
  activeQR:        number;   // active=true AND playCount < maxPlays
  disabledQR:      number;   // active=false  (matches search status='disabled')
  exhaustedQR:     number;   // active=true AND playCount >= maxPlays
  goldenQR:        number;
  developerQR:     number;
  scannedToday:    number;
  scannedThisWeek: number;
  scannedThisMonth:number;
  unusedQR:        number;   // playCount === 0
  lastSync:        string;
}

export interface QRGeneratorForm {
  prefix: string;
  quantity: number;
  maxPlays: number;
  type: QRCodeType;
}

export interface QRSearchFilters {
  qrId: string;
  batch: string;
  status: '' | QRCodeStatus;
}

export interface QRAnalyticsData {
  label: string;
  scans: number;
}

export interface GoldenQRAction {
  type: 'pause' | 'resume' | 'disable';
}
