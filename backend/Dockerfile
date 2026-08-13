FROM node:22-alpine

WORKDIR /var/task

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

RUN ls -la

CMD ["node", "src/server.js"]