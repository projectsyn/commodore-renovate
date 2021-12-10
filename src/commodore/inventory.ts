import { execSync } from 'child_process';

import { logger } from 'renovate/dist/logger';

import { cacheDir, pruneObject, writeYamlFile } from './util';

import type { CommodoreParameters, Facts } from './types';

let versionCache: Map<string, CommodoreParameters> = new Map();

function cacheKey(prefix: string, facts: Facts): string {
  return `${prefix}${facts.distribution}-${facts.cloud}-${facts.region}`;
}

export function clearCache(): void {
  versionCache = new Map();
}

export async function writeFactsFile(
  cacheKey: string,
  facts: Facts
): Promise<string> {
  /* Write facts class for `commodore inventory component` */
  const factsPath: string = `${cacheDir()}/${cacheKey}-facts.yaml`;
  try {
    await writeYamlFile(factsPath, {
      parameters: { facts: pruneObject(facts) },
    });
  } catch (err) {
    logger.error(`Error writing facts YAML: ${err}`);
  }
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

  const factsPath: string = await writeFactsFile(cacheKey('', facts), facts);

  /* construct and execute Commodore command */
  var command = `commodore inventory components ${globalPath} ${repoPath} -ojson -f ${factsPath} -f ${extraValuesPath}`;
  try {
    const result: string = execSync(command, { stdio: 'pipe' }).toString();
    const params: CommodoreParameters = {
      components: new Map(Object.entries(JSON.parse(result))),
    };
    versionCache.set(ck, params);
    return params;
  } catch (e: any) {
    const stderr = e.stderr.toString();
    logger.error(`Error rendering reclass inventory: ${stderr}`);
    return { components: new Map() };
  }
}
