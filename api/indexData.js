const express = require("express");
const { Client } = require("@elastic/elasticsearch");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 9900;

// Configuração do cliente Elasticsearch
const esClient = new Client({ node: "http://localhost:9200" });

// Carregar dados do arquivo JSON
const booksData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "livros.json"), "utf8")
);

// Função para criar o índice e indexar os dados
const indexData = async () => {
  // Verifica se o índice já existe e, se existir, o exclui
  const indexName = "livros";
  const indexExists = await esClient.indices.exists({ index: indexName });

  if (indexExists.body) {
    console.log("🔄 Índice já existe. Excluindo...");
    await esClient.indices.delete({ index: indexName });
  }

  // Cria o índice
  console.log("🛠️ Criando o índice...");
  await esClient.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          id: { type: "keyword" },
          title: { type: "text" },
          author: { type: "text" },
          publish_date: { type: "date" },
          text_1: { type: "text" },
          text_2: { type: "text" },
          text_3: { type: "text" },
          text_4: { type: "text" },
          text_5: { type: "text" },
          tags: {
            type: "nested",
            properties: { id: { type: "keyword" }, title: { type: "text" } },
          },
          filters: {
            type: "nested",
            properties: { id: { type: "keyword" }, title: { type: "text" } },
          },
          editions: {
            type: "nested",
            properties: {
              book_num_id: { type: "keyword" },
              is_actual: { type: "boolean" },
              isbn: { type: "text" },
              subtitle: { type: "text" },
              num_id: { type: "keyword" },
              pages: { type: "integer" },
              number: { type: "integer" },
              is_published: { type: "boolean" },
              publish_date: { type: "date" },
              description: { type: "text" },
              title: { type: "text" },
              authors: {
                type: "nested",
                properties: {
                  title: { type: "text" },
                  id: { type: "keyword" },
                },
              },
              chapters: {
                type: "nested",
                properties: {
                  chapter_type: { type: "text" },
                  num_id: { type: "keyword" },
                  order: { type: "integer" },
                  id: { type: "keyword" },
                  language: { type: "text" },
                  type: { type: "text" },
                  title: { type: "text" },
                  pdf: { type: "text" },
                  ocr: { type: "text" },
                },
              },
            },
          },
        },
      },
    },
  });

  // Função auxiliar para pausar por um tempo especificado
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Função para indexar dados em blocos
  const bulkInsert = async (data) => {
    const body = data.flatMap((doc) => [
      { index: { _index: indexName, _id: doc.id } },
      doc,
    ]);
    try {
      await esClient.bulk({ refresh: true, body });
    } catch (error) {
      console.error("❌ Erro durante a indexação em bloco:", error);
    }
  };

  // Indexar os dados em blocos menores
  const chunkSize = 10; // Tamanho do bloco reduzido
  for (let i = 0; i < booksData.length; i += chunkSize) {
    const chunk = booksData.slice(i, i + chunkSize);
    console.log(`📥 Indexando bloco ${i / chunkSize + 1}...`);
    await bulkInsert(chunk);
    await sleep(5000); // Pausa de 5 segundos entre os blocos
  }

  console.log("✅ Todos os dados foram indexados com sucesso.");
};

// Inicializa a indexação dos dados ao iniciar o servidor
indexData()
  .then(() => {
    console.log("🚀 Iniciando o servidor...");
    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("❌ Erro durante a indexação:", error);
  });

// Endpoint para visualizar os dados indexados
app.get("/livros", async (req, res) => {
  const { body } = await esClient.search({
    index: "livros",
    body: {
      query: {
        match_all: {},
      },
    },
  });
  res.send(body.hits.hits);
});
