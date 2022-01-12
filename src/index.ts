#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import api from 'renovate/dist/manager/api.js';
import { logger } from 'renovate/dist/logger';
import type { AllConfig } from 'renovate/dist/config/types';

import * as commodore from './commodore';
import { globalRepos } from './commodore/util';

api.set('commodore', commodore);

// Patch renovate option validation to accept `commodore.extraConfig`
// parameter.
import { getOptions } from 'renovate/dist/config/options';
let options = getOptions();
options.push({
  name: 'extraConfig',
  description: 'Extra configuration file for commodore manager',
  type: 'string',
  default: '',
});
options.push({
  name: 'globalRepoURL',
  description: 'URL of the global repo for the commodore manager',
  type: 'string',
  default: '',
});
options.push({
  name: 'tenantId',
  description:
    'Tenant ID. This must match the tenant the repo is belonging to.',
  type: 'string',
  default: '',
});
options.push({
  name: 'lieutenantURL',
  description:
    'URL of Lieutenant API. Used to fetch cluster facts when renovating tenant repos.',
  type: 'string',
  default: '',
});
options.push({
  name: 'lieutenantTokenEnvVar',
  description: 'Environment variable to read the Lieutenant API token from.',
  type: 'string',
  default: 'LIEUTENANT_API_TOKEN',
});

// Patch Renovate's `filterConfig` so we can implement the dynamic Env var
// config for the Lieutenant token. We need the require() here so we can
// overwrite the exported function.
// Note: We don't patch `getRepositoryConfig`, but instead `filterConfig`
// which is called by `getRepositoryConfig`. This is because the call site of
// `getRepositoryConfig` doesn't use the exported function but rather calls
// the original function in the same module directly, so patching the exported
// `getRepositoryConfig` here has no effect.
// @ts-ignore
const renovate_config = require('renovate/dist/config');
const origFilterConfig = renovate_config.filterConfig;
function patchedFilterConfig(
  inputConfig: AllConfig,
  manager: string
): AllConfig {
  let cfg = origFilterConfig(inputConfig, manager);
  if (cfg.lieutenantTokenEnvVar) {
    const token = process.env[cfg.lieutenantTokenEnvVar];
    if (token) {
      cfg.lieutenantToken = token;
    }
  }
  return cfg;
}
renovate_config.filterConfig = patchedFilterConfig;

// Patch renovate finalizer, we need the require() here despite what the TS
// hint indicates. However, seems that suggestions cannot be suppressed with
// typescript hints (e.g. @ts-ignore).
// @ts-ignore
const init = require('renovate/dist/workers/global/initialize');
const origGlobalFinalize: any = init.globalFinalize;
function patchedGlobalFinalize(config: any) {
  globalRepos.forEach((repo, globalRepoURL) => {
    logger.info(
      { repo: repo.dir },
      `deleting global defaults ${globalRepoURL}`
    );
    if (existsSync(repo.dir)) {
      rmSync(repo.dir, { recursive: true });
    }
  });
  origGlobalFinalize(config);
}
init.globalFinalize = patchedGlobalFinalize;

require('renovate/dist/renovate.js');
