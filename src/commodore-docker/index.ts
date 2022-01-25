import yaml from 'js-yaml';

import type {
  PackageFile,
  PackageDependency,
} from 'renovate/dist/manager/types';

import { getDep } from 'renovate/dist/manager/dockerfile/extract';
import { id as dockerVersioning } from 'renovate/dist/versioning/docker';

export const defaultConfig = {
  fileMatch: ['class/defaults.ya?ml$'],
};

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  const doc: any = yaml.load(content);

  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null
  ) {
    return null;
  }

  const deps = Object.values(doc.parameters).flatMap((component: any) =>
    component.images !== undefined
      ? extractImageDependencies(component.images)
      : []
  );

  if (deps.length == 0) {
    return null;
  }

  return { deps };
}

function extractImageDependencies(
  images: Record<string, any>
): PackageDependency[] {
  return Object.values(images)
    .map(parseImageDependency)
    .filter((dep): dep is PackageDependency => dep !== null);
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
