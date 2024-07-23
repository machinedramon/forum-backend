const express = require("express");
const cors = require("cors");
const generateQuery = require("./utils/generateQuery");
const executeSearch = require("./utils/executeSearch");
const extractSearchTerms = require("./utils/extractSearchTerms");
const winston = require("winston");
const { LogstashTransport } = require("winston-logstash-transport");
const LokiTransport = require("winston-loki");
const promBundle = require("express-prom-bundle");
const { Histogram } = require("prom-client");
const { Client } = require("@elastic/elasticsearch");

const app = express();
const port = 9910; // Porta alterada para 9910

require("dotenv").config();

const logstashHost = process.env.LOGSTASH_HOST || "logstash";
const logstashPort = process.env.LOGSTASH_PORT || 5044;
const lokiHost = process.env.LOKI_HOST || "loki";
const lokiPort = process.env.LOKI_PORT || 3100;
const elasticsearchHost =
  process.env.ELASTICSEARCH_HOST || "http://elasticsearch:9200"; // Note que elasticsearch é o nome do serviço no docker-compose

// Configuração do cliente Elasticsearch
const esClient = new Client({ node: elasticsearchHost });

// Configuração do Winston para Logstash e Loki
const logger = winston.createLogger({
  transports: [
    new LogstashTransport({
      port: logstashPort,
      node_name: "api",
      host: logstashHost,
    }),
    new LokiTransport({
      host: `http://${lokiHost}:${lokiPort}`,
      labels: { job: "api" },
    }),
  ],
});

// Configuração do Prometheus
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeUp: true,
  customLabels: { project_name: "api", project_type: "backend" },
  promClient: {
    collectDefaultMetrics: {},
  },
});

app.use(metricsMiddleware);
app.use(cors());
app.use(express.json());

const openAIHistogram = new Histogram({
  name: "openai_request_duration_seconds",
  help: "Duration of OpenAI requests in seconds",
  labelNames: ["status_code"],
});

const elasticHistogram = new Histogram({
  name: "elastic_request_duration_seconds",
  help: "Duration of Elasticsearch requests in seconds",
  labelNames: ["status_code"],
});

app.use((req, res, next) => {
  logger.info("Request received", {
    method: req.method,
    url: req.url,
    body: req.body,
  });
  next();
});

// Endpoint padrão para verificar se a API está rodando
app.get("/", (req, res) => {
  res.send("Fórum API está rodando 🤝🏼");
});

// Endpoint para busca inteligente
// Exemplo de URL de teste: http://localhost:9910/smartsearch
app.post("/smartsearch", async (req, res) => {
  const { query } = req.body;

  try {
    console.log("🔍 Recebendo consulta do usuário:", query);
    logger.info("Smart search query received", { query });

    const startOpenAI = Date.now();
    const elasticsearchQuery = await generateQuery(query);
    const durationOpenAI = Date.now() - startOpenAI;
    openAIHistogram.labels("200").observe(durationOpenAI / 1000);
    logger.info("OpenAI response", { query, response: elasticsearchQuery });

    const searchTerms = extractSearchTerms(elasticsearchQuery);

    const startElastic = Date.now();
    const esResponse = await executeSearch(elasticsearchQuery);
    const durationElastic = Date.now() - startElastic;
    elasticHistogram.labels("200").observe(durationElastic / 1000);
    logger.info("Elasticsearch response", { query, response: esResponse });

    if (esResponse.hits.total.value === 0) {
      console.log("🔎 Nenhum resultado encontrado.");
      logger.info("No results found", { query });
      res.status(404).json({ message: "Nenhum resultado encontrado." });
    } else {
      console.log(`🔎 Resultados encontrados: ${esResponse.hits.total.value}`);
      logger.info("Results found", {
        query,
        total: esResponse.hits.total.value,
      });
      console.log("🔍 Termos de busca extraídos:", searchTerms);
      res.json({ ...esResponse, searchTerms });
    }
  } catch (error) {
    console.error("❌ Erro durante a busca:", error);
    logger.error("Error during search", { error: error.message || error });
    res.status(500).json({ error: error.message || "Erro durante a busca" });
  }
});

// Endpoint para visualizar os dados indexados
// Exemplo de URL de teste: http://localhost:9910/books?size=2&verbose=false
app.post("/books", async (req, res) => {
  const size = req.query.size ? parseInt(req.query.size) : 2;
  const verbose = req.query.verbose === "true"; // Checa se o verbose é true

  try {
    const esResponse = await esClient.search({
      index: "content",
      body: {
        query: {
          match: { type: "book" },
        },
        size: size,
        _source: verbose
          ? true
          : { excludes: ["editions.chapters.ocr", "editions.chapters.pdf"] }, // Exclui os campos OCR e PDF se verbose for false
      },
    });

    console.log(
      "Elasticsearch Response: ",
      JSON.stringify(esResponse, null, 2)
    );

    if (!esResponse) {
      throw new Error("No response body or hits from Elasticsearch");
    }

    res.json(esResponse);
  } catch (error) {
    console.error("❌ Erro durante a busca:", error.message);
    res.status(500).send(`Erro durante a busca: ${error.message}`);
  }
});

// Endpoint para visualizar os dados de um livro específico pelo ID
// Exemplo de URL de teste: http://localhost:9910/books/L5712-E5971
app.post("/books/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const esResponse = await esClient.get({
      index: "content",
      id: id,
    });

    console.log(
      "Elasticsearch Response: ",
      JSON.stringify(esResponse, null, 2)
    );

    if (!esResponse) {
      throw new Error("No response body or hits from Elasticsearch");
    }

    res.json(esResponse);
  } catch (error) {
    console.error("❌ Erro durante a busca:", error.message);
    res.status(500).send(`Erro durante a busca: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  logger.info(`Server started on port ${port}`);
});
