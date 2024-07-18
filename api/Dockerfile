FROM node:20.15.1

WORKDIR /usr/src/app

# Copia package.json e package-lock.json (se existir)
COPY package.json package-lock.json ./

# Instala dependências
RUN npm install

COPY . .

EXPOSE 9900

CMD ["node", "index.js"]
