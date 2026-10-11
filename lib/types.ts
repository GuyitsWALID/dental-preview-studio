import type { ClinicSiteConfig } from './site/types';
export const STAGES = ['Not contacted','Contacted','Proposal requested','Preview sent','Won','Lost'] as const;
export type OutreachStage = typeof STAGES[number];
export interface LeadFacts {
  name: string; address: string; phone: string; email: string; socialNotes: string; socialUrls: string[];
  rating: number | null; reviews: number | null; websiteStatus: string; seoPresence: string; aeoPresence: string;
  confidence: string; evidence: string; mapsUrl: string; verificationSource: string; score: number | null;
  priority: string; importedStage: string; notes: string;
}
export interface Provenance { filename: string; sheet: string; row: number; researchDate: string; importedAt: string; raw: Record<string, string | number | null>; links?: Record<string,string> }
export interface ResearchRecord { values:Record<string,string|number|null>; provenance:Provenance }
export interface ResearchReview {
  id:string; text:string; kind:'quote'|'summary'; author:string; rating:number|null;
  dateLabel:string; platform:string; sourceUrl:string; checkedAt:string; attribution:string;
  topic:string; snapshotContext:string; rank:number|null; issues:string[]; provenance:Provenance;
}
export interface ProspectResearch {
  clinicId:string; details:ResearchRecord; reviews:ResearchReview[]; assets:ResearchRecord[];
}
export interface Prospect {
  id: string; source: LeadFacts; provenance: Provenance; overrides: Partial<LeadFacts>;
  notes: string; stage: OutreachStage; shortlisted: boolean;
  recheck: { status: string; url: string; checkedAt: string };
  research?:ProspectResearch;
}
export interface Project {
  id: string; prospectId: string; slug: string; config: ClinicSiteConfig;
  updatedAt: string; publishedReleaseId: string | null; publishedConfigHash: string | null;
}
export interface Asset { id: string; path: string; storageKey: string; mime: string; width: number; height: number; bytes: number }
export interface Release {
  id: string; projectId: string; createdAt: string; published: boolean;
  files: Record<string, { key: string; mime: string }>;
}
export interface Workspace { prospects: Prospect[]; projects: Project[]; assets: Asset[]; releases: Release[] }
export interface WorkspaceRecord { revision: number; state: Workspace }
export const factsOf = (p: Prospect): LeadFacts => ({ ...p.source, ...p.overrides });
