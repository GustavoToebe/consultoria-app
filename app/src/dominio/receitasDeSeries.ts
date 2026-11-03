import type { Configuracao, PapelDaSerie, Receita, Serie, TipoDeTecnica } from '../api/tipos';
import type { ChaveDeIdentificacao } from '../tema/tokens';
import { agrupar, descreverGrupo, rotuloDoTipoDaSerie } from './agrupamento';
import { filtrarModelos } from './colecoes';
import { corDoTipoDeSerie } from './corDaSerie';
import { seriesDaReceita } from './editorTreino';
import { nomeDaTecnica, nomeDoTipo, papelDe, rotuloDoPapel, TIPOS_DE_TECNICA } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

/**
 * Receitas de séries na folha "Usar receita" do editor (reunião de 30/10): a composição em uma linha e a busca pelo nome,
 * pela descrição e pela composição. Só leitura: nada daqui entra no plano.
 */

/** Nome curto do tipo na composição: o configurado ("FS", "Back off"); cardio e série sem tipo têm o seu. */
function nomeNaComposicao(serie: Pick<Serie, 'tipo' | 'cardio'>, config: Configuracao | null | undefined): string {
  if (serie.cardio) return 'Cardio';
  return nomeDoTipo(config, serie.tipo) || 'Sem tipo';
}

/**
 * Quantas séries de cada tipo, na ordem em que aparecem e juntando só as seguidas: "FS ×3 · WS ×1 · Back off ×1". Usa
 * só os nomes configurados (sem o papel), para caber numa linha; tipo fora da metodologia sai pelo código.
 */
export function composicaoDasSeries(series: readonly Pick<Serie, 'tipo' | 'cardio'>[], config?: Configuracao | null): string {
  const trechos: { nome: string; quantas: number }[] = [];
  for (const s of series) {
    const nome = nomeNaComposicao(s, config);
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.nome === nome) ultimo.quantas += 1;
    else trechos.push({ nome, quantas: 1 });
  }
  return trechos.map((t) => `${t.nome} ×${t.quantas}`).join(' · ');
}

/** Composição da receita de séries guardada (`conteudo.series`); vazia sem séries. */
export function composicaoDaReceita(conteudo: unknown, config?: Configuracao | null): string {
  return composicaoDasSeries(seriesDaReceita(conteudo), config);
}

/** O que a busca procura além do nome e da descrição: a composição e o tipo como o treinador lê ("Preparação · FS"). */
function textoDaComposicao(conteudo: unknown, config: Configuracao | null | undefined): string {
  const series = seriesDaReceita(conteudo);
  const rotulos = new Set(series.map((s) => (s.cardio ? 'Cardio' : rotuloDoTipoDaSerie(config, s.tipo))).filter(Boolean));
  return [composicaoDasSeries(series, config), ...rotulos].join(' ');
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Receitas de séries que batem com a busca, sem acento nem caixa: pelo nome e pela descrição (`filtrarModelos`, a mesma
 * do Planejamento) ou pela composição ("back off", "preparação"). A ordem da lista não muda; busca vazia = todas.
 */
export function filtrarReceitasDeSeries(receitas: readonly Receita[], busca: string, config?: Configuracao | null): Receita[] {
  const termo = semAcento(busca);
  if (!termo) return filtrarModelos(receitas, 'SERIES', '');
  const peloNome = new Set(filtrarModelos(receitas, 'SERIES', busca).map((r) => r.id));
  return receitas.filter((r) => r.tipo === 'SERIES' && (peloNome.has(r.id) || semAcento(textoDaComposicao(r.conteudo, config)).includes(termo)));
}

/* ---------------- "Usar receita" em blocos e técnicas (Frente G, D16, C16) ---------------- */

/** Um trecho da sequência da receita: o texto do grupo de séries, o nome do tipo (selo) e a cor do tipo (D9; nula = sem cor). */
export interface PecaDaReceita {
  texto: string;
  nomeDoTipo: string;
  cor: ChaveDeIdentificacao | null;
}

/**
 * A sequência da receita, um trecho por grupo de séries iguais e seguidas ("3x3 - FS 50% · 70% · 85% a 90% da WS"), com o
 * nome e a cor do tipo. O texto usa a metodologia do plano (como antes); o papel do tipo, para a cor de um tipo criado pelo
 * treinador, cai na metodologia padrão quando o plano não tem metodologia.
 */
export function pecasDaReceita(conteudo: unknown, config?: Configuracao | null): PecaDaReceita[] {
  const series = seriesDaReceita(conteudo);
  const paraOPapel = config ?? CONFIGURACAO_PADRAO;
  return agrupar(series).map((g) => {
    const s = g.series[0];
    return {
      texto: descreverGrupo(g, config, series),
      nomeDoTipo: nomeNaComposicao(s, config),
      cor: s.cardio ? null : corDoTipoDeSerie(s.tipo, papelDe(paraOPapel, s.tipo)),
    };
  });
}

export interface SecaoDeReceitas {
  chave: string;
  titulo: string;
  receitas: Receita[];
}

const ORDEM_DOS_PAPEIS: PapelDaSerie[] = ['AQUECIMENTO', 'PREPARACAO', 'TRABALHO', 'POS_TRABALHO'];

/**
 * Em que seção a receita entra (uma só): com técnica (Cluster, Rest pause, Drop-set…), na seção da técnica (a primeira
 * que aparece); sem técnica e com séries de mais de um papel, "Receitas completas"; de um papel só, no bloco do papel
 * (Aquecimento, Preparação, Trabalho, Pós-trabalho); o resto (papel "Outro", tipo fora da metodologia, só cardio,
 * sem séries) em "Outras receitas".
 */
export function secaoDaReceita(conteudo: unknown, config?: Configuracao | null): { chave: string; titulo: string } {
  const series = seriesDaReceita(conteudo);
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const tecnica = series.find((s) => s.tecnica?.tipo)?.tecnica?.tipo;
  if (tecnica) return { chave: `TECNICA:${tecnica}`, titulo: `Técnica: ${nomeDaTecnica(cfg, tecnica)}` };
  const papeis = new Set(series.filter((s) => !s.cardio).map((s) => papelDe(cfg, s.tipo)).filter((p): p is PapelDaSerie => !!p));
  if (papeis.size > 1) return { chave: 'COMPLETAS', titulo: 'Receitas completas' };
  const [papel] = [...papeis];
  if (papel && papel !== 'OUTRO') return { chave: `PAPEL:${papel}`, titulo: rotuloDoPapel(papel) };
  return { chave: 'OUTRAS', titulo: 'Outras receitas' };
}

/**
 * As receitas de séries em seções, nesta ordem: receitas completas, Aquecimento, Preparação, Trabalho, Pós-trabalho, uma
 * por técnica (na ordem do catálogo) e "Outras receitas". Cada receita aparece uma vez, na ordem da lista; seção vazia some.
 */
export function agruparReceitasDeSeries(receitas: readonly Receita[], config?: Configuracao | null): SecaoDeReceitas[] {
  const ordem = ['COMPLETAS', ...ORDEM_DOS_PAPEIS.map((p) => `PAPEL:${p}`), ...TIPOS_DE_TECNICA.map((t: TipoDeTecnica) => `TECNICA:${t}`), 'OUTRAS'];
  const secoes = new Map<string, SecaoDeReceitas>();
  for (const r of receitas) {
    const { chave, titulo } = secaoDaReceita(r.conteudo, config);
    const secao = secoes.get(chave) ?? { chave, titulo, receitas: [] };
    secao.receitas.push(r);
    secoes.set(chave, secao);
  }
  return [...secoes.values()].sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
}
