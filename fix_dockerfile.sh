sed -i 's/RUN pnpm install --frozen-lockfile/RUN pnpm install --frozen-lockfile --ignore-workspace/g' Dockerfile
sed -i 's/RUN pnpm install --prod --frozen-lockfile/RUN pnpm install --prod --frozen-lockfile --ignore-workspace/g' Dockerfile
