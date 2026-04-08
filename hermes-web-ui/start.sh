#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH=$(realpath ~/hermes-agent)
export HERMES_WEB_PORT=${HERMES_WEB_PORT:-8080}
npm run start
