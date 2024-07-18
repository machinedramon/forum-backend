const express = require("express");
const cors = require("cors");
const generateQuery = require("./utils/generateQuery");
const executeSearch = require("./utils/executeSearch");
const extractSearchTerms = require("./utils/extractSearchTerms");
const winston = require("winston");
require("winston-logstash");
const LokiTransport = require("winston-loki");
const promBundle = require("express-prom-bundle");
const { Histogram } = require("prom-client");

const app = express();
const port = 9900;

// Configuração do Winston para Logstash e Loki
const logger = winston.createLogger({
  transports: [
    new winston.transports.Logstash({
      port: 5044,
      node_name: "api",
      host: process.env.LOGSTASH_HOST || "localhost",
    }),
    new LokiTransport({
      host: "http://loki:3100",
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

// Outros endpoints...

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  logger.info(`Server started on port ${port}`);
});
