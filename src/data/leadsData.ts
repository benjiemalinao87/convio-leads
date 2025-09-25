export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  source: string;
  webhook: string;
  value: number;
  assignedTo: string;
  createdAt: string;
  lastActivity: string;
  notes?: string;
}

export const mockLeads: Lead[] = [
  {
    id: 'lead-001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 (555) 123-4567',
    company: 'TechCorp Industries',
    position: 'Chief Technology Officer',
    status: 'qualified',
    source: 'Website',
    webhook: 'Solar Leads - California',
    value: 75000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-15T10:30:00Z',
    lastActivity: '2024-03-20T14:22:00Z',
    notes: 'Interested in enterprise solution. Scheduled demo for next week.'
  },
  {
    id: 'lead-002',
    name: 'Michael Chen',
    email: 'mchen@innovatetech.io',
    phone: '+1 (555) 987-6543',
    company: 'InnovateTech Solutions',
    position: 'VP of Operations',
    status: 'proposal',
    source: 'LinkedIn',
    webhook: 'HVAC Leads - Texas',
    value: 120000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-10T09:15:00Z',
    lastActivity: '2024-03-21T11:45:00Z',
    notes: 'Reviewing proposal. Decision expected by end of month.'
  },
  {
    id: 'lead-003',
    name: 'Emily Rodriguez',
    email: 'emily.r@startupventures.com',
    phone: '+1 (555) 456-7890',
    company: 'Startup Ventures Inc',
    position: 'Founder',
    status: 'new',
    source: 'Referral',
    webhook: 'Insurance - Florida',
    value: 45000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-22T16:20:00Z',
    lastActivity: '2024-03-22T16:20:00Z',
    notes: 'Referred by existing client. Initial contact needed.'
  },
  {
    id: 'lead-004',
    name: 'David Kim',
    email: 'david.kim@globaltech.com',
    phone: '+1 (555) 234-5678',
    company: 'Global Tech Systems',
    position: 'IT Director',
    status: 'negotiation',
    source: 'Trade Show',
    webhook: 'Solar Leads - California',
    value: 200000,
    assignedTo: 'John Admin',
    createdAt: '2024-02-28T11:00:00Z',
    lastActivity: '2024-03-21T15:30:00Z',
    notes: 'Negotiating terms and pricing. Very interested in full package.'
  },
  {
    id: 'lead-005',
    name: 'Jessica Martinez',
    email: 'j.martinez@retailplus.com',
    phone: '+1 (555) 345-6789',
    company: 'RetailPlus Corp',
    position: 'Digital Marketing Manager',
    status: 'contacted',
    source: 'Google Ads',
    webhook: 'HVAC Leads - Texas',
    value: 35000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-18T13:45:00Z',
    lastActivity: '2024-03-19T10:15:00Z',
    notes: 'Initial call completed. Scheduling follow-up meeting.'
  },
  {
    id: 'lead-006',
    name: 'Robert Taylor',
    email: 'rtaylor@manufacturing.co',
    phone: '+1 (555) 567-8901',
    company: 'Manufacturing Co',
    position: 'Operations Manager',
    status: 'closed-won',
    source: 'Cold Email',
    webhook: 'Insurance - Florida',
    value: 85000,
    assignedTo: 'John Admin',
    createdAt: '2024-02-15T08:30:00Z',
    lastActivity: '2024-03-15T12:00:00Z',
    notes: 'Deal closed successfully. Implementation starting next month.'
  },
  {
    id: 'lead-007',
    name: 'Lisa Wong',
    email: 'lisa.wong@healthcareplus.org',
    phone: '+1 (555) 678-9012',
    company: 'HealthcarePlus',
    position: 'IT Manager',
    status: 'closed-lost',
    source: 'Website',
    webhook: 'Solar Leads - California',
    value: 90000,
    assignedTo: 'John Admin',
    createdAt: '2024-02-20T14:00:00Z',
    lastActivity: '2024-03-10T09:30:00Z',
    notes: 'Lost to competitor. Budget constraints cited as main reason.'
  },
  {
    id: 'lead-008',
    name: 'Christopher Davis',
    email: 'c.davis@consultingfirm.com',
    phone: '+1 (555) 789-0123',
    company: 'Premium Consulting',
    position: 'Senior Partner',
    status: 'qualified',
    source: 'Referral',
    webhook: 'HVAC Leads - Texas',
    value: 150000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-12T10:45:00Z',
    lastActivity: '2024-03-20T16:20:00Z',
    notes: 'High-value prospect. Needs custom solution for multiple locations.'
  },
  {
    id: 'lead-009',
    name: 'Amanda Thompson',
    email: 'athompson@educationtech.edu',
    phone: '+1 (555) 890-1234',
    company: 'EducationTech Institute',
    position: 'Technology Coordinator',
    status: 'new',
    source: 'Social Media',
    webhook: 'Insurance - Florida',
    value: 60000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-21T12:30:00Z',
    lastActivity: '2024-03-21T12:30:00Z',
    notes: 'Inquiry from social media campaign. Initial outreach pending.'
  },
  {
    id: 'lead-010',
    name: 'Mark Wilson',
    email: 'mwilson@financialservices.com',
    phone: '+1 (555) 901-2345',
    company: 'Financial Services Group',
    position: 'Chief Information Officer',
    status: 'proposal',
    source: 'LinkedIn',
    webhook: 'Solar Leads - California',
    value: 180000,
    assignedTo: 'John Admin',
    createdAt: '2024-03-05T15:15:00Z',
    lastActivity: '2024-03-21T13:45:00Z',
    notes: 'Proposal submitted. Waiting for board approval. High probability close.'
  }
];

export const leadSources = [
  'Website',
  'LinkedIn',
  'Google Ads',
  'Referral',
  'Trade Show',
  'Cold Email',
  'Social Media',
  'Phone Call',
  'Other'
];

export const webhooks = [
  'Solar Leads - California',
  'HVAC Leads - Texas',
  'Insurance - Florida'
];

export const leadStatuses = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-indigo-500' },
  { value: 'closed-won', label: 'Closed Won', color: 'bg-green-500' },
  { value: 'closed-lost', label: 'Closed Lost', color: 'bg-red-500' },
] as const;
