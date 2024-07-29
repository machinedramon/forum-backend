const axios = require("axios");

async function executeSearch(query) {
  const url = "http://52.0.192.118:9200/content/_search";
  console.log("🔍 Enviando consulta para o Elasticsearch...");

  query.highlight = {
    fields: {
      text_2: {},
      text_3: {},
      text_4: {},
      text_5: {},
      "tags.title": {},
      "editions.title": {},
      "editions.subtitle": {},
      "editions.description": {},
      "editions.authors.title": {},
      "editions.chapters.title": {},
      "editions.chapters.ocr": {},
    },
    pre_tags: ["<em>"],
    post_tags: ["</em>"],
    max_analyzed_offset: 1000000,
  };

  try {
    const response = await axios.post(url, query, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("🔙 Resposta do Elasticsearch recebida com sucesso.");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Erro durante a busca no Elasticsearch:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    throw error.response ? error.response.data : error.message;
  }
}

module.exports = executeSearch;
