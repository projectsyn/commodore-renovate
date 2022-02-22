# Commodore Helm manager

This manager extracts Helm chart dependencies of a Commodore component.

By default, the manager processes all the files in `class/` in a single operation.
This behavior shouldn't be changed, since the Helm dependency discovery needs to be able to parse data from both `class/defaults.yml` and `class/<component-name>.yml`.

The manager is guaranteed to find Helm chart references which adhere to the [best practices for Helm chart dependencies](https://syn.tools/syn/explanations/commodore-components/helm-charts.html).

In general, the manager will be able to renovate Helm chart references which don't use the exact name of the Helm chart as the field name for the chart version in `parameters.<component-name>.charts`.

The manager doesn't support dependencies which don't have the chart versions specified in `parameters.<component-name>.charts`.
Additionally, the manager doesn't support Helm chart dependencies which are fetched using Kapitan's generic HTTPS dependency type.
