FROM node:20.15.1

WORKDIR /usr/src/app

# Copia o package.json
COPY package.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos
COPY . .

EXPOSE 9900

CMD ["node", "index.js"]
