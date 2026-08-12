# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.19.0
ARG AGENT_BASE_IMAGE=local-agentic-dev/codex-agent:dev

# Use the official Node image as the source of the Node/npm runtime.
FROM node:${NODE_VERSION}-trixie AS node-runtime

# Preserve the Codex agent, security policy, utilities, and vscode user
# supplied by the portable agent infrastructure.
FROM ${AGENT_BASE_IMAGE}

USER root

# The official Node image installs Node and its bundled tooling under
# /usr/local. Merge that runtime into the existing Codex agent image.
COPY --from=node-runtime /usr/local/ /usr/local/

RUN node --version \
    && npm --version

USER vscode

WORKDIR /workspaces