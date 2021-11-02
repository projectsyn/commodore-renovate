# Commodore Renovate Support

This repository builds [renovate](https://github.com/renovatebot/renovate/) with added support for [Commodore](https://github.com/projectsyn/commodore).
It does this by depending on renovate and patching in an additional manager for Commodore.

## Development

### Prerequisites

You need the following dependencies for local development:

- Git `>=2.33.0`
- Node.js `>=14.15.4`
- Yarn `^1.22.5`
- C++ compiler
- Python `^3.9`

### Run

To run the extended renovate against a real repository, you first need to configure it.
Renovate can be configured through command-line flags, environment variables, or through a `config.js` at the root of the repository.

We provide an example configuration to renovate a single repository on a private Gitlab instance in `config.example.js`.
You can copy and update this example configuration.
You will always need a valid platform token.

There is a list of configuration options as part of the [official renovate docs](https://docs.renovatebot.com/self-hosted-configuration/#repositories).

With a valid configuration you can now run the extended renovate with:

```
yarn dev
```

### Tests

You can run `yarn test` locally to test your code.
We test all PRs using the same tests, run on GitHub Actions.

### Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) to format our code.
If your code fails `yarn lint` due to a `prettier` rule then run `yarn prettier-fix` to fix it.
You usually don't need to fix any Prettier errors by hand.
