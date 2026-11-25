/**
 * Seção da Ajuda que explica cada tela: o "Saiba mais" do balão "Sobre esta tela" do cabeçalho (`ui/AjudaDoCabecalho`).
 * Só onde a correspondência com uma seção que existe em `ajuda/conteudo.ts` é óbvia (o título da seção ou um item dela
 * com o nome da tela); o teste confere que todo id existe. A chave casa a própria tela e as telas abaixo dela
 * (`/treinador/importacao/nova` cai em `importacao`). Tela sem entrada mostra só o texto, sem link.
 */
const SECAO_DA_TELA: Readonly<Record<string, string>> = {
  '/treinador/atualizacoes': 'atualizacoes',
  '/treinador/auditoria': 'consultoria',
  '/treinador/biblioteca': 'biblioteca',
  '/treinador/comunidade': 'comunidade',
  '/treinador/configuracoes': 'consultoria',
  '/treinador/equipe': 'consultoria',
  '/treinador/financeiro': 'financeiro',
  '/treinador/importacao': 'importacao',
  '/treinador/interessados': 'interessados',
  '/treinador/marca': 'consultoria',
  '/treinador/vitrine': 'vitrine',
  '/aluno/comunidade': 'comunidade',
  '/aluno/treino': 'treino',
  '/aluno/vitrine': 'vitrine',
};

/** As chaves do mapa, para o teste conferir os ids contra o guia de cada área. */
export const TELAS_COM_ARTIGO = Object.entries(SECAO_DA_TELA);

/** Endereço do artigo da tela na Ajuda da área (`/treinador/ajuda?secao=biblioteca`), ou `null` sem artigo. */
export function artigoDaTela(caminho: string): string | null {
  const area = caminho.startsWith('/aluno') ? 'aluno' : caminho.startsWith('/treinador') ? 'treinador' : null;
  if (!area) return null;
  const chave = Object.keys(SECAO_DA_TELA)
    .filter((c) => caminho === c || caminho.startsWith(`${c}/`))
    .sort((a, b) => b.length - a.length)[0];
  return chave ? `/${area}/ajuda?secao=${SECAO_DA_TELA[chave]}` : null;
}
