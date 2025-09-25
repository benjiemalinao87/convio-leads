export interface Lead {
  id: string;
  firstname: string;
  lastname: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  productid: string;
  source: string;
  subsource: string;
  created_at: string;
  landing_page_url: string;
  consent: {
    description: string;
    value: boolean;
  };
  tcpa_compliance: boolean;
  appointment_set?: boolean;
  appointment_date?: string;
  revenue?: number;
  workspace_id: string;
}

export interface Workspace {
  id: string;
  name: string;
  webhook_url: string;
  created_at: string;
  total_leads: number;
  conversion_rate: number;
  total_revenue: number;
}

export interface AnalyticsData {
  total_leads: number;
  total_appointments: number;
  conversion_rate: number;
  total_revenue: number;
  leads_by_source: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  leads_over_time: Array<{
    date: string;
    leads: number;
    appointments: number;
  }>;
  average_time_to_conversion: number;
}

export type UserRole = 'admin' | 'analytics_supervisor';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}