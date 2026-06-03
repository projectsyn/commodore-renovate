// NOTE(sg): We declare all the unexported renovate modules that we use in
// this file to work around recent Renovate export / typescript changes.
declare module 'renovate/dist/manager-default-configs.generated.js';
declare module 'renovate/dist/manager-list.generated.js';
declare module 'renovate/dist/modules/datasource/docker';
declare module 'renovate/dist/modules/datasource/git-refs';
declare module 'renovate/dist/modules/datasource/github-releases';
declare module 'renovate/dist/modules/datasource/helm';
declare module 'renovate/dist/modules/manager/api.js';
declare module 'renovate/dist/modules/manager/dockerfile/extract';
declare module 'renovate/dist/modules/manager/helmv3/oci';
declare module 'renovate/dist/modules/versioning/docker';
declare module 'renovate/dist/util/fs';
declare module 'renovate/dist/util/git/config' {
  function simpleGitConfig(): any;
  export { simpleGitConfig };
}
