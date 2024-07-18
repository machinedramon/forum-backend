FROM node:20.15.1

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

EXPOSE 9900

CMD ["node", "index.js"]
