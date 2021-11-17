import yaml from 'js-yaml';

import * as gitRef from 'renovate/dist/datasource/git-refs';
import { logger } from 'renovate/dist/logger';
import { getGlobalConfig } from 'renovate/dist/config/global';
import { readLocalFile } from 'renovate/dist/util/fs';

import type { PackageFile } from 'renovate/dist/manager/types';

import type {
  CommodoreComponentDependency,
  CommodoreParameters,
  CommodoreConfig,
  Facts,
} from './types';

import { renderInventory } from './inventory';
import { cacheDir, parseFileName, writeYamlFile } from './util';

export const defaultConfig = {
  fileMatch: ['^*.ya?ml$'],
  extraConfig: '',
};

export const defaultExtraConfig = {
  extraParameters: {},
  distributionRegex:
    /^distribution\/(?<distribution>[^\/]+)(?:\/cloud\/(?<cloud>.+)\.ya?ml|(?:\/.+)?\.ya?ml)$/,
  cloudRegionRegex:
    /^cloud\/(?<cloud>[^\/]+)(?:\/(?<region>.+)\.ya?ml|\.ya?ml)$/,
  ignoreValues: ['params'],
};

// exctractComponents will extract all component dependencies.
// It will return an error if the content is not valid yaml.
async function extractComponents(
  content: string,
  repoDir: string | undefined,
  extraValuesPath: string,
  facts: Facts
): Promise<CommodoreComponentDependency[]> {
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

  /* Render inventory with commodore to extract full dependency information */
  let versions: Map<string, CommodoreComponentDependency> = new Map();
  if (repoDir === undefined) {
    logger.warn(
      'Unable to determine repo directory, cannot infer component URLs from rendered inventory.'
    );
  } else {
    const renderedParams: CommodoreParameters = await renderInventory(
      repoDir,
      extraValuesPath,
      facts
    );
    versions = renderedParams.components;
  }

  return Object.entries(doc.parameters.components).map(([key, component]) => {
    const c = component;
    const rc: CommodoreComponentDependency | undefined = versions.get(key);
    if (c.url === undefined || c.url === null || c.url === '') {
      if (rc !== undefined && rc !== null) {
        c.url = rc.url;
      }
    }
    c.name = key;
    return c;
  });
}

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: any
): Promise<PackageFile | null> {
  let components: CommodoreComponentDependency[];

  const repoDir: string | undefined = getGlobalConfig().localDir;
  const extraValuesPath: string = `${cacheDir()}/extra.yaml`;

  const extraConfigStr: string = config.extraConfig
    ? (await readLocalFile(config.extraConfig)).toString()
    : '{}';
  // Merge user-supplied extra config with defaults
  const extraConfig = {
    ...defaultExtraConfig,
    ...JSON.parse(extraConfigStr),
  };

  try {
    await writeYamlFile(extraValuesPath, {
      parameters: extraConfig.extraParameters,
    });
  } catch (err) {
    logger.error(`Error while writing extra parameters YAML: ${err}`);
  }

  const facts: Facts = parseFileName(
    fileName,
    new RegExp(extraConfig.distributionRegex),
    new RegExp(extraConfig.cloudRegionRegex),
    extraConfig.ignoreValues
  );

  try {
    components = await extractComponents(
      content,
      repoDir,
      extraValuesPath,
      facts
    );
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
