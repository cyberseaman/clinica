FROM node:22-alpine

WORKDIR /app

COPY services/employee/package.json ./package.json
RUN npm install --omit=dev

COPY shared ./shared
COPY services/employee ./services/employee

WORKDIR /app/services/employee
EXPOSE 3001

CMD ["npm", "start"]
