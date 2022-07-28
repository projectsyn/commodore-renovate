import yaml from 'js-yaml';

import path from 'path';

import type {
  ExtractConfig,
  PackageFile,
  PackageDependency,
} from 'renovate/dist/modules/manager/types';

import { HelmDatasource } from 'renovate/dist/modules/datasource/helm';

import { logger } from 'renovate/dist/logger';

import { readLocalFile } from 'renovate/dist/util/fs';

interface KapitanDependency {
  type: string;
  source: string;
  output_path: string;
}

interface KapitanHelmDependency extends KapitanDependency {
  chart_name: string;
  version: string;
}

export const defaultConfig = {
  // match all class files of the component
  fileMatch: ['class/[^.]+.ya?ml$'],
};

export const supportedDatasources = [HelmDatasource.id];

function componentKeyFromName(componentName: string): string {
  return componentName.replace(/-/g, '_');
}

// We need `extractPackageFile` since it gets called by `confirmIfDepUpdated`
// via `doAutoReplace` because we don't provide a custom `updateDependency`
// function ourselves.
// Note that this is only called to verify the upgraded version, the actual
// dependency extraction is done with `extractAllPackageFiles`.
export function extractPackageFile(
  content: string,
  fileName: string,
  config: any
): PackageFile | null {
  logger.debug(
    { fileName, depName: config.depName, baseDeps: config.baseDeps },
    'extractPackageFile upgrade'
  );
  if (!config.depName || !config.baseDeps) {
    logger.warn(
      { fileName },
      'extractPackageFile() called for file without dependency info in config'
    );
    return null;
  }
  if (path.parse(fileName).name != 'defaults') {
    logger.warn(
      { fileName },
      'extractPackageFile() called for a package file other than `defaults.yml`, returning null'
    );
    return null;
  }
  const defaults: any = yaml.load(content);
  if (!defaults || !defaults.parameters) {
    return null;
  }
  const dep = config.baseDeps.find((d: PackageDependency) => {
    return d.depName === config.depName;
  });
  if (!dep || !dep.groupName) {
    return null;
  }
  const componentKey: string = componentKeyFromName(dep.groupName);
  const charts: Map<string, string> = defaults.parameters[componentKey]?.charts;
  if (!charts) {
    return null;
  }

  let deps: PackageDependency[] = Object.entries(charts).map(
    ([chartName, chartSpec]) => {
      if (typeof chartSpec === 'string') {
        // handle old best practice format by looking up the "real"
        // dependency name in the provided baseDeps based on the chart version
        // field name in `class/defaults.yml`.

        let d = config.baseDeps.find((d: PackageDependency) => {
          return (d.propSource ?? d.depName) == chartName;
        });
        let res: PackageDependency = {
          currentValue: chartSpec,
        };
        if (d && d.depName) {
          res.depName = d.depName;
        } else {
          res.skipReason = 'invalid-dependency-specification';
        }
        return res;
      } else if (typeof chartSpec === 'object') {
        // Handle new best practice format. The new format requires that the
        // chart spec key matches the chart name.

        return {
          depName: chartName,
          currentValue: chartSpec.version,
          registryUrls: [chartSpec.source],
        } as PackageDependency;
      } else {
        return {
          depName: chartName,
          skipReason: 'invalid-dependency-specification',
        } as PackageDependency;
      }
    }
  );

  return { deps };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  let fileContents: Map<string, string> = new Map();
  let componentName: string | null = null;
  let defaults_file: string | null = null;

  if (packageFiles.length != 2) {
    logger.warn(
      { packageFiles },
      'Expected exactly two package files, skipping.'
    );
    return null;
  }

  for (const file of packageFiles) {
    const content = (await readLocalFile(file, 'utf8')) ?? '';
    const key = path.parse(file).name;
    fileContents.set(key, content);
    if (key != 'defaults') {
      componentName = key;
    } else {
      defaults_file = file;
    }
  }

  if (!fileContents.has('defaults') || !defaults_file) {
    logger.warn('Repository has no `class/defaults.ya?ml`, skipping');
    return null;
  }

  if (!componentName) {
    logger.warn(
      { packageFiles },
      'Unable to identify component name from package files, skipping'
    );
    return null;
  }

  const defaults: any = yaml.load(fileContents.get('defaults') ?? '');
  const component: any = yaml.load(fileContents.get(componentName) ?? '');

  if (
    defaults === undefined ||
    defaults === null ||
    defaults.parameters === undefined ||
    defaults.parameters === null ||
    component === undefined ||
    component === null ||
    component.parameters === undefined ||
    component.parameters === null
  ) {
    return null;
  }

  const deps: PackageDependency[] = extractHelmChartDependencies(
    componentName,
    defaults.parameters,
    component.parameters
  );

  if (deps.length == 0) {
    return null;
  }

  return [{ packageFile: defaults_file, datasource: HelmDatasource.id, deps }];
}

