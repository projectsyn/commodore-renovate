import { beforeAll, afterAll, describe, expect, it, jest } from '@jest/globals';
import { copyFile, mkdir, readdir } from 'fs/promises';
import { rmSync } from 'fs';

import Git from 'simple-git';

import { getGlobalConfig } from 'renovate/dist/config/global';

import { getFixturePath, loadFixture } from '../test/util';
import { defaultConfig, extractPackageFile } from './index';

import nock from 'nock';

import type { BunyanRecord } from 'renovate/dist/logger/types';
import { ERROR } from 'bunyan';

import { clearProblems, getProblems } from 'renovate/dist/logger';

const params1 = loadFixture('1/params.yml');
const kube2 = loadFixture('2/kubernetes.yml');
const invalid3 = loadFixture('3/params.yml');
const pin4 = loadFixture('4/pins.yml');
const tenant1 = loadFixture('5/tenant/c-foo.yml');
const tenant2 = loadFixture('5/tenant/c-foo-2.yml');

function getLoggerErrors(): BunyanRecord[] {
  const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
  return loggerErrors;
}

jest.mock('renovate/dist/config/global');
function mockGetGlobalConfig(
  fixtureId: string,
  isTenantFixture: boolean
): void {
  const mockGetGlobalConfigFn = getGlobalConfig as jest.MockedFunction<
    typeof getGlobalConfig
  >;
  mockGetGlobalConfigFn.mockImplementation(() => {
    return {
      localDir: getFixturePath(fixtureId) + (isTenantFixture ? '/tenant' : ''),
      cacheDir: '/tmp/renovate',
    };
  });
}

async function setupGlobalRepo(
  fixtureId: string,
  targetId: string
): Promise<string> {
  const repoDir = `/tmp/renovate/${targetId}/commodore-defaults`;
  await mkdir(repoDir, { recursive: true });
  const git = Git({ baseDir: repoDir });
  await git.init();
  await git.addConfig('user.name', 'Commodore-Renovate Unit Tests');
  await git.addConfig('user.email', 'ahoy@syn.tools');
  const sourceDir = getFixturePath(fixtureId);
  const repoContents = await readdir(sourceDir);
  repoContents.forEach((file) => {
    copyFile(sourceDir + '/' + file, repoDir + '/' + file);
    git.add(file);
  });
  await git.commit('initial commit');
  return repoDir;
}

function setupNock(
  clusterId: string,
  statusCode: number,
  reason: string,
  dynamicFacts: boolean
): nock.Scope {
  let reply200: any = {
    id: clusterId,
    tenant: 't-bar',
    displayName: 'Foo cluster',
    facts: {
      cloud: 'none',
      distribution: 'k3d',
      'lieutenant-instance': 'example-com',
    },
    gitRepo: {
      deployKey: 'ssh-rsa AAAAB...',
      hostKeys: 'git.example.com ssh-rsa AAAAB...',
      type: 'auto',
      url: 'ssh://git@git.example.com/cluster-catalogs/c-cluster-id-1234.git',
    },
  };
  if (dynamicFacts) {
    // Change facts when testing response without dynamic facts to avoid
    // reusing cached response, since we don't consider dynamic facts when
    // caching commodore results at the moment.
    reply200.facts.cloud = 'local';
    reply200.dynamicFacts = {
      fact: '1',
      fact2: '2',
    };
  }
  const scope = nock('https://lieutenant.example.com', {
    reqheaders: {
      authorization: 'Bearer mock-api-token',
    },
  }).get(`/clusters/${clusterId}`);
  if (statusCode == 200) {
    return scope.reply(statusCode, reply200);
  }
  return scope.reply(statusCode, { reason: reason });
}

beforeAll(() => {
  return mkdir('/tmp/renovate', { recursive: true });
});

beforeEach(() => {
  // clear logger
  clearProblems();
});

