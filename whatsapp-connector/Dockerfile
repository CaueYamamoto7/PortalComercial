FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
RUN mkdir /app/data && chown -R node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3100 DATA_DIR=/app/data
VOLUME /app/data
EXPOSE 3100
CMD ["node", "src/server.mjs"]
