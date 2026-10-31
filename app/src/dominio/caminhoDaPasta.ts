/**
 * Caminho da ficha do aluno com a Folha da pasta aberta (`/treinador/alunos/<id>?pastaId=<id>`; a ficha lê o
 * `pastaId` e abre a Folha). Usado pelo "Voltar à pasta" dos editores do plano do aluno (reunião de 30/10).
 *
 * Os ids são UUIDs: qualquer coisa fora de letras, números, `-` e `_` (um `..`, uma barra, espaço) devolve `null` e o
 * botão não aparece. O `encodeURIComponent` sozinho não bastaria: ele deixa o `..` passar e o navegador o resolve.
 */
const ID_SEGURO = /^[A-Za-z0-9_-]+$/;

export function idSeguro(id: string | null | undefined): id is string {
  return typeof id === 'string' && ID_SEGURO.test(id);
}

export function caminhoDaPasta(alunoId: string | null | undefined, pastaId: string | null | undefined): string | null {
  if (!idSeguro(alunoId) || !idSeguro(pastaId)) return null;
  return `/treinador/alunos/${encodeURIComponent(alunoId)}?pastaId=${encodeURIComponent(pastaId)}`;
}
