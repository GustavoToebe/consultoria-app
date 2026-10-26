import { File } from 'expo-file-system';

/** Arquivo do celular a enviar: `nome` e `tipo` vão no multipart; os bytes vêm da `uri` (`file://`) ou do `conteudo`. */
export interface ArquivoDoAparelho {
  nome: string;
  tipo: string;
  uri: string;
  conteudo?: Pick<Blob, 'arrayBuffer'> | null;
}

/**
 * Anexa um arquivo do celular ao `FormData` (campo `campo`). Só para Android e iOS: a web anexa o próprio `Blob`.
 * No celular o `fetch` é o do Expo (`expo/fetch`), que monta o multipart a partir de string, `Blob` ou de um objeto com
 * `bytes()`, e lê `name` e `type` desse objeto para o `filename` e o `Content-Type` da parte. Os dois caminhos mais
 * óbvios falham: `new Blob([bytes])` lança no React Native ("Creating blobs from 'ArrayBuffer' ... not supported") e o
 * atalho `{ uri, name, type }` cai em "Unsupported FormDataPart implementation", que o cliente mostra como "sem
 * conexão". O 3º argumento do `append` é ignorado fora de `Blob`, e um `File` do `expo-file-system` levaria o nome em
 * disco e nenhum tipo: por isso o objeto é montado aqui. Os bytes são lidos já, para um arquivo ilegível falhar neste
 * ponto e não dentro do `fetch`.
 */
export async function anexarArquivoDoAparelho(dados: FormData, campo: string, arquivo: ArquivoDoAparelho): Promise<void> {
  const origem = arquivo.conteudo ? await arquivo.conteudo.arrayBuffer() : await new File(arquivo.uri).arrayBuffer();
  const bytes = new Uint8Array(origem);
  const parte = { name: arquivo.nome, type: arquivo.tipo, size: bytes.byteLength, bytes: async () => bytes };
  dados.append(campo, parte as unknown as Blob);
}
