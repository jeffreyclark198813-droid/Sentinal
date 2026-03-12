export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type MessageRole = 'user' | 'model';

export interface Coordinates {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ArchitectureNode extends Coordinates {
  id: string;
  group: number;
  label: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ArchitectureLink {
  source: string;
  target: string;
  value: number;
  label?: string;
  weight?: number;
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PermissionAssessment {
  name: string;
  description: string;
  risk: RiskLevel;
  rationale: string;
  recommendation?: string;
  detectedAt?: Date;
  tags?: string[];
}

export interface DocumentAnalysis {
  summary: string;
  keyInsights: string[];
  threatLevel: RiskLevel;
  permissions: PermissionAssessment[];
  analyzedAt?: Date;
  analyzerVersion?: string;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface SourceReference {
  id?: string;
  title?: string;
  url?: string;
  excerpt?: string;
  confidence?: number;
}

export interface ForensicResult {
  text: string;
  sources: SourceReference[];
  confidenceScore?: number;
  processingTimeMs?: number;
  modelVersion?: string;
}

export interface ForensicHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  result: ForensicResult;
  isDeepScan?: boolean;
  tags?: string[];
  executionId?: string;
}

export interface Message {
  role: MessageRole;
  text: string;
  timestamp: Date;
  id?: string;
  metadata?: Record<string, unknown>;
  tokensUsed?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems?: number;
}

export interface AuditTrailEntry {
  id: string;
  actor?: string;
  action: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface SystemHealthMetrics {
  uptimeSeconds: number;
  requestCount: number;
  errorRate?: number;
  averageLatencyMs?: number;
  lastCheckedAt?: Date;
}

export interface GraphLayoutConfig {
  chargeStrength?: number;
  linkDistance?: number;
  collisionRadius?: number;
  alphaDecay?: number;
}

export interface VersionedEntity {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TaggedEntity {
  tags?: string[];
  category?: string;
}

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
