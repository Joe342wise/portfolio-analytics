FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including dev dependencies like TypeScript)
RUN pnpm install --frozen-lockfile

COPY . .

# Build the TypeScript project
RUN pnpm run build

CMD ["pnpm", "start"]