afterAll(() => {
  // Remove global repo clone created by the test
  rmSync('/tmp/renovate/global-repos/', { recursive: true });
});

describe('src/commodore/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      mockGetGlobalConfig('1', false);
      return expect(
        extractPackageFile('nothing here', 'no.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('extracts component versions', async () => {
      mockGetGlobalConfig('2', false);
      const res = await extractPackageFile(
        params1,
        '1/params.yml',
        defaultConfig
      );
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(6);
      }
    });
    it('returns no component version for files without components', () => {
      return expect(
        extractPackageFile(kube2, '2/kubernetes.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('returns null for invalid yaml', () => {
      mockGetGlobalConfig('3', false);
      return expect(
        extractPackageFile(invalid3, '3/params.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('extracts component urls for version pins', async () => {
      mockGetGlobalConfig('4', false);
      const res = await extractPackageFile(pin4, '4/pins.yml', defaultConfig);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
    });
    it('extracts component urls for version pins in tenant repo', async () => {
      mockGetGlobalConfig('5', true);
      const globalRepoDir: string = await setupGlobalRepo('5/global', '5');
      const config: any = { ...defaultConfig };
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      const res = await extractPackageFile(
        tenant1,
        '5/tenant/c-foo.yml',
        config
      );
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }

      // Clean up global repo for this test case
      rmSync('/tmp/renovate/5', { recursive: true });
    });
    it('uses cluster info returned by Lieutenant', async () => {
      mockGetGlobalConfig('5', true);
      const globalRepoDir: string = await setupGlobalRepo('5/global', '6');
      const scope = setupNock('c-foo-2', 200, '', true);
      const config: any = { ...defaultConfig };
      config.lieutenantURL = 'https://lieutenant.example.com';
      config.lieutenantToken = 'mock-api-token';
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      config.dynamic_facts;
      const res = await extractPackageFile(
        tenant2,
        '5/tenant/c-foo-2.yml',
        config
      );
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
      expect(scope.isDone()).toBe(true);

      // Clean up global repo for this test case
      rmSync('/tmp/renovate/6', { recursive: true });
    });
    it('proceeds without cluster info on 404', async () => {
      mockGetGlobalConfig('5', true);
      const globalRepoDir: string = await setupGlobalRepo('5/global', '7');
      const scope = setupNock('c-foo-3', 404, 'cluster not found', false);
      const config: any = { ...defaultConfig };
      config.lieutenantURL = 'https://lieutenant.example.com';
      config.lieutenantToken = 'mock-api-token';
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      const res = await extractPackageFile(
        tenant2,
        '5/tenant/c-foo-3.yml',
        config
      );
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
      expect(scope.isDone()).toBe(true);

      // Clean up global repo for this test case
      rmSync('/tmp/renovate/7', { recursive: true });
    });
    it('uses facts from factsMap', async () => {
      const globalRepoDir: string = await setupGlobalRepo('5/global', '8');
      const config: any = { ...defaultConfig };
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      config.extraConfig = 'renovate.commodore.json';
      const res = await extractPackageFile(
        tenant2,
        '5/tenant/test.yml',
        config
      );
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }

      // Clean up global repo for this test case
      rmSync('/tmp/renovate/8', { recursive: true });
    });
    it('generates valid Commodore parameters for clusters with no dynamic facts', async () => {
      mockGetGlobalConfig('5', true);
      const globalRepoDir: string = await setupGlobalRepo('5/global', '9');
      const scope = setupNock('c-foo-4', 200, '', false);
      const config: any = { ...defaultConfig };
      config.lieutenantURL = 'https://lieutenant.example.com';
      config.lieutenantToken = 'mock-api-token';
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      const res = await extractPackageFile(
        tenant2,
        '5/tenant/c-foo-4.yml',
        config
      );
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
      expect(scope.isDone()).toBe(true);

      // Clean up global repo for this test case
      rmSync('/tmp/renovate/9', { recursive: true });
    });
  });
});
