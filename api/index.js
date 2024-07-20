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
const port = 9900;

require("dotenv").config();

const logstashHost = process.env.LOGSTASH_HOST || "logstash";
const logstashPort = process.env.LOGSTASH_PORT || 5044;
const lokiHost = process.env.LOKI_HOST || "loki";
const lokiPort = process.env.LOKI_PORT || 3100;
const elasticsearchHost =
  process.env.ELASTICSEARCH_HOST || "http://52.0.192.118:9200";

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
app.get("/books", async (req, res) => {
  const size = req.query.size ? parseInt(req.query.size) : 50; // Padrão para 50 resultados
  try {
    const esResponse = await esClient.search({
      index: "content",
      body: {
        query: {
          match: { type: "book" },
        },
        size: size,
      },
    });

    if (!esResponse) {
      throw new Error("No response from Elasticsearch");
    }
    if (!esResponse.body) {
      throw new Error("No response body from Elasticsearch");
    }
    if (!esResponse.body.hits) {
      throw new Error("No hits in response body from Elasticsearch");
    }
    if (!esResponse.body.hits.hits) {
      throw new Error("No hits.hits in response body from Elasticsearch");
    }

    res.send(esResponse.body.hits.hits);
  } catch (error) {
    console.error("❌ Erro durante a busca:", error.message);
    res.status(500).send(`Erro durante a busca: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  logger.info(`Server started on port ${port}`);
});
