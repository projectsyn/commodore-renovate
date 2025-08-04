# Commodore Helm manager

This manager extracts Helm chart dependencies of a Commodore component.

By default, the manager processes all the files in `class/` in a single operation.
This behavior shouldn't be changed, since the Helm dependency discovery needs to be able to parse data from both `class/defaults.yml` and `class/<component-name>.yml`.

The manager is guaranteed to find Helm chart references which adhere to the [best practices for Helm chart dependencies](https://syn.tools/syn/explanations/commodore-components/helm-charts.html).

The manager doesn't support dependencies which don't have the chart versions specified in `parameters.<component-name>.charts`.
Please be aware that the manager doesn't support Helm chart dependencies which are fetched using Kapitan's generic HTTPS dependency type.

Since 0.21.0, the manager also supports renovating OCI Helm chart dependencies.
For OCI Helm chart dependencies, the manager assumes that `source` (in either format) is the OCI URL of the chart.

Finally, the manager also supports the old recommended format for Helm chart dependencies, where only the chart version is given in component parameter `charts`, and the source is only present in `parameters.kapitan.dependencies`.

The old format roughly has the following structure:

In `class/defaults.yml`:

```yaml
parameters:
  the_component:
    charts:
      my-chart: v1.2.3
```

In `class/the-component.yml`:

```yaml
parameters:
  kapitan:
    dependencies:
      - type: helm
        source: https://charts.appuio.ch/
        chart_name: my-chart
        version: ${the_component:charts:my-chart}
        output_path: path/to/save/chart
```

In general, the manager will be able to renovate old standard Helm chart references which don't use the exact name of the Helm chart as the field name for the chart version in `parameters.<component-name>.charts`.

> :warning: Support for the old default format may be dropped without prior notice.
> The Commodore Helm manager offers support for the old format only to allow gradual transition to the new best practice format.
