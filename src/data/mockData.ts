import { Lead, Workspace, AnalyticsData, User } from '@/types/dashboard';

export const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  role: 'admin',
  name: 'John Admin'
};

export const mockWorkspaces: Workspace[] = [
  {
    id: '1',
    name: 'Solar Leads - California',
    webhook_url: 'https://api.leadmanager.com/webhook/ws_cal_solar_001',
    created_at: '2024-09-01T10:00:00Z',
    total_leads: 1247,
    conversion_rate: 12.8,
    total_revenue: 89650
  },
  {
    id: '2',
    name: 'HVAC Leads - Texas',
    webhook_url: 'https://api.leadmanager.com/webhook/ws_tx_hvac_002',
    created_at: '2024-08-15T14:30:00Z',
    total_leads: 892,
    conversion_rate: 15.2,
    total_revenue: 125400
  },
  {
    id: '3',
    name: 'Insurance - Florida',
    webhook_url: 'https://api.leadmanager.com/webhook/ws_fl_ins_003',
    created_at: '2024-07-20T09:15:00Z',
    total_leads: 643,
    conversion_rate: 9.7,
    total_revenue: 45200
  }
];

export const mockLeads: Lead[] = [
  {
    id: '1',
    firstname: 'Sarah',
    lastname: 'Johnson',
    address1: '123 Main St',
    address2: 'Apt 4B',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90210',
    phone: '555-0123',
    email: 'sarah.johnson@email.com',
    productid: 'solar-residential',
    source: 'Google Ads',
    subsource: 'Solar Installation Keywords',
    created_at: '2024-09-24T08:30:00Z',
    landing_page_url: 'https://solarpanel.com/ca-landing',
    consent: {
      description: 'Marketing communications consent',
      value: true
    },
    tcpa_compliance: true,
    appointment_set: true,
    appointment_date: '2024-09-26T14:00:00Z',
    revenue: 850,
    workspace_id: '1'
  },
  {
    id: '2',
    firstname: 'Michael',
    lastname: 'Chen',
    address1: '456 Oak Avenue',
    city: 'Houston',
    state: 'TX',
    zip: '77001',
    phone: '555-0456',
    email: 'michael.chen@email.com',
    productid: 'hvac-maintenance',
    source: 'Facebook Ads',
    subsource: 'HVAC Repair Campaign',
    created_at: '2024-09-24T10:15:00Z',
    landing_page_url: 'https://hvacpro.com/tx-services',
    consent: {
      description: 'Service updates consent',
      value: true
    },
    tcpa_compliance: true,
    appointment_set: false,
    workspace_id: '2'
  },
  {
    id: '3',
    firstname: 'Emily',
    lastname: 'Rodriguez',
    address1: '789 Beach Blvd',
    city: 'Miami',
    state: 'FL',
    zip: '33101',
    phone: '555-0789',
    email: 'emily.rodriguez@email.com',
    productid: 'life-insurance',
    source: 'Organic Search',
    subsource: 'SEO - Life Insurance',
    created_at: '2024-09-24T11:45:00Z',
    landing_page_url: 'https://insurancepro.com/fl-quotes',
    consent: {
      description: 'Quote requests consent',
      value: true
    },
    tcpa_compliance: true,
    appointment_set: true,
    appointment_date: '2024-09-25T16:30:00Z',
    revenue: 1200,
    workspace_id: '3'
  }
];

export const mockAnalytics: AnalyticsData = {
  total_leads: 2782,
  total_appointments: 342,
  conversion_rate: 12.3,
  total_revenue: 260250,
  leads_by_source: [
    { source: 'Google Ads', count: 1245, percentage: 44.7 },
    { source: 'Facebook Ads', count: 687, percentage: 24.7 },
    { source: 'Organic Search', count: 523, percentage: 18.8 },
    { source: 'Direct Traffic', count: 327, percentage: 11.8 }
  ],
  leads_over_time: [
    { date: '2024-09-17', leads: 45, appointments: 6 },
    { date: '2024-09-18', leads: 52, appointments: 7 },
    { date: '2024-09-19', leads: 38, appointments: 4 },
    { date: '2024-09-20', leads: 61, appointments: 8 },
    { date: '2024-09-21', leads: 47, appointments: 5 },
    { date: '2024-09-22', leads: 55, appointments: 7 },
    { date: '2024-09-23', leads: 42, appointments: 5 },
    { date: '2024-09-24', leads: 58, appointments: 9 }
  ],
  average_time_to_conversion: 2.4
};