import { loadFixture, getFixturePath, getLoggerErrors } from '../test/util';
import {
  defaultConfig,
  extractPackageFile,
  extractAllPackageFiles,
  handleOCIChart,
} from './index';
import { beforeEach, describe, expect, it } from 'vitest';

import { GlobalConfig } from 'renovate/dist/config/global';

import { clearProblems } from 'renovate/dist/logger';
import { getRegexPredicate } from 'renovate/dist/util/string-match';
import { PackageDependency } from 'renovate/dist/modules/manager/types';
import { DockerDatasource } from 'renovate/dist/modules/datasource/docker';

function setGlobalConfig(fixtureId: string): void {
  GlobalConfig.get().localDir = getFixturePath(fixtureId);
  GlobalConfig.get().cacheDir = '/tmp/renovate';
}

beforeEach(() => {
  // clear logger
  clearProblems();
});

const defaults1 = loadFixture('1/class/defaults.yml');
const defaults3 = loadFixture('3/class/defaults.yml');
const defaults4 = loadFixture('4/class/defaults.yml');
const defaults7 = loadFixture('7/class/defaults.yml');
const defaults8 = loadFixture('8/class/defaults.yml');
const config1 = {
  depName: 'chart-1',
  baseDeps: [
    {
      depName: 'chart-1',
      groupName: 'component-name',
    },
    {
      depName: 'chart-2',
      groupName: 'component-name',
    },
  ],
};
const config1partial1 = {
  depName: 'chart-1',
  baseDeps: [],
};
const config1partial2 = {
  depName: 'chart-1',
  baseDeps: [
    {
      depName: 'chart-1',
    },
    {
      depName: 'chart-2',
    },
  ],
};
const config1wrong1 = {
  depName: 'chart-1',
  baseDeps: [
    {
      depName: 'chart-1',
      groupName: 'component-name',
    },
    {
      depName: 'chart-3',
      groupName: 'component-name',
    },
  ],
};
const config3 = {
  depName: 'chart-1',
  baseDeps: [
    {
      depName: 'chart-1',
      propSource: 'chart_1',
      groupName: 'component-name',
    },
    {
      depName: 'chart-2',
      propSource: 'chart2',
      groupName: 'component-name',
    },
  ],
};
const config8 = {
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
    it('returns null when provided empty dependency info', () => {
      const res = extractPackageFile(
        defaults1,
        'class/defaults.yml',
        config1partial1
      );
      expect(res).toBeNull();
    });
    it('returns null when provided incomplete dependency info', () => {
      const res = extractPackageFile(
        defaults1,
        'class/defaults.yml',
        config1partial2
      );
      expect(res).toBeNull();
    });
    it('handles wrong dependency info gracefully', () => {
      const res = extractPackageFile(
        defaults1,
        'class/defaults.yml',
        config1wrong1
      );
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
    it('extracts Helm chart versions when called with sufficient config', () => {
      const res = extractPackageFile(defaults1, 'class/defaults.yml', config1);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
    it('extracts Helm chart versions from new and old standard', () => {
      const res = extractPackageFile(defaults7, 'class/defaults.yml', config1);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
    it('extracts Helm chart versions for mismatched keys when called with sufficient config', () => {
      const res = extractPackageFile(defaults3, 'class/defaults.yml', config3);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
    it('extracts OCI Helm chart versions when called with sufficient config', () => {
      const res = extractPackageFile(defaults8, 'class/defaults.yml', config8);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.deps).toMatchSnapshot();
        expect(res.deps.length).toBe(2);
      }
    });
    it('gracefully ignores components without `charts` field', () => {
      const res = extractPackageFile(defaults4, 'class/defaults.yml', config1);
      expect(res).toBeNull();
    });
  });
  // This test also covers `extractHelmChartDependencies()`, since that's the
  // function which does the heavy lifting for `extractAllPackageFiles()`.
  describe('extractAllPackageFiles()', () => {
    it('extracts old standard Helm dependencies', async () => {
      setGlobalConfig('1');
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
    it('extracts old standard Helm dependencies for components with long names', async () => {
      setGlobalConfig('2');
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
    it('extracts old-style Helm dependencies with mismatched names', async () => {
      setGlobalConfig('3');
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
    it('gracefully ignores components without Helm chart dependencies', async () => {
      setGlobalConfig('4');
      const res = await extractAllPackageFiles({}, [
        'class/defaults.yml',
        'class/component-name.yml',
      ]);
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).toBeNull();
    });
    it('gracefully ignores components with old standard `charts` parameter but no Kapitan config', async () => {
      setGlobalConfig('5');
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
        const res0 = res[0];
        expect(res0).not.toBeNull();
        if (res0) {
          expect(res0.packageFile).toBe('class/defaults.yml');
          const deps = res0.deps;
          expect(deps).toMatchSnapshot();
          expect(deps.length).toBe(1);
        }
      }
    });
    it('gracefully ignores components with old standard `charts` parameter but no Kapitan helm dependencies', async () => {
      setGlobalConfig('5');
      const res = await extractAllPackageFiles({}, [
        'class/defaults.yml',
        'class/component-name-2.yml',
      ]);
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
      expect(res).not.toBeNull();
      if (res) {
        expect(res.length).toBe(1);
        const res0 = res[0];
        expect(res0).not.toBeNull();
        if (res0) {
          expect(res0.packageFile).toBe('class/defaults.yml');
          const deps = res0.deps;
          expect(deps).toMatchSnapshot();
          expect(deps.length).toBe(1);
        }
      }
    });
    it("records an error for repositories which don't have exactly 2 package files", async () => {
      const res = await extractAllPackageFiles({}, ['class/defaults.yml']);
      expect(res).toBeNull();
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
    });
    it('records an error for non-component repositories which have two package files', async () => {
      const res = await extractAllPackageFiles({}, [
        'class/test1.yml',
        'class/test2.yml',
      ]);
      expect(res).toBeNull();
      const errors = getLoggerErrors();
      if (errors.length > 0) {
        console.log(errors);
      }
      expect(errors.length).toBe(0);
    });
    it('extracts new and old standard Helm dependencies in the same file', async () => {
      setGlobalConfig('7');
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
    it('extracts OCI charts from new and old Helm dependencies', async () => {
      setGlobalConfig('8');
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
    it("doesn't match golden test files as files to renovate", async () => {
      expect(defaultConfig.managerFilePatterns.length).toBe(1);
      // Use renovate's `getRegexPredicate()` to parse the pattern. This is
      // necessary, because managerFilePatterns now contains strings that are
      // //-enclosed regex patterns and not raw regex patterns that can be
      // passed to new RegExp().
      const re = getRegexPredicate(defaultConfig.managerFilePatterns[0]);
      expect(re).not.toBeNull();
      if (re != null) {
        expect(re('class/defaults.yml')).toBe(true);
        expect(re('class/component-name.yml')).toBe(true);
        expect(re('class/name.yaml')).toBe(true);
        expect(re('tests/golden/storageclass/sc.yaml')).toBe(false);
        expect(re('tests/golden/class/class.yaml')).toBe(false);
      }
    });
  });
  describe('handleOCIChart()', () => {
    it('skips dependencies without registryUrls', async () => {
      const dep = {
        currentValue: '1.2.3',
        depName: 'test',
      } as PackageDependency;
      const res = handleOCIChart(dep);
      expect(res).not.toBeNull();
      expect(res).toStrictEqual(dep);
    });
    it("doesn't modify regular Helm dependencies", async () => {
      const dep = {
        currentValue: '1.2.3',
        depName: 'test',
        registryUrls: ['https://charts.example.com'],
      } as PackageDependency;
      const res = handleOCIChart(dep);
      expect(res).not.toBeNull();
      expect(res).toStrictEqual(dep);
    });
    it('rewrites OCI Helm dependencies', async () => {
      const dep = {
        currentValue: '1.2.3',
        depName: 'test',
        registryUrls: ['oci://charts.example.com/test'],
      } as PackageDependency;
      const res = handleOCIChart(dep);
      expect(res).not.toBeNull();
      const expected = {
        datasource: DockerDatasource.id,
        packageName: 'charts.example.com/test',
        currentValue: '1.2.3',
        depName: 'test',
        registryUrls: ['oci://charts.example.com'],
      } as PackageDependency;
      expect(res).toStrictEqual(expected);
    });
    it("doesn't double-rewrite OCI Helm dependencies", async () => {
      const dep = {
        currentValue: '1.2.3',
        depName: 'test',
        registryUrls: ['oci://charts.example.com/test'],
      } as PackageDependency;
      const res = handleOCIChart(dep);
      expect(res).not.toBeNull();
      const expected = {
        datasource: DockerDatasource.id,
        packageName: 'charts.example.com/test',
        currentValue: '1.2.3',
        depName: 'test',
        registryUrls: ['oci://charts.example.com'],
      } as PackageDependency;
      expect(res).toStrictEqual(expected);
      const res2 = handleOCIChart(res);
      expect(res2).not.toBeNull();
      expect(res2).toStrictEqual(expected);
    });
  });
});
