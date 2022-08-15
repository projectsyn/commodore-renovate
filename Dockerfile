FROM renovate/buildpack:6@sha256:3b4b7d0a920867cf2ec495632b159a3f7e10af1f7c454b0a076ad385edc2331d AS base

LABEL name="commodore-renovate"
LABEL org.opencontainers.image.source="https://github.com/projectsyn/commodore-renovate" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# renovate: datasource=node
RUN install-tool node v16.16.0

WORKDIR /usr/src/app



FROM base as tsbuild

# renovate: datasource=npm versioning=npm
RUN install-tool yarn 1.22.18

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
RUN install-tool python 3.10.4
RUN install-apt build-essential libffi-dev
COPY requirements.txt .
RUN pip install  -r requirements.txt

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
 && curl -fsSLo /usr/local/bin/jb https://github.com/jsonnet-bundler/jsonnet-bundler/releases/download/v0.4.0/jb-linux-amd64 \
 && chmod +x /usr/local/bin/jb

RUN set -ex; \
  chmod +x /usr/src/app/bin/index.js; \
  ln -sf /usr/src/app/bin/index.js /usr/local/bin/renovate;
CMD ["renovate"]

USER 1000
