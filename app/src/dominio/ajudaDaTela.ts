import { rotaInteiraDoCaminho } from './rotasDasConfiguracoes';

/**
 * Seção da Ajuda que explica cada tela: o "Saiba mais" do balão "Sobre esta tela" do cabeçalho (`ui/AjudaDoCabecalho`).
 * Só onde a correspondência com uma seção que existe em `ajuda/conteudo.ts` é óbvia (o título da seção ou um item dela
 * com o nome da tela); o teste confere que todo id existe. A chave casa a própria tela e as telas abaixo dela
 * (`/treinador/importacao/nova` cai em `importacao`); `null` corta a herança da tela de cima. Tela sem entrada mostra só o
 * texto, sem link.
 */
const SECAO_DA_TELA: Readonly<Record<string, string | null>> = {
  '/treinador': 'inicio',
  '/treinador/agenda': 'agenda',
  '/treinador/alunos': 'alunos',
  '/treinador/atualizacoes': 'atualizacoes',
  '/treinador/auditoria': 'consultoria',
  '/treinador/biblioteca': 'biblioteca',
  '/treinador/comunidade': 'comunidade',
  '/treinador/configuracoes': 'consultoria',
  '/treinador/contratos': 'contratos',
  '/treinador/dietas': 'planos',
  '/treinador/equipe': 'consultoria',
  '/treinador/financeiro': 'financeiro',
  '/treinador/importacao': 'importacao',
  '/treinador/interessados': 'interessados',
  '/treinador/marca': 'consultoria',
  '/treinador/mobilidades': 'planos',
  '/treinador/planejamento': 'planos',
  // O editor de questionário serve à atualização, à anamnese e à inscrição: nenhuma seção é a dele.
  '/treinador/planejamento/questionario': null,
  '/treinador/regras-de-atencao': 'regras-de-atencao',
  '/treinador/termos': 'privacidade',
  '/treinador/treinos': 'planos',
  '/treinador/vitrine': 'vitrine',
  '/aluno/comunidade': 'comunidade',
  '/aluno/treino': 'treino',
  '/aluno/vitrine': 'vitrine',
};

/** As chaves do mapa, para o teste conferir os ids contra o guia de cada área. */
export const TELAS_COM_ARTIGO = Object.entries(SECAO_DA_TELA).filter((e): e is [string, string] => e[1] !== null);

/** O Início é a raiz da área e prefixo de toda tela: o artigo dele vale só para ele. */
const SEM_SUBTELAS = new Set(['/treinador']);

/** Endereço do artigo da tela na Ajuda da área (`/treinador/ajuda?secao=biblioteca`), ou `null` sem artigo. */
export function artigoDaTela(caminhoPedido: string): string | null {
  // Item aberto dentro de Configurações tem o artigo da tela inteira dele (Segurança continua sem, Termos vai à privacidade).
  const caminho = rotaInteiraDoCaminho(caminhoPedido) ?? caminhoPedido;
  const area = caminho.startsWith('/aluno') ? 'aluno' : caminho.startsWith('/treinador') ? 'treinador' : null;
  if (!area) return null;
  const chave = Object.keys(SECAO_DA_TELA)
    .filter((c) => caminho === c || (!SEM_SUBTELAS.has(c) && caminho.startsWith(`${c}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const secao = chave ? SECAO_DA_TELA[chave] : null;
  return secao ? `/${area}/ajuda?secao=${secao}` : null;
}
