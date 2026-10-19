import { Directory, File, Paths } from 'expo-file-system';

/**
 * Pasta única dos arquivos que o app grava só para o compartilhar do sistema (PDFs do treino, da dieta e das cargas e
 * o JSON da exportação LGPD). Têm dado de saúde e o nome do aluno: não podem ficar no cache esperando o sistema limpar.
 * Cada novo arquivo apaga os anteriores (o compartilhar do anterior já terminou), e o "Sair" e a sessão recusada
 * apagam a pasta inteira. O arquivo não é apagado logo depois do `shareAsync`: no Android ele pode resolver antes de o
 * app de destino ler o arquivo.
 */
const pasta = () => new Directory(Paths.cache, 'compartilhar');

export function apagarArquivosTemporarios(): void {
  const dir = pasta();
  if (dir.exists) dir.delete();
}

/** Arquivo novo na pasta dos temporários (os anteriores saem antes). */
export function novoArquivoTemporario(nome: string): File {
  apagarArquivosTemporarios();
  const dir = pasta();
  dir.create();
  const arquivo = new File(dir, nome);
  arquivo.create();
  return arquivo;
}

/** O PDF que o `expo-print` gera fica no cache dele; apaga quando o app já tem a própria cópia. */
export function apagarArquivo(uri: string): void {
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    // Arquivo que já não existe ou fora do alcance do app: nada a apagar.
  }
}
