const fs = require("fs");
const axios = require("axios");
const path = require("path");

// Caminho do arquivo JSON
const filePath = path.join(__dirname, "livros.json");

// Função para atualizar os livros com as edições corretas e adicionar os capítulos dentro de cada edição
const updateBooksEditionsAndChapters = async () => {
  try {
    // Ler o arquivo JSON
    const data = fs.readFileSync(filePath, "utf-8");
    const books = JSON.parse(data);

    // Iterar sobre cada livro
    for (const book of books) {
      const bookId = book.id.split("-")[0]; // Obter a primeira parte do ID

      console.log(`Processando livro: ${book.title}, ID: ${bookId}`); // Log de depuração

      try {
        // Fazer a requisição para obter as edições do livro
        const editionsResponse = await axios.get(
          `https://api2.forumconhecimento.com.br/plat-content-book/books/${bookId}/editions`,
          {
            headers: {
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiIxOTk4IiwiY3JlYXRlZF9hdCI6MTcxODkxMjAzNywiZW1haWwiOiJkYXVndXN0b0BjcHFkLmNvbS5iciIsImludHJhbmV0X3Nlc3Npb25faWQiOiIiLCJpYXQiOjE3MTg5MTMwNzMsImV4cCI6MTcxOTA4NTg3MywiYXVkIjoiaHR0cHM6Ly9hcGkyLmZvcnVtY29uaGVjaW1lbnRvLmNvbS5iciIsImlzcyI6Imh0dHBzOi8vYXBpMi5mb3J1bWNvbmhlY2ltZW50by5jb20uYnIvcGxhdC1hdXRoLWxvZ2luLyJ9.cX4TOcFzknUzJE7-_wnPDGbvGZ0YmfN4PBRMAyJSADo`,
            },
          }
        );

        // Atualizar o objeto editions do livro
        book.editions = editionsResponse.data;

        // Iterar sobre cada edição para obter e adicionar os capítulos
        for (const edition of book.editions) {
          try {
            const editionId = edition.num_id; // Usar o num_id da edição
            const bookNumId = edition.book_num_id; // Usar o book_num_id da edição

            // Construir o endpoint para obter os capítulos
            const chaptersEndpoint = `https://api2.forumconhecimento.com.br/plat-content-book/books/${bookNumId}/editions/${editionId}/chapters`;
            console.log(
              `Montando endpoint para capítulos: ${chaptersEndpoint}`
            ); // Log do endpoint

            // Fazer a requisição para obter os capítulos da edição
            const chaptersResponse = await axios.get(chaptersEndpoint, {
              headers: {
                Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiIxOTk4IiwiY3JlYXRlZF9hdCI6MTcxODkxMjAzNywiZW1haWwiOiJkYXVndXN0b0BjcHFkLmNvbS5iciIsImludHJhbmV0X3Nlc3Npb25faWQiOiIiLCJpYXQiOjE3MTg5MTMwNzMsImV4cCI6MTcxOTA4NTg3MywiYXVkIjoiaHR0cHM6Ly9hcGkyLmZvcnVtY29uaGVjaW1lbnRvLmNvbS5iciIsImlzcyI6Imh0dHBzOi8vYXBpMi5mb3J1bWNvbmhlY2ltZW50by5jb20uYnIvcGxhdC1hdXRoLWxvZ2luLyJ9.cX4TOcFzknUzJE7-_wnPDGbvGZ0YmfN4PBRMAyJSADo`,
              },
            });

            // Iterar sobre cada capítulo para obter a URL assinada e atualizar o campo pdf
            for (const chapter of chaptersResponse.data) {
              const chapterNumId = chapter.num_id; // Usar o num_id do capítulo
              const signedUrlEndpoint = `https://api2.forumconhecimento.com.br/plat-content-book/books/${bookNumId}/editions/${editionId}/chapters/${chapterNumId}/signed-url`;
              console.log(
                `Montando endpoint para signed URL: ${signedUrlEndpoint}`
              ); // Log do endpoint

              try {
                const signedUrlResponse = await axios.get(signedUrlEndpoint, {
                  headers: {
                    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiIxOTk4IiwiY3JlYXRlZF9hdCI6MTcxODkxMjAzNywiZW1haWwiOiJkYXVndXN0b0BjcHFkLmNvbS5iciIsImludHJhbmV0X3Nlc3Npb25faWQiOiIiLCJpYXQiOjE3MTg5MTMwNzMsImV4cCI6MTcxOTA4NTg3MywiYXVkIjoiaHR0cHM6Ly9hcGkyLmZvcnVtY29uaGVjaW1lbnRvLmNvbS5iciIsImlzcyI6Imh0dHBzOi8vYXBpMi5mb3J1bWNvbmhlY2ltZW50by5jb20uYnIvcGxhdC1hdXRoLWxvZ2luLyJ9.cX4TOcFzknUzJE7-_wnPDGbvGZ0YmfN4PBRMAyJSADo`,
                  },
                });

                // Atualizar o campo pdf com a URL assinada
                chapter.pdf = signedUrlResponse.data.url;
                console.log(
                  `URL assinada adicionada para o capítulo ${
                    chapter.title || "ID: " + chapter.id
                  }`
                );
              } catch (error) {
                console.error(
                  `Erro ao obter URL assinada para o capítulo ${
                    chapter.title || "ID: " + chapter.id
                  }:`,
                  error
                );
              }

              // Remover campos tags e authors
              delete chapter.tags;
              delete chapter.authors;
            }

            // Adicionar os capítulos atualizados à edição
            edition.chapters = chaptersResponse.data;
            console.log(
              `Capítulos atualizados para a edição ${
                edition.title || "ID: " + edition.id
              }`
            );
          } catch (error) {
            console.error(
              `Erro ao obter capítulos para a edição ${
                edition.title || "ID: " + edition.id
              }:`,
              error
            );
          }
        }

        console.log(
          `Edições e capítulos atualizados para o livro ${
            book.title || "ID: " + book.id
          }`
        );
      } catch (error) {
        console.error(
          `Erro ao obter edições para o livro ${
            book.title || "ID: " + book.id
          }:`,
          error
        );
      }
    }

    // Remover a chave "chapters" do nível do livro
    for (const book of books) {
      delete book.chapters;
    }

    // Salvar o arquivo JSON atualizado
    fs.writeFileSync(filePath, JSON.stringify(books, null, 2), "utf-8");
    console.log("Arquivo JSON atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar o arquivo JSON:", error);
  }
};

// Executar a função de atualização
updateBooksEditionsAndChapters();
