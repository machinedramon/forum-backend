const fs = require("fs");
const axios = require("axios");
const path = require("path");
const pdf = require("pdf-parse");

// Caminho do arquivo JSON
const filePath = path.join(__dirname, "livros.json");

// Função para realizar extração de texto em cada PDF e adicionar o texto ao JSON
const extractTextAndUpdateJSON = async () => {
  try {
    // Ler o arquivo JSON
    const data = fs.readFileSync(filePath, "utf-8");
    const books = JSON.parse(data);

    // Função para fazer download do PDF
    const downloadPDF = async (pdfUrl) => {
      try {
        const response = await axios.get(pdfUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data, "binary");
        const tempPdfPath = path.join(__dirname, "temp.pdf");
        fs.writeFileSync(tempPdfPath, buffer);
        return tempPdfPath;
      } catch (error) {
        console.error(`Erro ao fazer download do PDF: ${pdfUrl}`, error);
        return null;
      }
    };

    // Função para extrair texto do PDF
    const extractTextFromPDF = async (pdfPath) => {
      try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        return data.text.replace(/\s+/g, " ").trim(); // Remover espaços e quebras de linha extras
      } catch (error) {
        console.error(`Erro ao extrair texto do PDF: ${pdfPath}`, error);
        return null;
      }
    };

    // Iterar sobre cada livro
    for (const book of books) {
      for (const edition of book.editions) {
        for (const chapter of edition.chapters) {
          if (chapter.pdf) {
            console.log(
              `Extraindo texto do capítulo: ${
                chapter.title || "ID: " + chapter.id
              }`
            ); // Log de depuração
            const tempPdfPath = await downloadPDF(chapter.pdf);
            if (tempPdfPath) {
              const extractedText = await extractTextFromPDF(tempPdfPath);
              if (extractedText) {
                chapter.ocr = extractedText; // Adicionar texto extraído ao capítulo
                console.log(
                  `Texto extraído adicionado ao capítulo ${
                    chapter.title || "ID: " + chapter.id
                  }`
                );
              }
              fs.unlinkSync(tempPdfPath); // Remover o PDF temporário
            }
          }
        }
      }
    }

    // Salvar o arquivo JSON atualizado
    fs.writeFileSync(filePath, JSON.stringify(books, null, 2), "utf-8");
    console.log("Arquivo JSON atualizado com sucesso com os textos extraídos!");
  } catch (error) {
    console.error(
      "Erro ao atualizar o arquivo JSON com textos extraídos:",
      error
    );
  }
};

// Executar a função de extração de texto e atualização do JSON
extractTextAndUpdateJSON();
