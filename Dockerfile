FROM ghcr.io/containerbase/base:11.11.0@sha256:ca03a334e8e3959e72e63f9a5860f98c564955be52ce66be764ebe81d4127fc2 AS base

LABEL name="commodore-renovate"
LABEL org.opencontainers.image.source="https://github.com/projectsyn/commodore-renovate" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# renovate: datasource=node-version
RUN install-tool node v20.16.0

WORKDIR /usr/src/app



FROM base as tsbuild

# renovate: datasource=npm versioning=npm
RUN install-tool yarn 1.22.22

COPY package.json yarn.lock ./
RUN yarn install --production

COPY src/ src/
COPY tsconfig.json tsconfig-build.json ./
RUN yarn build



FROM base as final

ENV NODE_ENV production

COPY --from=tsbuild /usr/src/app/bin bin
COPY --from=tsbuild /usr/src/app/node_modules node_modules

# renovate: datasource=github-releases lookupName=containerbase/python-prebuild
RUN install-tool python 3.11.5
# Create a symlink from /opt/buildpack/tools/python to /usr/local/python
# because otherwise the python packages which need to build C extensions can't
# find Python.h
RUN ln -s /opt/buildpack/tools/python /usr/local/python
RUN install-apt build-essential libffi-dev libmagic1
COPY requirements.txt .
RUN pip install  -r requirements.txt

# renovate: datasource=github-releases lookupName=kubernetes-sigs/kustomize
ARG KUSTOMIZE_VERSION=4.5.7
# renovate: datasource=github-releases lookupName=projectsyn/jsonnet-bundler
ARG JSONNET_BUNDLER_VERSION=v0.6.2

# Install Commodore binary dependencies
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 \
 && chmod 700 get_helm.sh \
 && ./get_helm.sh \
 && mv /usr/local/bin/helm /usr/local/bin/helm3 \
 && curl -LO https://git.io/get_helm.sh \
 && chmod 700 get_helm.sh \
 && ./get_helm.sh \
 && mv /usr/local/bin/helm /usr/local/bin/helm2 \
 && rm ./get_helm.sh \
 && ln -s /usr/local/bin/helm3 /usr/local/bin/helm \
 && curl -fsSLo /usr/local/bin/jb https://github.com/projectsyn/jsonnet-bundler/releases/download/${JSONNET_BUNDLER_VERSION}/jb_linux_amd64 \
 && chmod +x /usr/local/bin/jb \
 && curl -fsSLO "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" \
 && chmod +x install_kustomize.sh \
 && ./install_kustomize.sh ${KUSTOMIZE_VERSION} /usr/local/bin \
 && rm ./install_kustomize.sh

RUN set -ex; \
  chmod +x /usr/src/app/bin/index.js; \
  ln -sf /usr/src/app/bin/index.js /usr/local/bin/renovate;
CMD ["renovate"]

USER 1000
