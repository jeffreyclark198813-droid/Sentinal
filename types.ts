
export interface ArchitectureNode {
  id: string;
  group: number;
  label: string;
  description: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ArchitectureLink {
  source: string;
  target: string;
  value: number;
}

export interface PermissionAssessment {
  name: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  rationale: string;
}

export interface DocumentAnalysis {
  summary: string;
  keyInsights: string[];
  threatLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  permissions: PermissionAssessment[];
}

export interface ForensicHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  result: {
    text: string;
    sources: any[];
  };
  isDeepScan?: boolean;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
