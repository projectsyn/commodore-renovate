#!/bin/bash

readonly venv_path=${1:-"${HOME}/.cache/commodore-renovate-venv"}

echo "Setting up NodeJS and pip environments..."

echo '└ Running `yarn install`...'
yarn install

echo '└ Setting up Python virtualenv'
python3 -m venv "${venv_path}"

echo '└ Installing Python dependencies in virtualenv'
(
  source "${venv_path}/bin/activate"
  # Install wheel first, so reclass can be installed from git
  pip install -r requirements.txt
)

echo 'Done!'
echo
echo "Activate the virtualenv with \`source "${venv_path}/bin/activate"\` before running \`yarn dev\` to run Renovate locally"
