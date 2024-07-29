const OpenAI = require("openai");
const validateElasticsearchQuery = require("./validateElasticsearchQuery");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateQuery(userQuery) {
  console.log("🤖 Enviando consulta para a OpenAI...");

  const messages = [
    {
      role: "system",
      content: `
      Você é um assistente de busca para um sistema de gerenciamento de livros. Construa uma consulta Elasticsearch a partir da entrada do usuário. Utilize os seguintes campos disponíveis para a busca:
      - id: ID do livro (keyword)
      - publish_date: Data de publicação (date) - Usado para filtrar por intervalo de datas.
      - text_1: Continuação da descrição, geralmente mostra o nome dos capítulos (text).
      - text_2: Título do livro (text) - Usado para buscar por título principal do livro.
      - text_3: Descrição do livro (text) - Usado para buscar por descrição ou conteúdo geral do livro.
      - text_4: Cópia do título, igual a text_2 (text).
      - text_5: Subtítulo do livro (text).
      - tags: Tags associadas ao livro (nested), cada tag possui id (keyword) e title (text).
      - filters: Filtros associados ao livro (nested), cada filtro possui id (keyword) e title (text).
      - editions: Edições do livro (nested), cada edição possui:
        - book_num_id: ID numérico do livro (keyword)
        - is_actual: Se a edição é atual (boolean)
        - isbn: ISBN da edição (text)
        - subtitle: Subtítulo da edição (text)
        - num_id: ID numérico da edição (keyword)
        - pages: Número de páginas (integer)
        - number: Número da edição (integer)
        - is_published: Se a edição foi publicada (boolean)
        - publish_date: Data de publicação (date)
        - description: Descrição da edição (text)
        - title: Título da edição (text)
        - authors: Autores da edição (nested), cada autor possui title (text) e id (keyword). IMPORTANTE: use este campo para buscar nomes de autores, é um array de objetos podendo conter mais de um autor. Ao buscar por autor de qualquer maneira, use sempre match_phrase.
        - chapters: Capítulos da edição (nested), cada capítulo possui:
          - chapter_type: Tipo de capítulo (text)
          - num_id: ID numérico do capítulo (keyword)
          - order: Ordem do capítulo (integer)
          - id: ID do capítulo (keyword)
          - language: Idioma do capítulo (text)
          - type: Tipo de capítulo (text)
          - title: Título do capítulo (text)
          - pdf: URL do PDF do capítulo (text)
          - ocr: Texto extraído do OCR do capítulo (text) - Usado para buscar pelo conteúdo completo dos capítulos.

      Regras de busca:
      - Se o usuário se referir ao título, use \\text_2\\.
      - Se o usuário se referir à descrição, use \\text_3\\.
      - Se o usuário quer pesquisar no conteúdo, use \\text_3\\, \\tags\\ e \\editions.chapters.ocr\\.
      - Se o usuário quer pesquisar em todo o conteúdo, use \\text_3\\, \\text_2\\, \\text_5\\, \\text_1\\, \\tags\\, \\editions.chapters.ocr\\.

      Identificação de termos exatos:
      - Se o usuário usar aspas duplas ("") ou especificar explicitamente que é um termo exato, use \\match_phrase\\.
      - Se o usuário usar aspas simples ('') para um termo, a busca deve considerar tanto o termo exato (\\match_phrase\\) quanto os termos separados (\\match\\).

      Se a consulta do usuário for muito ampla ou vaga, ou se o usuário explicitamente pedir para "melhorar a busca", adicione automaticamente termos relacionados, variações, plurais e sinônimos. Por exemplo:
      - Para "candidato", adicione "candidatos", "candidata", "candidatas", "candidatar" e etc, sempre o máximo que conseguir de palavras similares deste tipo.
      - Para "direito eleitoral", adicione termos relacionados como "lei", "legislação" e etc.

      IMPORTANTE 1: Conforme o pedido do usuario, faça um auto balanceamento de boosts, mas cuidado pois [nested] query não suportam [_score]. \\text_2\\, \\tags\\ e \\editions.chapters.ocr\\ são geralmente os principais pesos quando buscamos em todo conteúdo.
      IMPORTANTE 2: Fuzziness não pode ser usado com tipo cross_fields. Só aplique fuzziness se não houver cross_fields.

      Construa a consulta JSON com base nas diretrizes acima, sem incluir texto adicional ou formatação.
      `,
    },
    {
      role: "user",
      content: `Crie uma consulta para: ${userQuery}`,
    },
  ];

  for (let attempts = 0; attempts < 3; attempts++) {
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
      });

      const responseText = gptResponse.choices[0].message.content.trim();
      const elasticsearchQuery = JSON.parse(responseText);

      console.log(
        `📄 Tentativa ${attempts + 1}: Consulta Elasticsearch gerada:`,
        JSON.stringify(elasticsearchQuery, null, 2)
      );

      if (
        elasticsearchQuery.query &&
        elasticsearchQuery.query.bool &&
        elasticsearchQuery.query.bool.should
      ) {
        const filteredQuery = {
          query: {
            bool: {
              must: [
                { match: { type: "book" } },
                ...elasticsearchQuery.query.bool.should,
              ],
            },
          },
        };

        console.log(
          "📄 Consulta Elasticsearch final: ",
          JSON.stringify(filteredQuery, null, 2)
        );

        const isValid = validateElasticsearchQuery(filteredQuery);
        if (isValid) {
          console.log(`✅ Tentativa ${attempts + 1}: Consulta válida`);
          return filteredQuery;
        } else {
          console.log(
            `❌ Tentativa ${attempts + 1}: Consulta inválida`,
            responseText
          );
        }
      } else if (
        elasticsearchQuery.query &&
        (elasticsearchQuery.query.multi_match ||
          elasticsearchQuery.query.match_phrase ||
          elasticsearchQuery.query.match)
      ) {
        const filteredQuery = {
          query: {
            bool: {
              must: [{ match: { type: "book" } }, elasticsearchQuery.query],
            },
          },
        };

        console.log(
          "📄 Consulta Elasticsearch final: ",
          JSON.stringify(filteredQuery, null, 2)
        );

        const isValid = validateElasticsearchQuery(filteredQuery);
        if (isValid) {
          console.log(`✅ Tentativa ${attempts + 1}: Consulta válida`);
          return filteredQuery;
        } else {
          console.log(
            `❌ Tentativa ${attempts + 1}: Consulta inválida`,
            responseText
          );
        }
      } else {
        console.log(
          `❌ Tentativa ${attempts + 1}: Resposta inválida da OpenAI`,
          responseText
        );
      }
    } catch (error) {
      console.log(
        `❌ Tentativa ${attempts + 1}: Erro ao gerar consulta`,
        error
      );
    }
  }

  throw new Error(
    "A consulta não pôde ser gerada a partir da entrada fornecida após várias tentativas."
  );
}

module.exports = generateQuery;
