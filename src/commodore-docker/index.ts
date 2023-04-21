import yaml from 'js-yaml';

import type {
  PackageFileContent,
  PackageDependency,
} from 'renovate/dist/modules/manager/types';

import { DockerDatasource } from 'renovate/dist/modules/datasource/docker';
import { getDep } from 'renovate/dist/modules/manager/dockerfile/extract';
import { id as dockerVersioning } from 'renovate/dist/modules/versioning/docker';

export const defaultConfig = {
  fileMatch: ['class/defaults.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFileContent | null {
  const doc: any = yaml.load(content);

  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null
  ) {
    return null;
  }

  const deps = extractImageDependencies(doc.parameters);

  if (deps.length == 0) {
    return null;
  }

  return { deps };
}

function extractImageDependencies(
  obj: Record<string, any>
): PackageDependency[] {
  if (obj === undefined || obj === null || typeof obj !== 'object') {
    return [];
  }
  return Object.values(obj)
    .map(parseImageDependency)
    .filter((dep): dep is PackageDependency => dep !== null)
    .concat(Object.values(obj).flatMap(extractImageDependencies));
}

export function parseImageDependency(image: any): PackageDependency | null {
  if (image == undefined || image == null) {
    return null;
  }

  let registry = asString(image.registry) ?? '';
  if (registry != '') {
    registry = registry + '/';
  }
  const repository = asString(image.repository) ?? asString(image.image);
  const tag = asString(image.tag) ?? asString(image.version);

  if (
    repository === undefined ||
    repository === null ||
    tag === undefined ||
    tag == null
  ) {
    return null;
  }

  let dep = getDep(registry + repository + ':' + tag);
  dep.replaceString = tag;
  dep.versioning = dockerVersioning;
  dep.autoReplaceStringTemplate =
    '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}';
  return dep;
}

function asString(value: any): string | null {
  return typeof value === 'string' || value instanceof String
    ? (value as string)
    : null;
}
