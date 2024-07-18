FROM node:20.15.1

WORKDIR /usr/src/app

# Instala o Yarn globalmente
RUN npm install -g yarn

# Copia package.json e instala as dependências
COPY package.json ./
RUN yarn install

# Copia todos os arquivos do projeto
COPY . .

EXPOSE 9900

CMD ["node", "index.js"]