function extractHelmChartDependencies(
  componentName: string,
  defaults: Record<string, any>,
  componentParams: Record<string, any>
): PackageDependency[] {
  if (
    componentName === '' ||
    defaults === undefined ||
    defaults === null ||
    typeof defaults !== 'object' ||
    componentParams === undefined ||
    componentParams === null ||
    typeof componentParams !== 'object'
  ) {
    return [];
  }

  const componentKey: string = componentKeyFromName(componentName);

  if (!defaults[componentKey]) {
    logger.warn(
      { defaults, componentKey },
      "Couldn't find component key in defaults class"
    );
    return [];
  }

  const charts: Map<string, any> = defaults[componentKey].charts;
  if (!charts) {
    logger.info('No Helm chart versions found');
    return [];
  }
  logger.debug({ charts }, 'chart versions');

  const deps: PackageDependency[] = Object.entries(charts).map(
    ([chartName, chartSpec]) => {
      let res: PackageDependency = {
        depName: chartName,
        groupName: componentName,
      };

      if (typeof chartSpec === 'string') {
        // old best-practice format, expect source to be in Kapitan
        // dependency.
        res.currentValue = chartSpec;
        if (!componentParams.kapitan || !componentParams.kapitan.dependencies) {
          logger.info('No Kapitan dependencies found');
          res.skipReason = 'invalid-dependency-specification';
          return res;
        }

        return extractKapitanHelmDependency(
          res,
          componentParams.kapitan.dependencies,
          chartName,
          componentKey
        );
      } else if (
        typeof chartSpec === 'object' &&
        chartSpec.version &&
        chartSpec.source
      ) {
        // For the new schema, the key in `charts` **MUST** match the Helm
        // chart name.
        res.registryUrls = [chartSpec.source];
        res.currentValue = chartSpec.version;
        return res;
      } else {
        logger.warn({ chartSpec }, 'Unable to parse chart specification');
        res.skipReason = 'invalid-dependency-specification';
        return res;
      }
    }
  );

  logger.debug({ deps }, 'extracted');
  return deps;
}

function extractKapitanHelmDependency(
  res: PackageDependency,
  kapitanDeps: KapitanDependency[],
  chartName: string,
  componentKey: string
): PackageDependency {
  const versionReference = '${' + componentKey + ':charts:' + chartName + '}';
  const kdep = kapitanDeps.find((d) => {
    return (
      d.type === 'helm' &&
      (d as KapitanHelmDependency).version === versionReference
    );
  });
  logger.debug({ chartName, kdep }, 'kapitan dependency for chart');
  const dep: KapitanHelmDependency = kdep as KapitanHelmDependency;

  if (!dep || !dep.chart_name) {
    if (!dep) {
      logger.warn(
        { chartName, versionReference, dep },
        'no Kapitan dependency found for chart'
      );
    }
    res.skipReason = 'invalid-dependency-specification';
    return res;
  }
  if (!dep.source) {
    logger.warn({ chartName }, 'Kapitan dependency has no source, skipping...');
    res.skipReason = 'no-source';
    return res;
  }

  if (dep.chart_name !== res.depName) {
    logger.info(
      { dependencyName: dep.chart_name, versionName: res.depName },
      'mismatched chart name between version and dependency, using depedency name for version lookup.'
    );
    res.depName = dep.chart_name;

    // store name of chart version in `class/defaults.yml` in propSource.
    // This field is only used by the Maven manager, so we should be able
    // to safely use it to propagate the chart's version field.
    res.propSource = chartName;
  }
  res.registryUrls = [dep.source];
  return res;
}
