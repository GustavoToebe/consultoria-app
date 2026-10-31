import type { Configuracao, Receita, Serie } from '../api/tipos';
import { rotuloDoTipoDaSerie } from './agrupamento';
import { filtrarModelos } from './colecoes';
import { seriesDaReceita } from './editorTreino';
import { nomeDoTipo } from './metodologia';

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
