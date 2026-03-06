#!/usr/bin/env bash

set -eu

ORDER_TABLE_NAME=$(pulumi stack output tableName --cwd infrastructure) \
    pnpm --filter simulations run $1
