FROM node:20.15.1

WORKDIR /usr/src/app

# Copia package.json e yarn.lock e instala as dependências
COPY package.json yarn.lock ./
RUN yarn install

# Copia todos os arquivos do projeto
COPY . .

# Verifique se os arquivos foram copiados corretamente
RUN ls -la

EXPOSE 9900

CMD ["node", "index.js"]
