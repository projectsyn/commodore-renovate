import { loadFixture, getFixturePath } from '../test/util';
import {
  extractPackageFile,
  extractAllPackageFiles,
  extractHelmChartDependencies,
} from './index';
import { beforeEach, expect, describe, it } from '@jest/globals';

import { getGlobalConfig } from 'renovate/dist/config/global';

import type { BunyanRecord } from 'renovate/dist/logger/types';
import { ERROR } from 'bunyan';

import { clearProblems, getProblems } from 'renovate/dist/logger';

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

function getLoggerErrors(): BunyanRecord[] {
  const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
  return loggerErrors;
}

beforeEach(() => {
  // clear logger
  clearProblems();
});

const defaults1 = loadFixture('1/class/defaults.yml');
const config1 = {
  depName: 'chart-1',
  baseDeps: [
    {
      depName: 'chart-1',
      propSource: 'chart-1',
      groupName: 'component-name',
    },
    {
      depName: 'chart-2',
      propSource: 'chart-2',
      groupName: 'component-name',
    },
  ],
};

describe('manager/commodore-helm/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null when called to discover dependencies', () => {
      const res = extractPackageFile(defaults1, 'class/defaults.yml', {});
      expect(res).toBeNull();
    });
    it('returns null when called on a file other than `class/defaults.ya?ml`', () => {
      const res = extractPackageFile(
        defaults1,
        'class/component-name.yml',
        config1
      );
      expect(res).toBeNull();
    });
    it('extracts Helm chart versions when called with sufficient config', () => {
      const res = extractPackageFile(defaults1, 'class/defaults.yml', config1);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
  });
  // This test also covers `extractHelmChartDependencies()`, since that's the
  // function which does the heavy lifting for `extractAllPackageFiles()`.
  describe('extractAllPackageFiles()', () => {
    it('extracts standard Helm dependencies', async () => {
      mockGetGlobalConfig('1');
      const res = await extractAllPackageFiles({}, [
        'class/defaults.yml',
        'class/component-name.yml',
      ]);
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.length).toBe(1);
        if (res.length == 1) {
          const res0 = res[0];
          expect(res0.packageFile).toBe('class/defaults.yml');
          const deps = res0.deps;
          expect(deps).toMatchSnapshot();
          expect(deps.length).toBe(2);
        }
      }
    });
    it('extracts standard Helm dependencies for components with long names', async () => {
      mockGetGlobalConfig('2');
      const res = await extractAllPackageFiles({}, [
        'class/defaults.yml',
        'class/long-component-name.yml',
      ]);
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.length).toBe(1);
        if (res.length == 1) {
          const res0 = res[0];
          expect(res0.packageFile).toBe('class/defaults.yml');
          const deps = res0.deps;
          expect(deps).toMatchSnapshot();
          expect(deps.length).toBe(2);
        }
      }
    });
    it('extracts Helm dependencies with mismatched names', async () => {
      mockGetGlobalConfig('3');
      const res = await extractAllPackageFiles({}, [
        'class/defaults.yml',
        'class/component-name.yml',
      ]);
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.length).toBe(1);
        if (res.length == 1) {
          const res0 = res[0];
          expect(res0.packageFile).toBe('class/defaults.yml');
          const deps = res0.deps;
          expect(deps).toMatchSnapshot();
          expect(deps.length).toBe(2);
        }
      }
    });
  });
});
