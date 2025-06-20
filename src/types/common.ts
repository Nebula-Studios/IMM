export interface ModItem {
  id: string;
  name: string;
  path: string;
  activePath?: string;
  numericPrefix?: string;
}

export interface StagedModInfo {
  name: string;
  pakPath: string;
  ucasPath: string | null;
  utocPath: string | null;
  originalPath: string;
} 