import { parse } from 'path';
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
  ClusterInfo,
  Facts,
  RepoConfig,
} from './types';

import { ClusterData } from './types';

import { renderInventory } from './inventory';
import { LieutenantError, fetchClusterInfo } from './lieutenant';
import {
  cacheDir,
  cloneGlobalRepo,
  mergeConfig,
  parseFileName,
  writeYamlFile,
} from './util';

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
  // map facts to files
  factsMap: {} as any,
};

function factsFromAny(facts: any): Facts {
  return {
    distribution: facts.distribution || null,
    cloud: facts.cloud || null,
    region: facts.region || null,
  } as Facts;
}

// extractComponents will extract all component dependencies.
// It will return an error if the content is not valid yaml.
async function extractComponents(
  content: string,
  repoDir: string | undefined,
  globalDir: string,
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
      globalDir,
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
  let globalDir: string = '';
  // Tenant repos must have `commodore.tenantId` set
  const isTenantRepo: boolean =
    config.tenantId != null && config.tenantId != '';

  let cluster: ClusterData = new ClusterData();
  let globalExtraConfig: any = {};
  let clusterInfo: ClusterInfo | undefined = undefined;

  if (isTenantRepo) {
    logger.debug('Identified current repo as tenant repo');
    cluster.name = parse(fileName).name;
    cluster.tenant = config.tenantId;

    const globalRepo: RepoConfig = await cloneGlobalRepo(config);

    if (config.lieutenantURL && config.lieutenantURL != '') {
      if (config.lieutenantToken == '') {
        logger.warn(
          `Lieutenant token is empty. Renovate won't try to query the Lieutenant API at ${config.lieutenantURL}`
        );
      } else {
        logger.info(`Querying Lieutenant at ${config.lieutenantURL}`);
        try {
          clusterInfo = await fetchClusterInfo(config, cluster.name);
        } catch (error: any) {
          if (error instanceof LieutenantError) {
            const err = error as LieutenantError;
            if (err.statusCode == 404) {
              logger.debug(`Lieutenant query returned 404 for ${cluster.name}`);
            } else {
              logger.info(
                `Error querying Lieutenant for ${cluster.name}: statusCode=${err.statusCode}, reason=${err.message}`
              );
            }
          } else {
            logger.error(`Unexpected error querying Lieutenant: ${error}`);
          }
        }
      }
    }

    globalExtraConfig = globalRepo.extraConfig;
    globalDir = globalRepo.dir;
  }

  const extraValuesPath: string = `${cacheDir()}/${
    parse(fileName).name
  }-extra.yaml`;

  const extraConfigStr: string = config.extraConfig
    ? (await readLocalFile(config.extraConfig)).toString()
    : '{}';
  // Merge user-supplied extra config with defaults
  let extraConfig = { ...defaultExtraConfig };
  extraConfig = mergeConfig(extraConfig, globalExtraConfig);
  extraConfig = mergeConfig(extraConfig, JSON.parse(extraConfigStr));

  // Merge any facts/dynamic facts fetched from cluster with extraParameters
  // given in hierarchy.
  let params = extraConfig.extraParameters;
  if (clusterInfo != undefined) {
    params = mergeConfig(params, {
      facts: clusterInfo.facts,
      dynamic_facts: clusterInfo.dynamicFacts,
    });
  }

  try {
    await writeYamlFile(extraValuesPath, {
      parameters: {
        ...params,
        ...{ cluster: cluster },
      },
    });
  } catch (err) {
    logger.error(`Error while writing extra parameters YAML: ${err}`);
  }

  let facts: Facts = parseFileName(
    fileName,
    new RegExp(extraConfig.distributionRegex),
    new RegExp(extraConfig.cloudRegionRegex),
    extraConfig.ignoreValues
  );

  if (extraConfig.factsMap[fileName]) {
    facts = factsFromAny(extraConfig.factsMap[fileName]);
  }

  // If we have actual cluster facts, overwrite parsed facts.
  if (clusterInfo !== undefined) {
    facts = factsFromAny(clusterInfo.facts);
  }

  try {
    components = await extractComponents(
      content,
      repoDir,
      globalDir,
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
