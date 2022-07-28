import { parse } from 'path';
import yaml from 'js-yaml';

import * as gitRef from 'renovate/dist/modules/datasource/git-refs';
import { logger } from 'renovate/dist/logger';
import { GlobalConfig } from 'renovate/dist/config/global';
import { readLocalFile } from 'renovate/dist/util/fs';
import type { PackageFile } from 'renovate/dist/modules/manager/types';

import type {
  CommodoreDependency,
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

export const supportedDatasources = [gitRef.GitRefsDatasource.id];

function factsFromAny(facts: any): Facts {
  return {
    distribution: facts.distribution || null,
    cloud: facts.cloud || null,
    region: facts.region || null,
  } as Facts;
}

function dynamicFactsFromAny(dynamicFacts: any): any {
  if (dynamicFacts) {
    return dynamicFacts;
  } else {
    return {};
  }
}

// extractDependencies will extract all component and package dependencies.
// It will return an error if the content is not valid yaml.
async function extractDependencies(
  content: string,
  repoDir: string | undefined,
  globalDir: string,
  extraValuesPath: string,
  facts: Facts
): Promise<CommodoreDependency[]> {
  const doc: CommodoreConfig = yaml.load(content) as CommodoreConfig;
  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null
  ) {
    return [];
  }

  /* Render inventory with commodore to extract full dependency information */
  let params: CommodoreParameters = {
    components: new Map(),
    packages: new Map(),
  };
  if (repoDir === undefined) {
    logger.warn(
      'Unable to determine repo directory, cannot infer component or package URLs from rendered inventory.'
    );
  } else {
    params = await renderInventory(repoDir, globalDir, extraValuesPath, facts);
  }

  const components = parseDependency(
    doc.parameters.components,
    params.components,
    'component'
  );
  const packages = parseDependency(
    doc.parameters.packages,
    params.packages,
    'package'
  );
  return components.concat(packages);
}

function parseDependency(
  deps: Map<string, CommodoreDependency>,
  versions: Map<string, CommodoreDependency>,
  depType: string
): CommodoreDependency[] {
  if (deps === undefined || deps === null) {
    return [];
  }
  return Object.entries(deps).map(([key, dep]) => {
    const rc: CommodoreDependency | undefined = versions.get(key);
    if (dep.url === undefined || dep.url === null || dep.url === '') {
      if (rc !== undefined && rc !== null) {
        dep.url = rc.url;
      }
    }
    dep.name = depType + '-' + key;
    return dep;
  });
}

function injectLieutenantToken(config: any) {
  let token = process.env[config.lieutenantTokenEnvVar];
  if (!token) {
    token = '';
  }
  config.lieutenantToken = token;
}

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: any
): Promise<PackageFile | null> {
  // Inject Lieutenant token into config object
  injectLieutenantToken(config);

  let components: CommodoreDependency[];

  const repoDir: string | undefined = GlobalConfig.get('localDir');
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
          {
            cluster: cluster.name,
            lieutenantURL: config.lieutenantURL,
          },
          "Lieutenant token is empty. Renovate won't try to query the Lieutenant API"
        );
      } else {
        logger.debug(
          {
            lieutenantURL: config.lieutenantURL,
          },
          'Querying Lieutenant'
        );
        try {
          clusterInfo = await fetchClusterInfo(config, cluster.name);
        } catch (error: any) {
          if (error instanceof LieutenantError) {
            const err = error as LieutenantError;
            if (err.statusCode == 404) {
              logger.debug(
                {
                  cluster: cluster.name,
                },
                'Lieutenant query returned 404'
              );
            } else {
              logger.info(
                {
                  cluster: cluster.name,
                  statusCode: err.statusCode,
                  reason: err.message,
                },
                'Error querying Lieutenant'
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
  if (clusterInfo !== undefined) {
    params = mergeConfig(params, {
      facts: factsFromAny(clusterInfo.facts),
      dynamic_facts: dynamicFactsFromAny(clusterInfo.dynamicFacts),
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
    components = await extractDependencies(
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

  const deps = components.map((v: CommodoreDependency) => ({
    depName: `${v.name} in ${fileName}`,
    packageName: v.url,
    currentValue: v.version,
  }));
  return { deps, datasource: gitRef.GitRefsDatasource.id };
}
