// src/types/db.ts
// 数据库表类型定义

export type ISODate = string; // ISO8601

// --- Ads ---

export interface AdSlot {
  id: number;
  position: string;            // e.g. "license_top"
  description?: string | null;
  created_at: ISODate;
  updated_at: ISODate;
  is_active: boolean;
}

export interface AdContent {
  id: number;
  slot_id: number;             // FK -> ad_slots.id
  title: string;
  image_url?: string | null;
  video_url?: string | null;
  target_url: string;
  weight: number;              // 0~100
  priority: number;            // 0~10
  start_date?: ISODate | null;
  end_date?: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
  is_active: boolean;
}

export type AdLogType = "impression" | "click";

export interface AdLog {
  id: number;
  slot_id: number;             // FK
  content_id: number;          // FK
  user_id?: string | null;     // UUID
  type: AdLogType;
  user_agent?: string | null;
  ip?: string | null;
  created_at: ISODate;
  metadata?: Record<string, unknown> | null;
}

// --- Interests ---

export interface UserInterests {
  user_id: string;             // UUID
  vehicle_brands: string[];    // text[]
  service_types: string[];     // text[]
  created_at: ISODate;
  updated_at: ISODate;
}

// --- Helper 聚合返回给前端 ---

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

