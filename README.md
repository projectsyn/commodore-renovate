# Commodore Renovate Support

This repository builds [renovate](https://github.com/renovatebot/renovate/) with added support for [Commodore](https://github.com/projectsyn/commodore).
It does this by depending on renovate and patching in an additional manager for Commodore.

## Development

### Prerequisites

You need the following dependencies for local development:

- Git `>=2.33.0`
- Node.js `>=18.15.0`
- Yarn `^1.22.5`
- C++ compiler
- Python `>=3.8`
- [Commodore](https://github.com/projectsyn/commodore) `>=0.12.0`

### Setup

Run the provided `setup.sh` script to setup the local Node.js and Python environment.
The script roughly performs the following steps

```
yarn install
python3 -m venv /path/to/venv
source /path/to/venv/bin/activate
pip install -r requirements.txt
deactivate
```

`/path/to/venv` is `~/.cache/commodore-renovate-venv` if `setup.sh` is called without any arguments.
You can supply a custom location for the virtualenv with `./setup.sh /path/to/custom/venv`.
It's best to not create the virtualenv in the project directory, because otherwise the Prettier linter will try to lint all JSON files in the virtualenv which takes forever.

You may not need to setup the Python virtualenv, if you have a sufficiently recent Commodore version available locally.

### Run

To run the extended renovate against a real repository, you first need to configure it.
Renovate can be configured through command-line flags, environment variables, or through a `config.js` at the root of the repository.

We provide an example configuration to renovate a single repository on a private Gitlab instance in `config.example.js`.
You can copy and update this example configuration.
You will always need a valid platform token.

There is a list of configuration options as part of the [official renovate docs](https://docs.renovatebot.com/self-hosted-configuration/#repositories).

With a valid configuration you can now run the extended renovate with:

```
source /path/to/venv/bin/activate
yarn dev
```

### Tests

You can run `yarn test` locally to test your code.
We test all PRs using the same tests, run on GitHub Actions.

### Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) to format our code.
If your code fails `yarn lint` due to a `prettier` rule then run `yarn prettier-fix` to fix it.
You usually don't need to fix any Prettier errors by hand.
