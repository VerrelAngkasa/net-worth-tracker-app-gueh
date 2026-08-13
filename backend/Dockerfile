FROM node:22-alpine

COPY --from=public.ecr.aws/awsgsl/aws-lambda-web-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]