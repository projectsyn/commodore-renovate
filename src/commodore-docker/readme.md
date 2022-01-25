# Commodore Docker manager

Extracts all container image dependencies of a Commodore component.

By default, the manager only searches in `class/defaults.yml` for entries in `parameters.components.*.images`.
The manager is guaranteed to find image dependencies that adhere to the [best practices for container image dependencies](https://syn.tools/syn/explanations/commodore-components/container-images.html).
It will attempt to parse other common dependency structures, but might not be able to parse them correctly.
