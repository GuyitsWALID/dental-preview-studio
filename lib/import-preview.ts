import type { ParsedImport, ImportEntry } from './prospects';
export interface ImportPayload {
  importId:string;
  parsed:Omit<ParsedImport,'rows'>;
  entries:ImportEntry[];
  counts:Record<ImportEntry['kind'],number>;
  totalRows:number;
  outsideListCount:number;
  offset:number;
  nextOffset:number|null;
  revision:number;
  expiresAt:number;
}
