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
  totalGenerated: number;
  activeQR: number;
  disabledQR: number;
  goldenQR: number;
  scannedToday: number;
  unusedQR: number;
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
