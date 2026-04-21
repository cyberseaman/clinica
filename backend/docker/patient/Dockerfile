FROM node:22-alpine

WORKDIR /app

COPY services/patient/package.json ./package.json
RUN npm install --omit=dev

COPY shared ./shared
COPY services/patient ./services/patient

WORKDIR /app/services/patient
EXPOSE 3002

CMD ["npm", "start"]
