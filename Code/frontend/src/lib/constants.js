export const ROLES = {
  ADMIN: 'admin',
  FINANCE: 'finance',
  PROJECT_MANAGER: 'project_manager',
  FIELD_MANAGER: 'field_manager',
  RESEARCH_ASSOCIATE: 'research_associate',
}

export const ROLE_LABELS = {
  admin: 'Admin',
  finance: 'Finance',
  project_manager: 'Project Manager',
  field_manager: 'Field Manager',
  research_associate: 'Research Associate',
}

export const ASSET_TYPES = {
  LAPTOP: 'laptop',
  PDA: 'pda',
}

export const ASSET_STATUS = {
  AVAILABLE: 'available',
  LEASED: 'leased',
  MAINTENANCE: 'maintenance',
}

export const LEASE_STATUS = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
}

export const CONDITION = {
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
}

export const DEFAULT_RATES = {
  pda: 5000,
  laptop: 20000,
}

export const DEFAULT_USEFUL_LIFE = {
  laptop: 3,
  pda: 2,
}

export const REPORTS_ROLES = ['admin', 'finance', 'project_manager']
export const FINANCE_ROLES = ['admin', 'finance']
export const ADMIN_ROLES = ['admin']
export const ALL_ROLES = Object.values(ROLES)

export const ORG_NAME = 'IPA Uganda'
