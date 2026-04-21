FROM node:22-alpine

WORKDIR /app

COPY services/auth/package.json ./package.json
RUN npm install --omit=dev

COPY shared ./shared
COPY scripts ./scripts
COPY services/auth ./services/auth

WORKDIR /app/services/auth
EXPOSE 3000

CMD ["npm", "start"]
