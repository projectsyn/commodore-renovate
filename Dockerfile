FROM ghcr.io/containerbase/base:12.0.5@sha256:ddd545613fa21e5fb43d4a8475d4b5d8cdf70aac65876d3c0237e73f0fceb84d AS base

LABEL name="commodore-renovate"
LABEL org.opencontainers.image.source="https://github.com/projectsyn/commodore-renovate" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# renovate: datasource=node-version
RUN install-tool node v20.18.0

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
ARG PYTHON_VERSION=3.13.1
RUN install-tool python ${PYTHON_VERSION}
RUN install-apt build-essential libffi-dev libmagic1
COPY requirements.txt .
RUN pip install  -r requirements.txt
# Containerbase v11 doesn't put /opt/containerbase/tools/python/<VERSION>/bin
# into the path anymore, so we do it ourselves by appending it to
# /usr/local/etc/env which is sourced by the containerbase entrypoint script.
RUN echo "export PATH=/opt/containerbase/tools/python/${PYTHON_VERSION}/bin:\${PATH}" >> /usr/local/etc/env

# renovate: datasource=github-releases packageName=kubernetes-sigs/kustomize depname=kustomize tagPrefix=kustomize/v
ARG KUSTOMIZE_VERSION=5.5.0
# renovate: datasource=github-releases packageName=projectsyn/jsonnet-bundler depname=jsonnet-bundler
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
 && ./install_kustomize.sh ${KUSTOMIZE_VERSION} /opt/containerbase/bin \
 && rm ./install_kustomize.sh \
 && curl -L https://raw.githubusercontent.com/projectsyn/reclass-rs/main/hack/kapitan_0.32_reclass_rs.patch \
 | patch -p1 -d "$(python -c 'import kapitan; print(kapitan.__path__[0])')"

RUN set -ex; \
  chmod +x /usr/src/app/bin/index.js; \
  ln -sf /usr/src/app/bin/index.js /usr/local/bin/renovate;
CMD ["renovate"]

USER 1000
