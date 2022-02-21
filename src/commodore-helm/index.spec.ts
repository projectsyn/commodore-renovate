import { getFixturePath } from '../test/util';
import { extractPackageFile, extractAllPackageFiles, extractHelmChartDependencies } from './index';
import { beforeEach, expect, describe, it } from '@jest/globals';

import { getGlobalConfig } from 'renovate/dist/config/global';

import type { BunyanRecord } from 'renovate/dist/logger/types';
import { ERROR } from 'bunyan';

import { clearProblems, getProblems } from 'renovate/dist/logger';

jest.mock('renovate/dist/config/global');
function mockGetGlobalConfig(
  fixtureId: string,
): void {
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


describe('manager/commodore-helm/index', () => {
  describe('extractPackageFile()', () => {
  });
  describe('extractAllPackageFiles()', () => {
    it('extracts standard Helm dependencies', async () => {
      mockGetGlobalConfig('1');
      const res = await extractAllPackageFiles({}, ['class/defaults.yml', 'class/component-name.yml']);
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
      const res = await extractAllPackageFiles({}, ['class/defaults.yml', 'class/long-component-name.yml']);
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
      const res = await extractAllPackageFiles({}, ['class/defaults.yml', 'class/component-name.yml']);
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
  describe('extractHelmChartDependencies()', () => {
  });
});
