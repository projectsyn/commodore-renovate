FROM ghcr.io/containerbase/base:13.8.61@sha256:1a2ea1bf6557bf9d988d2830e9b85c1e74b38f330e15731e4920da7c0854debd AS base

LABEL name="commodore-renovate"
LABEL org.opencontainers.image.source="https://github.com/projectsyn/commodore-renovate" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# renovate: datasource=node-version
RUN install-tool node v20.19.4

WORKDIR /usr/src/app



FROM base AS tsbuild

# renovate: datasource=npm versioning=npm
RUN install-tool yarn 1.22.22

COPY package.json yarn.lock ./
RUN yarn install --production

COPY src/ src/
COPY tsconfig.json tsconfig-build.json ./
RUN yarn build

FROM base AS final

ENV NODE_ENV=production

COPY --from=tsbuild /usr/src/app/bin bin
COPY --from=tsbuild /usr/src/app/node_modules node_modules

# renovate: datasource=github-releases packageName=containerbase/python-prebuild depname=python
ARG PYTHON_VERSION=3.12.11
RUN install-tool python ${PYTHON_VERSION}
RUN install-apt build-essential libffi-dev libmagic1
COPY requirements.txt .
RUN pip install  -r requirements.txt
# Containerbase v11 doesn't put /opt/containerbase/tools/python/<VERSION>/bin
# into the path anymore, so we do it ourselves by appending it to
# /usr/local/etc/env which is sourced by the containerbase entrypoint script.
RUN echo "export PATH=/opt/containerbase/tools/python/${PYTHON_VERSION}/bin:\${PATH}" >> /usr/local/etc/env

# renovate: datasource=github-releases packageName=kubernetes-sigs/kustomize depname=kustomize tagPrefix=kustomize/v
ARG KUSTOMIZE_VERSION=5.7.1
# renovate: datasource=github-releases packageName=projectsyn/jsonnet-bundler depname=jsonnet-bundler
ARG JSONNET_BUNDLER_VERSION=v0.6.3
# renovate: datasource=github-releases packageName=helm/helm depname=helm
ARG HELM_VERSION=v3.18.4

# Install Commodore binary dependencies
RUN HOME="${USER_HOME}" commodore tool install helm --version ${HELM_VERSION} \
 && HOME="${USER_HOME}" commodore tool install kustomize --version ${KUSTOMIZE_VERSION} \
 && HOME="${USER_HOME}" commodore tool install jb --version ${JSONNET_BUNDLER_VERSION} \
 && ln -s \
    "${USER_HOME}/.cache/commodore/tools/helm" \
    "${USER_HOME}/.cache/commodore/tools/jb" \
    "${USER_HOME}/.cache/commodore/tools/kustomize" \
    "/usr/local/bin"

RUN set -ex; \
  chmod +x /usr/src/app/bin/index.js; \
  ln -sf /usr/src/app/bin/index.js /usr/local/bin/renovate;
CMD ["renovate"]

USER 12021
