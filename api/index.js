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
  process.env.ELASTICSEARCH_HOST || "http://elasticsearch:9200";

// Configuração do cliente Elasticsearch
const esClient = new Client({ node: elasticsearchHost });

// Configuração do Winston para Logstash e Loki
const logger = winston.createLogger({
  transports: [
    new LogstashTransport({
      port: logstashPort,
      node_name: "api",
      host: logstashHost,
      max_message_size: 8192, // Limita o tamanho das mensagens de log para 8KB
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

// Middleware para registrar logs das entradas de consulta do usuário
app.use((req, res, next) => {
  if (req.method === "POST" && req.url === "/smartsearch") {
    logger.info("User search query received", { query: req.body.query });
  }
  next();
});

// Endpoint padrão para verificar se a API está rodando
app.get("/", (req, res) => {
  res.send("Fórum API está rodando 🤝🏼");
});

// Endpoint para busca inteligente
app.post("/smartsearch", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "A consulta não pode ser vazia." });
  }

  try {
    console.log("Recebendo consulta do usuário:", query);

    const startOpenAI = Date.now();
    const elasticsearchQuery = await generateQuery(query);
    const durationOpenAI = Date.now() - startOpenAI;
    openAIHistogram.labels("200").observe(durationOpenAI / 1000);

    const searchTerms = extractSearchTerms(elasticsearchQuery);
    console.log("Termos de busca extraídos:", searchTerms);

    const startElastic = Date.now();
    const esResponse = await executeSearch(elasticsearchQuery);
    const durationElastic = Date.now() - startElastic;
    elasticHistogram.labels("200").observe(durationElastic / 1000);

    if (esResponse.hits.total.value === 0) {
      console.log("Nenhum resultado encontrado.");
      return res.status(404).json({ message: "Nenhum resultado encontrado." });
    }

    console.log(`Resultados encontrados: ${esResponse.hits.total.value}`);
    res.json({ ...esResponse, searchTerms });
  } catch (error) {
    console.error("Erro durante a busca:", error);
    res
      .status(500)
      .json({
        error:
          "Erro durante a busca: " + (error.message || "Erro desconhecido"),
      });
  }
});

// Endpoint para visualizar os dados indexados
app.get("/books", async (req, res) => {
  const size = req.query.size ? parseInt(req.query.size) : 2;
  const verbose = req.query.verbose === "true";

  try {
    const esResponse = await esClient.search({
      index: "content",
      body: {
        query: { match: { type: "book" } },
        size: size,
        _source: verbose
          ? true
          : { excludes: ["editions.chapters.ocr", "editions.chapters.pdf"] },
      },
    });

    console.log(
      "Elasticsearch Response: ",
      JSON.stringify(esResponse, null, 2)
    );
    if (!esResponse)
      throw new Error("No response body or hits from Elasticsearch");

    res.json(esResponse);
  } catch (error) {
    console.error("❌ Erro durante a busca:", error.message);
    res.status(500).send(`Erro durante a busca: ${error.message}`);
  }
});

// Endpoint para visualizar os dados de um livro específico pelo ID
app.get("/books/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const esResponse = await esClient.get({ index: "content", id });

    console.log(
      "Elasticsearch Response: ",
      JSON.stringify(esResponse, null, 2)
    );
    if (!esResponse)
      throw new Error("No response body or hits from Elasticsearch");

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
