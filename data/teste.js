const axios = require("axios");
const fs = require("fs");

const url = "http://localhost:9200/livros/_search";
const payload = {
  query: {
    match: {
      text_2: "Manual das Áreas de Preservação Permanente",
    },
  },
};

axios
  .post(url, payload)
  .then((response) => {
    fs.writeFileSync("res.json", JSON.stringify(response.data, null, 2));
    console.log("Resposta salva em res.json");
  })
  .catch((error) => {
    console.error("Erro na requisição:", error);
  });
