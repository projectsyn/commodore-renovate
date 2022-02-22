import yaml from 'js-yaml';

import path from 'path';

import type {
  ExtractConfig,
  PackageFile,
  PackageDependency,
} from 'renovate/dist/manager/types';

import { SkipReason } from 'renovate/dist/types';

import { logger } from 'renovate/dist/logger';

import { readLocalFile } from 'renovate/dist/util/fs';

export const defaultConfig = {
  // match all class files of the component
  fileMatch: ['class/[^.]+.ya?ml$'],
};

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
  const componentKey: string = componentKeyFromName(dep.groupName);
  const charts: Map<string, string> = defaults.parameters[componentKey].charts;
  if (!charts) {
    return null;
  }

  let deps: PackageDependency[] = Object.entries(charts).map(
    ([chartName, chartVersion]) => {
      let d = config.baseDeps.find((d: PackageDependency) => {
        return d.propSource == chartName;
      });
      let res: PackageDependency = {
        depName: d.depName,
        currentValue: chartVersion,
      };
      return res;
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

  for (const file of packageFiles) {
    const content = await readLocalFile(file, 'utf8');
    const key = path.parse(file).name;
    fileContents.set(key, content);
    if (key != 'defaults') {
      componentName = key;
    } else {
      defaults_file = file;
    }
  }

  if (!fileContents.has('defaults')) {
    logger.error('Component repository has no `class/defaults.ya?ml`');
    return null;
  }

  if (!componentName) {
    logger.error(
      { packageFiles },
      'Unable to identify component name from package files'
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

  return [{ packageFile: defaults_file, datasource: 'helm', deps }];
}

interface KapitanDependency {
  type: string;
  source: string;
  output_path: string;
}
interface KapitanHelmDependency extends KapitanDependency {
  chart_name: string;
  version: string;
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

  const chartVersions: Map<string, string> = defaults[componentKey].charts;
  if (!chartVersions) {
    logger.info('No Helm chart versions found');
    return [];
  }
  logger.debug({ chartVersions }, 'chart versions');

  const kapitanHelmDeps: KapitanHelmDependency[] =
    componentParams.kapitan.dependencies.filter(
      (dep: KapitanDependency): dep is KapitanHelmDependency =>
        dep.type === 'helm'
    );
  logger.debug({ kapitanHelmDeps }, 'kapitan helm dependencies');

  const deps: PackageDependency[] = Object.entries(chartVersions).map(
    ([chartName, chartVersion]) => {
      let res: PackageDependency = {
        depName: chartName,
        // store name of chart version in `class/defaults.yml` in propSource.
        // This field is only used by the Maven manager, so we should be able
        // to safely use it to propagate the chart's version field.
        // This is technically only necessary for charts whose version field
        // in the component doesn't match the chart's name, but we just set
        // and use the field unconditionally to keep the code simpler.
        propSource: chartName,
        groupName: componentName,
        currentValue: chartVersion,
      };

      const versionReference =
        '${' + componentKey + ':charts:' + chartName + '}';
      const dep = kapitanHelmDeps.find((d) => {
        return d.version === versionReference;
      });
      logger.debug({ chartName, dep }, 'kapitan dependency for chart');

      if (!dep || !dep.chart_name) {
        if (!dep) {
          logger.warn(
            { chartName, versionReference },
            'no Kapitan dependency found for chart'
          );
        }
        res.skipReason = SkipReason.InvalidDependencySpecification;
        return res;
      }
      if (!dep.source) {
        logger.warn(
          { chartName },
          'Kapitan dependency has no source, skipping...'
        );
        res.skipReason = SkipReason.NoSource;
        return res;
      }

      if (dep.chart_name !== res.depName) {
        logger.info(
          { dependencyName: dep.chart_name, versionName: res.depName },
          'mismatched chart name between version and dependency, using depedency name for version lookup.'
        );
        res.depName = dep.chart_name;
      }
      res.registryUrls = [dep.source];

      return res;
    }
  );

  logger.debug({ deps }, 'extracted');
  return deps;
}
