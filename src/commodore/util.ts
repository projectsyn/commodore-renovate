import clone from 'just-clone';
import yaml from 'js-yaml';

import { readFile, writeFile } from 'fs/promises';

import { logger } from 'renovate/dist/logger';
import { getGlobalConfig } from 'renovate/dist/config/global';

import type { Facts } from './types';

export function cacheDir(): string {
  let cacheDir: string | undefined = getGlobalConfig().cacheDir;
  if (cacheDir === undefined) {
    cacheDir = '/tmp/renovate';
  }
  return cacheDir;
}

/* Prune object, removing any null or undefined keys */
export function pruneObject(obj: Facts) {
  return Object.entries(obj)
    .filter(([_, v]) => v !== undefined && v !== null)
    .reduce((main, [key, value]) => ({ ...main, [key]: value }), {});
}

/* Render object as YAML and write to file */
export async function writeYamlFile(
  filePath: string,
  obj: object
): Promise<void> {
  const objYaml: string = yaml.dump(obj);
  return writeFile(filePath, objYaml);
}

/* Extract distribution/cloud/region from filename */
export function parseFileName(
  fileName: string,
  distributionRegex: RegExp,
  cloudRegionRegex: RegExp,
  ignoreValues: Array<string>
): Facts {
  const distA = fileName.match(distributionRegex);
  const cloudA = fileName.match(cloudRegionRegex);

  const dist = distA ? distA.groups : null;
  const cloud = cloudA ? cloudA.groups : null;

  let facts: Facts = {
    distribution: null,
    cloud: null,
    region: null,
  };
  if (dist !== undefined && dist !== null) {
    facts.distribution = dist.distribution;
    facts.cloud = dist.cloud ? dist.cloud : null;
  }
  if (cloud !== undefined && cloud !== null) {
    facts.cloud = cloud.cloud;
    facts.region = cloud.region ? cloud.region : null;
  }

  if (
    facts.distribution !== null &&
    ignoreValues.includes(facts.distribution)
  ) {
    facts.distribution = null;
  }
  if (facts.cloud !== null && ignoreValues.includes(facts.cloud)) {
    facts.cloud = null;
  }
  if (facts.region !== null && ignoreValues.includes(facts.region)) {
    facts.region = null;
  }

  return facts;
}

function isObject(item: any) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Adapted from https://stackoverflow.com/a/37164538
export function mergeConfig(base: any, config: any): any {
  let output = clone(base);
  if (isObject(base) && isObject(config)) {
    Object.keys(config).forEach((key) => {
      if (isObject(config[key])) {
        if (!(key in base)) Object.assign(output, { [key]: config[key] });
        else output[key] = mergeConfig(base[key], config[key]);
      } else if (Array.isArray(config[key])) {
        if (!(key in base)) {
          Object.assign(output, { [key]: Array.from(config[key]) });
        } else if (Array.isArray(output[key])) {
          output[key].push(...config[key]);
        } else {
        }
      } else {
        Object.assign(output, { [key]: config[key] });
      }
    });
  }
  return output;
}

export async function parseGlobalRepoConfig(globalDir: string): Promise<any> {
  const globalDirConfigFile: string = globalDir + '/renovate.json';
  let globalDirConfig: any = {};
  try {
    const globalConfigStr: string = (
      await readFile(globalDirConfigFile)
    ).toString();
    globalDirConfig = JSON.parse(globalConfigStr) as any;
  } catch (e: any) {
    logger.info(
      {
        globalDir: globalDir,
        exception: e,
      },
      'Exception while reading global repo config'
    );
  }
  if (
    globalDirConfig.commodore !== undefined &&
    globalDirConfig.commodore.extraConfig !== undefined
  ) {
    try {
      const globalExtraConfigStr = (
        await readFile(globalDir + '/' + globalDirConfig.commodore.extraConfig)
      ).toString();
      return JSON.parse(globalExtraConfigStr) as any;
    } catch (e: any) {
      logger.info(
        {
          globalDir: globalDir,
          extraConfig: globalDirConfig.commodore.extraConfig,
          exception: e,
        },
        'Exception while reading global repo extraConfig'
      );
    }
  }
  return {};
}
