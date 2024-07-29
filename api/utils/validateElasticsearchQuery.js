const Ajv = require("ajv");

const ajv = new Ajv();

const querySchema = {
  type: "object",
  properties: {
    query: {
      type: "object",
      properties: {
        bool: {
          type: "object",
          properties: {
            must: { type: "array" },
            should: { type: "array" },
            filter: { type: "array" },
            minimum_should_match: { type: "integer" }, // Adicionado para suportar minimum_should_match
          },
          additionalProperties: false,
        },
        match: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        match_phrase: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        multi_match: {
          type: "object",
          properties: {
            query: { type: "string" },
            fields: { type: "array", items: { type: "string" } },
            type: { type: "string" },
            fuzziness: { type: "string" },
          },
          required: ["query", "fields"],
          additionalProperties: false,
        },
        range: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              gte: { type: "string" },
              lte: { type: "string" },
              format: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  required: ["query"],
  additionalProperties: false,
};

const validateElasticsearchQuery = (query) => {
  const validate = ajv.compile(querySchema);
  const valid = validate(query);
  if (!valid) {
    console.error("❌ Query inválida:", validate.errors);
  }
  return valid;
};

module.exports = validateElasticsearchQuery;
