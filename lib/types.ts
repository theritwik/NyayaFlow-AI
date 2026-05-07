// Core domain types for NyayaFlow AI

export type Urgency = 'High' | 'Medium' | 'Low';

export type FieldStatus = 'Pending Review' | 'Approved' | 'Edited' | 'Rejected';

export type ActionStatus =
  | 'Pending Review'
  | 'Approved'
  | 'Rejected'
  | 'Completed';

export type ActionType =
  | 'Compliance'
  | 'Appeal Consideration'
  | 'Department Review'
  | 'Deadline Tracking'
  | 'Information Update';

export type JudgmentStatus =
  | 'Uploaded'
  | 'Processing'
  | 'Extracted'
  | 'Under Review'
  | 'Verified'
  | 'Archived';

export interface Judgment {
  id: number;
  file_name: string;
  stored_path: string | null;
  uploaded_at: string;
  status: JudgmentStatus;
  page_count: number;
  is_scanned: 0 | 1;
  source_text: string | null;
  // extracted fields (latest snapshot)
  case_title: string | null;
  case_number: string | null;
  court_name: string | null;
  order_date: string | null;
  petitioners: string | null; // JSON string[]
  respondents: string | null; // JSON string[]
  urgency: Urgency | null;
  overall_confidence: number | null;
}

export type BBox = [number, number, number, number]; // [x0, y0, x1, y1]

export interface ExtractedField {
  id: number;
  judgment_id: number;
  field_key: string;
  ai_value: string;
  current_value: string;
  confidence: number;
  source_excerpt: string;
  source_page: number;
  bbox: string | null; // JSON-encoded BBox or null
  status: FieldStatus;
  reviewer_comment: string | null;
  updated_at: string;
}

export interface ActionItem {
  id: number;
  judgment_id: number;
  title: string;
  ai_title: string;
  action_type: ActionType;
  description: string;
  ai_description: string;
  department: string;
  ai_department: string;
  due_date: string | null;
  ai_due_date: string | null;
  needs_officer_review: 0 | 1;
  source_excerpt: string;
  source_page: number;
  bbox: string | null; // JSON-encoded BBox or null
  confidence: number;
  urgency: Urgency;
  status: ActionStatus;
  reviewer_comment: string | null;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface AuditEntry {
  id: number;
  judgment_id: number;
  entity_type: 'field' | 'action' | 'judgment';
  entity_id: number;
  field_key: string | null;
  ai_value: string | null;
  previous_value: string | null;
  new_value: string | null;
  confidence: number | null;
  decision: string;
  reviewer: string;
  comment: string | null;
  timestamp: string;
}

// Mock-AI extraction output shape
export interface ExtractionResult {
  is_scanned: boolean;
  page_count: number;
  fields: Array<{
    field_key: string;
    value: string;
    confidence: number;
    source_excerpt: string;
    source_page: number;
    bbox?: BBox | null;
  }>;
  actions: Array<{
    title: string;
    action_type: ActionType;
    description: string;
    department: string;
    due_date: string | null;
    needs_officer_review: boolean;
    source_excerpt: string;
    source_page: number;
    bbox?: BBox | null;
    confidence: number;
    urgency: Urgency;
  }>;
}
