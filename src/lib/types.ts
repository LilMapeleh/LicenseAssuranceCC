export interface EmailMessage {
  message_id: string;
  timestamp: string;
  sender: string;
  subject: string;
  body: string;
  source: string;
}

export interface SalesforceData {
  StageName?: string;
  status?: string;
  Amount?: string | number;
  [key: string]: unknown;
}

export interface CaseItem {
  id: string;
  customerName: string;
  dealValue?: string;
  dueDateText?: string;
  category?: string;
  status?: string;
  nextStep?: string;
  approach?: string;
  evidenceSummary?: string;
  closeConfidence?: string;
  isActionOnMe?: boolean;
  stage: string;
  daysOffset?: number;
  statusTag?: string;
  owner?: string;
  email_history?: EmailMessage[];
  oppID?: string;
  salesforce_data?: SalesforceData;
}

export interface RawCase {
  id?: string;
  account_name?: string;
  financial_tag?: string;
  due_tag?: string;
  sub_header?: string;
  status?: string;
  next_step?: string;
  approach?: string;
  evidence?: string;
  close_confidence?: string;
  closeConfidence?: string;
  is_action_on_me?: boolean;
  stage?: string;
  days_offset?: number | null;
  owner?: string;
  email_history?: EmailMessage[];
  oppID?: string;
  salesforce_data?: SalesforceData;
}

export interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface ResolutionMetrics {
  avg_days: number;
  change_pct: number;
  timeframe: string;
}

export type PipelineTab = "Moved on" | "Needs me today" | "Action on me" | "All open";
export type Audience = "APJ" | "EMEA" | "Tanya";
export type ResponsibilityType = "Andrew" | "Sales" | "Legal" | "Client";

export interface MovementItem {
  source: string;
  subject: string;
  sender: string;
  timestamp: string;
}

export interface MovementGroup {
  accountName: string;
  items: MovementItem[];
}
