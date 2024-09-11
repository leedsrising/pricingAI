FROM --platform=linux/amd64 ghcr.io/puppeteer/puppeteer:latest

# Set working directory to the home directory of pptruser
WORKDIR /home/pptruser

# Switch to pptruser
USER pptruser

# Copy package.json and package-lock.json (if available)
COPY --chown=pptruser:pptruser package*.json ./

# Install dependencies
RUN npm install --verbose

# Copy the rest of your app's source code
COPY --chown=pptruser:pptruser . .

# Build your app
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]