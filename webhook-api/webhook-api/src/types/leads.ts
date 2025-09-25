import { z } from 'zod'

// Base lead schema
export const BaseLeadSchema = z.object({
  // Common fields across all lead providers
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  source: z.string().min(1, "Lead source is required"),
  campaign: z.string().optional(),
  notes: z.string().optional(),
  timestamp: z.string().datetime().optional(),
})

// Solar-specific lead schema
export const SolarLeadSchema = BaseLeadSchema.extend({
  propertyType: z.enum(['single-family', 'townhouse', 'condo', 'apartment', 'commercial']).optional(),
  monthlyElectricBill: z.number().positive().optional(),
  roofCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  roofAge: z.number().min(0).max(100).optional(),
  shadeIssues: z.boolean().optional(),
  homeownershipStatus: z.enum(['own', 'rent', 'other']).optional(),
  creditScore: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  annualIncome: z.enum(['under-50k', '50k-75k', '75k-100k', '100k-150k', 'over-150k']).optional(),
})

// HVAC-specific lead schema
export const HVACLeadSchema = BaseLeadSchema.extend({
  serviceType: z.enum(['installation', 'repair', 'maintenance', 'consultation']).optional(),
  systemAge: z.number().min(0).max(50).optional(),
  systemType: z.enum(['central-air', 'heat-pump', 'ductless', 'window-unit', 'other']).optional(),
  homeSize: z.enum(['under-1000', '1000-2000', '2000-3000', '3000-4000', 'over-4000']).optional(),
  urgency: z.enum(['immediate', 'within-week', 'within-month', 'planning']).optional(),
  budget: z.enum(['under-5k', '5k-10k', '10k-15k', '15k-20k', 'over-20k']).optional(),
  preferredContactTime: z.enum(['morning', 'afternoon', 'evening', 'weekend']).optional(),
})

// Insurance-specific lead schema
export const InsuranceLeadSchema = BaseLeadSchema.extend({
  insuranceType: z.enum(['auto', 'home', 'life', 'health', 'business', 'other']).optional(),
  currentProvider: z.string().optional(),
  currentPremium: z.number().positive().optional(),
  coverageAmount: z.number().positive().optional(),
  renewalDate: z.string().datetime().optional(),
  claimsHistory: z.boolean().optional(),
  vehicleInfo: z.object({
    year: z.number().min(1900).max(2025),
    make: z.string(),
    model: z.string(),
    mileage: z.number().min(0).optional(),
  }).optional(),
  propertyInfo: z.object({
    propertyValue: z.number().positive(),
    homeAge: z.number().min(0).max(200),
    securitySystem: z.boolean(),
  }).optional(),
})

// Webhook metadata schema
export const WebhookMetadataSchema = z.object({
  webhookId: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  signature: z.string().optional(),
  retryCount: z.number().min(0).default(0),
})

// Combined webhook payload schema
export const WebhookPayloadSchema = z.object({
  metadata: WebhookMetadataSchema,
  lead: z.union([SolarLeadSchema, HVACLeadSchema, InsuranceLeadSchema, BaseLeadSchema]),
})

// Lead provider configurations
export const LeadProviderConfig = {
  'ws_cal_solar_001': {
    name: 'Solar Leads - California',
    type: 'solar',
    schema: SolarLeadSchema,
    region: 'california',
    category: 'solar'
  },
  'ws_tx_hvac_002': {
    name: 'HVAC Leads - Texas',
    type: 'hvac',
    schema: HVACLeadSchema,
    region: 'texas',
    category: 'hvac'
  },
  'ws_fl_ins_003': {
    name: 'Insurance - Florida',
    type: 'insurance',
    schema: InsuranceLeadSchema,
    region: 'florida',
    category: 'insurance'
  }
} as const

export type LeadProviderId = keyof typeof LeadProviderConfig
export type BaseLeadType = z.infer<typeof BaseLeadSchema>
export type SolarLeadType = z.infer<typeof SolarLeadSchema>
export type HVACLeadType = z.infer<typeof HVACLeadSchema>
export type InsuranceLeadType = z.infer<typeof InsuranceLeadSchema>
export type WebhookPayloadType = z.infer<typeof WebhookPayloadSchema>
export type LeadType = SolarLeadType | HVACLeadType | InsuranceLeadType | BaseLeadType