export interface ModItem {
  id: string;
  name: string;
  path: string;
  activePath?: string;
  numericPrefix?: string;
  author?: string;
  version?: string;
}

export interface StagedModInfo {
  name: string;
  pakPath: string;
  ucasPath: string | null;
  utocPath: string | null;
  originalPath: string;
  author?: string;
  version?: string;
} 