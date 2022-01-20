import yaml from 'js-yaml';

import type { PackageFile, PackageDependency } from 'renovate/dist/manager/types';

import { getDep } from 'renovate/dist/manager/dockerfile/extract';
import { id as dockerVersioning } from 'renovate/dist/versioning/docker';
import { logger } from 'renovate/dist/logger';


export const defaultConfig = {
  fileMatch: ['^*.ya?ml$'],
};


export async function extractPackageFile(
  content: string,
  fileName: string,
  config: any
): Promise<PackageFile | null> {
  const doc: any = yaml.load(content);
  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null
  ) {
    return null;
  }
  const deps = Object.entries(doc.parameters).flatMap(([_, component]): PackageDependency<Record<string, any>>[] => {
    if ((component as any).images !== undefined) {
      return Object.entries((component as any).images).map(([key, obj]) => {
        logger.info(
          {
            key: key,
            obj: obj
          },
          `dep`
        );
        const image = obj as any
        const dep = getDep(image.registry + '/' + image.repository + ':' + image.tag);
        dep.replaceString = image.tag;
        dep.versioning = dockerVersioning;
        dep.autoReplaceStringTemplate =
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}';
        return dep
      });
    } else {
      return []
    }
  });
  logger.info(
    { deps: deps },
    `found deps`
  );

  return { deps };
}
