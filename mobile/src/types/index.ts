export interface Customer {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WeightClassification {
  id: number;
  plant_id: number;
  classification: string;
  description: string | null;
  min_weight: number | null;
  max_weight: number | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export enum TallySessionStatus {
  ONGOING = "ongoing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface TallySession {
  id: number;
  customer_id: number;
  plant_id: number;
  date: string;
  status: TallySessionStatus;
  created_at: string;
  updated_at: string;
}

export interface AllocationDetails {
  id: number;
  tally_session_id: number;
  weight_classification_id: number;
  required_bags: number;
  allocated_bags_tally: number;
  allocated_bags_dispatcher: number;
  created_at: string;
  updated_at: string;
}

export enum TallyLogEntryRole {
  TALLY = "tally",
  DISPATCHER = "dispatcher",
}

export interface TallyLogEntry {
  id: number;
  tally_session_id: number;
  weight_classification_id: number;
  role: TallyLogEntryRole;
  weight: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportItem {
  category: string;
  classification: string;
  bags: number;
}

export interface CustomerExportData {
  customer_name: string;
  items: ExportItem[];
  subtotal: number;
}

export interface ExportResponse {
  customers: CustomerExportData[];
  grand_total_dc: number;
  grand_total_bp: number;
}

export interface ExportRequest {
  session_ids?: number[];
  date_from?: string;
  date_to?: string;
  customer_id?: number;
  plant_id?: number;
}
