
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json /app/
COPY src/index.ts /app/
COPY prisma /app/prisma

RUN npm install

RUN npx prisma generate

EXPOSE 3005

CMD ["npm", "run", "start-docker"]