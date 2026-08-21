FROM node:22-alpine

WORKDIR /var/task

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

ENV AWS_LWA_READINESS_CHECK_PATH="/api/health"

CMD ["npm", "start"]