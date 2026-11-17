// O app é de Brasília: as datas e horas na tela (e os hashes dos PDFs de exemplo, "Emitido em HH:mm") saem no fuso de
// São Paulo. A CI roda em UTC; sem isto o teste que fixa o hash do PDF falha lá e passa na máquina de quem desenvolve.
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
