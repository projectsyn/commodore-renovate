export interface CommodoreConfig {
  parameters: CommodoreParameters;
}

export interface CommodoreParameters {
  components: Map<string, CommodoreDependency>;
  packages: Map<string, CommodoreDependency>;
}

export interface CommodoreDependency {
  name: string;
  url: string;
  version: string;
}

export class Facts {
  distribution: string | null = null;
  cloud: string | null = null;
  region: string | null = null;
}

export class ClusterData {
  name: string | null = null;
  tenant: string | null = null;
}

export interface RepoConfig {
  dir: string;
  extraConfig: any;
}

export interface ClusterInfo {
  id: string;
  tenant: string;
  displayName: string;
  dynamicFacts: object;
  facts: Facts;
  gitRepo: object;
}
