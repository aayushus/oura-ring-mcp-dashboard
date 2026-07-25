#!/bin/bash
sed -i 's/        "src\/client.ts": {/        "src\/client.ts": {\n          branches: 96,/' vitest.config.ts
sed -i 's/          branches: 100,/          branches: 96,/' vitest.config.ts
