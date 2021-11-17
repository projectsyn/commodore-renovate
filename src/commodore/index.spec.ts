import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdir } from 'fs/promises';
import { getGlobalConfig } from 'renovate/dist/config/global';

import { getFixturePath, loadFixture } from '../test/util';
import { defaultConfig, extractPackageFile } from './index';
import { clearCache } from './inventory';

const params1 = loadFixture('1/params.yml');
const kube2 = loadFixture('2/kubernetes.yml');
const invalid3 = loadFixture('3/params.yml');
const pin4 = loadFixture('4/pins.yml');

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

beforeAll(() => {
  return mkdir('/tmp/renovate', { recursive: true });
});

/* Clear commodore inventory components result cache before each test run */
beforeEach(() => {
  clearCache();
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
  });
});
