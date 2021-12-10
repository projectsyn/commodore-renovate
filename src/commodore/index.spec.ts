import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { copyFile, mkdir, readdir } from 'fs/promises';
import { rmSync } from 'fs';

import Git from 'simple-git';

import { getGlobalConfig } from 'renovate/dist/config/global';

import { getFixturePath, loadFixture } from '../test/util';
import { defaultConfig, extractPackageFile } from './index';

const params1 = loadFixture('1/params.yml');
const kube2 = loadFixture('2/kubernetes.yml');
const invalid3 = loadFixture('3/params.yml');
const pin4 = loadFixture('4/pins.yml');
const tenant5 = loadFixture('5/tenant/c-foo.yml');

jest.mock('renovate/dist/config/global');
function mockGetGlobalConfig(fixtureId: string): void {
  const mockGetGlobalConfigFn = getGlobalConfig as jest.MockedFunction<
    typeof getGlobalConfig
  >;
  mockGetGlobalConfigFn.mockImplementation(() => {
    return {
      localDir: getFixturePath(fixtureId),
      cacheDir: '/tmp/renovate',
    };
  });
}

async function setupGlobalRepo(fixtureId: string): Promise<string> {
  const repoDir = `/tmp/renovate/${fixtureId}/commodore-defaults`;
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

beforeAll(() => {
  return mkdir('/tmp/renovate', { recursive: true });
});

describe('src/commodore/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      mockGetGlobalConfig('1');
      return expect(
        extractPackageFile('nothing here', 'no.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('extracts component versions', async () => {
      mockGetGlobalConfig('2');
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
      mockGetGlobalConfig('3');
      return expect(
        extractPackageFile(invalid3, '3/params.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('extracts component urls for version pins', async () => {
      mockGetGlobalConfig('4');
      const res = await extractPackageFile(pin4, '4/pins.yml', defaultConfig);
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
    });
    it('extracts component urls for version pins in tenant repo', async () => {
      mockGetGlobalConfig('5');
      const globalRepoDir: string = await setupGlobalRepo('5/global');
      const config: any = { ...defaultConfig };
      config.tenantId = 't-bar';
      config.globalRepoURL = `file://${globalRepoDir}`;
      const res = await extractPackageFile(
        tenant5,
        '5/tenant/c-foo.yml',
        config
      );
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(2);
      }
      // Clean up global repo scaffolding for the test
      rmSync('/tmp/renovate/5', { recursive: true });
      // Remove global repo clone created by the test
      rmSync('/tmp/renovate/global-repos/', { recursive: true });
    });
  });
});
