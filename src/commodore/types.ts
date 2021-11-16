export interface CommodoreConfig {
  parameters: CommodoreParameters;
}

export interface CommodoreParameters {
  components: Map<string, CommodoreComponentDependency>;
}

export interface CommodoreComponentDependency {
  name: string;
  url: string;
  version: string;
}
