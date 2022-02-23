import { loadFixture, getFixturePath, getLoggerErrors } from '../test/util';
import { extractPackageFile, extractAllPackageFiles } from './index';
import { beforeEach, expect, describe, it } from '@jest/globals';

import { GlobalConfig } from 'renovate/dist/config/global';

import { clearProblems } from 'renovate/dist/logger';

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
      expect(errors.length).toBe(1);
      const err0 = errors[0];
      expect(err0.msg).toBe('Expected exactly two package files, aborting.');
    });
    it('records an error for non-component repositories which have two package files', async () => {
      const res = await extractAllPackageFiles({}, [
        'class/test1.yml',
        'class/test2.yml',
      ]);
      expect(res).toBeNull();
      const errors = getLoggerErrors();
      expect(errors.length).toBe(1);
      const err0 = errors[0];
      expect(err0.msg).toBe(
        'Component repository has no `class/defaults.ya?ml`'
      );
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
  });
});
