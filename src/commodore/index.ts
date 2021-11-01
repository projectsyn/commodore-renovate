import yaml from 'js-yaml';

import * as gitRef from 'renovate/dist/datasource/git-refs';
import { logger } from 'renovate/dist/logger';

import type { PackageFile } from 'renovate/dist/manager/types';

export const defaultConfig = {
  fileMatch: ['^*.yml$'],
};

interface CommodoreConfig {
  parameters: CommodoreParameters;
}

interface CommodoreParameters {
  components: Map<string, CommodoreComponentDependency>;
}

interface CommodoreComponentDependency {
  name: string;
  url: string;
  version: string;
}

// exctractComponents will extract all component dependencies.
// It will return an error if the content is not valid yaml.
function extractComponents(content: string): CommodoreComponentDependency[] {
  const doc: CommodoreConfig = yaml.load(content) as CommodoreConfig;
  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null ||
    doc.parameters.components === undefined ||
    doc.parameters.components === null
  ) {
    return [];
  }

  return Object.entries(doc.parameters.components).map(([key, component]) => {
    // TODO(glrf): Add missing urls through reclass
    const c = component;
    c.name = key;
    return c;
  });
}

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  let components: CommodoreComponentDependency[];
  try {
    components = extractComponents(content);
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse component parameter');
    return null;
  }
  if (components.length === 0) {
    return null;
  }

  const deps = components.map((v: CommodoreComponentDependency) => ({
    depName: `${v.name} in ${fileName}`,
    lookupName: v.url,
    currentValue: v.version,
  }));
  return { deps, datasource: gitRef.GitRefsDatasource.id };

}
