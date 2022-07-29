import { join } from 'path';

import { execSync } from 'child_process';

import { logger } from 'renovate/dist/logger';

import { cacheDir, pruneObject, writeYamlFile } from './util';

import type { CommodoreParameters, Facts } from './types';

let versionCache: Map<string, CommodoreParameters> = new Map();

function cacheKey(prefix: string, facts: Facts): string {
  return `${prefix}${facts.distribution}-${facts.cloud}-${facts.region}`;
}

export async function writeFactsFile(
  cacheKey: string,
  facts: Facts
): Promise<string> {
  /* Write facts class for `commodore inventory component` */
  const factsPath: string = join(cacheDir(), `${cacheKey}-facts.yaml`);
  await writeYamlFile(factsPath, {
    parameters: { facts: pruneObject(facts) },
  });

  return factsPath;
}

export async function renderInventory(
  repoPath: string,
  globalPath: string,
  extraValuesPath: string,
  facts: Facts
): Promise<CommodoreParameters> {
  const ck: string = cacheKey(`${repoPath}-`, facts);
  let cachedVersions = versionCache.get(ck);
  if (cachedVersions !== undefined) {
    logger.info(`Reusing cached versions for ${ck}`);
    return cachedVersions;
  }

  let factsPath: string = '';
  try {
    logger.debug(
      `Writing facts file for dist: ${facts.distribution}, cloud: ${facts.cloud}, region: ${facts.region}`
    );
    factsPath = await writeFactsFile(cacheKey('', facts), facts);
  } catch (err) {
    logger.warn(`Error writing facts YAML: ${err}`);
    return {
      components: new Map(),
      packages: new Map(),
    };
  }
  try {
    /* construct and execute Commodore command */
    var command = `commodore inventory show ${globalPath} ${repoPath} -ojson -f ${factsPath} -f ${extraValuesPath}`;
    const result: string = execSync(command, { stdio: 'pipe' }).toString();
    const resp: any = JSON.parse(result);

    const components: Object =
      resp.components !== undefined ? resp.components : {};
    const packages: Object = resp.packages !== undefined ? resp.packages : {};

    const params: CommodoreParameters = {
      components: new Map(Object.entries(components)),
      packages: new Map(Object.entries(packages)),
    };
    versionCache.set(ck, params);
    return params;
  } catch (e: any) {
    const stderr = e.stderr.toString();
    logger.warn(`Error rendering reclass inventory: ${stderr}`);
    return {
      components: new Map(),
      packages: new Map(),
    };
  }
}
