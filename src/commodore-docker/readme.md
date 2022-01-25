# Commodore Docker manager

Extracts all container image dependencies of a Commodore component.

By default, the manager only searches in `class/defaults.yml` for entries in `parameters.components.*.images`.
The manager is guaranteed to find image dependencies that adhere to the [best practices for container image dependencies](https://syn.tools/syn/explanations/commodore-components/container-images.html).
It will attempt to parse other common dependency structures, but might not be able to parse them correctly.

Generally the manager treats the keys `repository` and `image` as well as `tag` and `version` interchangeably.
It is also able to parse dependencies that include the registry in the `image` or `repository` key.

Here is an example of formats that can be parsed.

```yaml
parameters:
  test:
    images:
      redis: # docker.io/library/redis:6.2.4
        registry: docker.io
        repository: library/redis
        tag: '6.2.4'
      argocd: # quay.io/argoproj/argocd:v2.0.4@sha256:976dfbfadb817ba59f4f641597a13df7b967cd5a1059c966fa843869c9463348'
        registry: quay.io
        image: argoproj/argocd
        version: 'v2.0.4@sha256:976dfbfadb817ba59f4f641597a13df7b967cd5a1059c966fa843869c9463348'
      vault: # vault:1.5.8
        repository: vault
        tag: '1.5.8'
      steward: # docker.io/projectsyn/steward:v0.6.0@sha256:36468cfc3cdd3877e80b08a68426530a1bcd5a17fe03bfc301e63027ded30272'
        image: docker.io/projectsyn/steward
        tag: 'v0.6.0@sha256:36468cfc3cdd3877e80b08a68426530a1bcd5a17fe03bfc301e63027ded30272'
```

> :warning: Although the **Commodore Docker manager** is able to parse these formats, only the official best practice is supported.
> Support for any of the other formats might be dropped without prior notice.
