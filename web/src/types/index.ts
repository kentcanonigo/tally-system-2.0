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

