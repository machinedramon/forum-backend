FROM node:20.15.1

WORKDIR /usr/src/app

# Copia package.json e instala as dependências
COPY package.json ./
RUN npm install

# Copia todos os arquivos do projeto
COPY . .

EXPOSE 9900

CMD ["node", "index.js"]
