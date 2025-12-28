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
  default_heads?: number;
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
  session_number: number;
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
  heads?: number;
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
  heads?: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  original_session_id?: number | null;
  transferred_at?: string | null;
}

export interface ChangeDetail {
  old: any;
  new: any;
}

export interface TallyLogEntryAudit {
  id: number;
  tally_log_entry_id: number;
  user_id: number;
  edited_at: string;
  changes: Record<string, ChangeDetail>;
  user_username?: string | null;
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
  grand_total_fr: number;
}

export interface ExportRequest {
  session_ids?: number[];
  date_from?: string;
  date_to?: string;
  customer_id?: number;
  plant_id?: number;
  role?: TallyLogEntryRole;
}

// Authentication types
export enum UserRole {
  SUPERADMIN = "superadmin",
  ADMIN = "admin",
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  plant_ids: number[];
  role_ids: number[];
  permissions: string[];
  // User preferences
  timezone?: string | null;
  active_plant_id?: number | null;
  acceptable_difference_threshold?: number;
  visible_tabs?: string[] | null;
}

export interface UserPreferencesUpdate {
  timezone?: string;
  active_plant_id?: number;
  acceptable_difference_threshold?: number;
  visible_tabs?: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// RBAC types
export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  created_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface RoleCreateRequest {
  name: string;
  description?: string | null;
  permission_ids?: number[];
}

export interface RoleUpdateRequest {
  name?: string;
  description?: string | null;
  permission_ids?: number[];
}