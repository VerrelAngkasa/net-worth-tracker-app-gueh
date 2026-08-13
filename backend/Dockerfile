FROM node:22-alpine

WORKDIR /var/task

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]