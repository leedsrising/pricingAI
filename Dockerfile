FROM ghcr.io/puppeteer/puppeteer:latest

# Create app directory and set permissions
USER root
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

# Set working directory
WORKDIR /home/node/app

# Switch to non-root user
USER node

# Copy package.json and package-lock.json
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY --chown=node:node . .

# Build your app
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]