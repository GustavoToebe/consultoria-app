/** O mesmo teste do servidor: sem espaços nas pontas e sem diferenciar maiúsculas de minúsculas. */
export function nomeConfere(nome: string, digitado: string): boolean {
  const lido = digitado.trim();
  return lido.length > 0 && lido.toLocaleLowerCase('pt-BR') === nome.trim().toLocaleLowerCase('pt-BR');
}

/** Nome do arquivo baixado: só a data, nunca o nome da pessoa. */
export function nomeDoArquivoDeExportacao(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `dados-do-aluno-${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}.json`;
}

/** O JSON do arquivo: identado para quem for abrir num editor. */
export const textoDaExportacao = (dados: unknown): string => JSON.stringify(dados, null, 2);
