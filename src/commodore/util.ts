import yaml from 'js-yaml';

import { writeFile } from 'fs/promises';

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

/* Check whether `facts` has any non-null field */
export function hasFact(facts: Facts): boolean {
  return (
    facts.distribution !== null || facts.cloud !== null || facts.region !== null
  );
}
