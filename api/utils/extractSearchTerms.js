const fields = [
  "id",
  "title",
  "author",
  "publish_date",
  "text_1",
  "text_2",
  "text_3",
  "text_4",
  "text_5",
  "tags.title",
  "filters.title",
  "editions.book_num_id",
  "editions.is_actual",
  "editions.isbn",
  "editions.subtitle",
  "editions.num_id",
  "editions.pages",
  "editions.number",
  "editions.is_published",
  "editions.publish_date",
  "editions.description",
  "editions.title",
  "editions.authors.title",
  "editions.chapters.chapter_type",
  "editions.chapters.num_id",
  "editions.chapters.order",
  "editions.chapters.id",
  "editions.chapters.language",
  "editions.chapters.type",
  "editions.chapters.title",
  "editions.chapters.pdf",
  "editions.chapters.ocr",
];

function extractSearchTerms(query) {
  const searchTerms = [];

  function traverse(obj) {
    for (let key in obj) {
      if (key === "match_phrase") {
        const matchPhraseQuery = obj[key];
        for (let field in matchPhraseQuery) {
          if (fields.includes(field)) {
            // Tratar o termo da consulta match_phrase como uma frase única.
            const phrase = matchPhraseQuery[field]?.toLowerCase();
            if (phrase) {
              searchTerms.push(phrase);
            }
          }
        }
      } else if (key === "match" || key === "multi_match") {
        const matchQuery = obj[key];
        if (key === "multi_match" && matchQuery.query) {
          // Dividir o termo da consulta multi_match em palavras separadas.
          const terms = matchQuery.query.split(" ");
          searchTerms.push(...terms.map((term) => term.toLowerCase()));
        } else {
          for (let field in matchQuery) {
            if (fields.includes(field)) {
              // Dividir o termo da consulta match em palavras separadas.
              const terms = matchQuery[field]?.query
                ? matchQuery[field].query.split(" ")
                : matchQuery[field]?.split(" ");
              if (terms) {
                searchTerms.push(...terms.map((term) => term.toLowerCase()));
              }
            }
          }
        }
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        traverse(obj[key]);
      }
    }
  }

  traverse(query);
  console.log([...new Set(searchTerms)]);
  return [...new Set(searchTerms)];
}

module.exports = extractSearchTerms;
