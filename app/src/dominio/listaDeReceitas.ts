import type { Configuracao, Receita, TipoDeTecnica } from '../api/tipos';
import { seriesDaReceita } from './editorTreino';
import { nomeDaTecnica, nomeDoTipo, TIPOS_DE_TECNICA } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { filtrarReceitasDeSeries, secaoDaReceita } from './receitasDeSeries';

/**
 * A lista da folha "Usar receita" (27/11): três abas, chips de tipo e técnica, a receita escolhida e as setas. Só leitura.
 * "Completas" são as de mais de um papel (`secaoDaReceita`, a mesma regra das seções de antes); o resto são "Partes".
 * "Da consultoria" é um recorte à parte: as receitas que a equipe criou ou salvou (`origem` `CONSULTORIA`, decidida pela API),
 * completas ou partes; por isso uma receita da consultoria aparece também em "Completas" ou "Partes".
 */

export type AbaDeReceitas = 'COMPLETAS' | 'PARTES' | 'CONSULTORIA';

export const ABAS_DE_RECEITAS: readonly { valor: AbaDeReceitas; rotulo: string }[] = [
  { valor: 'COMPLETAS', rotulo: 'Completas' },
  { valor: 'PARTES', rotulo: 'Partes' },
  { valor: 'CONSULTORIA', rotulo: 'Da consultoria' },
];

/** Chip "Todos" (nenhum filtro de tipo ou técnica). */
export const SEM_FILTRO = 'TODOS';

/** A aba pela forma da receita: completa ou partes ("Da consultoria" não é forma, é origem: `estaNaAba`). */
export function abaDaReceita(conteudo: unknown, config?: Configuracao | null): 'COMPLETAS' | 'PARTES' {
  return secaoDaReceita(conteudo, config).chave === 'COMPLETAS' ? 'COMPLETAS' : 'PARTES';
}

/** Se a receita entra na aba: "Da consultoria" pela origem; as outras pela forma. */
export function estaNaAba(r: Receita, aba: AbaDeReceitas, config?: Configuracao | null): boolean {
  return aba === 'CONSULTORIA' ? r.origem === 'CONSULTORIA' : abaDaReceita(r.conteudo, config) === aba;
}

/** Quantas receitas de cada aba batem com a busca (o chip é da aba e não entra na contagem). */
export function contagemPorAba(receitas: readonly Receita[], busca: string, config?: Configuracao | null): Record<AbaDeReceitas, number> {
  const contagem: Record<AbaDeReceitas, number> = { COMPLETAS: 0, PARTES: 0, CONSULTORIA: 0 };
  for (const r of filtrarReceitasDeSeries(receitas, busca, config)) {
    contagem[abaDaReceita(r.conteudo, config)] += 1;
    if (r.origem === 'CONSULTORIA') contagem.CONSULTORIA += 1;
  }
  return contagem;
}

/** As receitas de séries da aba, na ordem da lista (sem busca nem chip). */
export function receitasDaAba(receitas: readonly Receita[], aba: AbaDeReceitas, config?: Configuracao | null): Receita[] {
  return receitas.filter((r) => r.tipo === 'SERIES' && estaNaAba(r, aba, config));
}

/** A aba em que a folha abre: Completas, senão Partes, se só houver partes. "Da consultoria" nunca é a primeira. */
export function abaInicial(receitas: readonly Receita[], config?: Configuracao | null): AbaDeReceitas {
  const series = receitas.filter((r) => r.tipo === 'SERIES');
  return series.length && !series.some((r) => abaDaReceita(r.conteudo, config) === 'COMPLETAS') ? 'PARTES' : 'COMPLETAS';
}

/** O que a receita tem para os chips: `TIPO:<código>` de cada série que não é cardio e `TECNICA:<tipo>` de cada técnica. */
function marcasDaReceita(conteudo: unknown): Set<string> {
  const marcas = new Set<string>();
  for (const s of seriesDaReceita(conteudo)) {
    if (!s.cardio && s.tipo?.trim()) marcas.add(`TIPO:${s.tipo.trim()}`);
    if (s.tecnica?.tipo) marcas.add(`TECNICA:${s.tecnica.tipo}`);
  }
  return marcas;
}

/**
 * Os chips que valem para estas receitas: "Todos" e, só os que aparecem em alguma, os tipos na ordem da metodologia (fora
 * dela, na ordem em que aparecem) e as técnicas na ordem do catálogo. Os nomes são os da metodologia ("FS", "Back off").
 */
export function filtrosDasReceitas(receitas: readonly Receita[], config?: Configuracao | null): { valor: string; rotulo: string }[] {
  const presentes = new Set<string>();
  const tiposNaOrdem: string[] = [];
  for (const r of receitas) {
    for (const m of marcasDaReceita(r.conteudo)) {
      if (presentes.has(m)) continue;
      presentes.add(m);
      if (m.startsWith('TIPO:')) tiposNaOrdem.push(m.slice(5));
    }
  }
  const ordemDaMetodologia = (config ?? CONFIGURACAO_PADRAO).tipos.map((t) => t.codigo);
  const posicao = (codigo: string) => {
    const i = ordemDaMetodologia.indexOf(codigo);
    return i < 0 ? ordemDaMetodologia.length + tiposNaOrdem.indexOf(codigo) : i;
  };
  const tipos = [...tiposNaOrdem].sort((a, b) => posicao(a) - posicao(b)).map((codigo) => ({ valor: `TIPO:${codigo}`, rotulo: nomeDoTipo(config, codigo) }));
  const tecnicas = TIPOS_DE_TECNICA.filter((t: TipoDeTecnica) => presentes.has(`TECNICA:${t}`))
    .map((t) => ({ valor: `TECNICA:${t}`, rotulo: nomeDaTecnica(config ?? CONFIGURACAO_PADRAO, t) }));
  return [{ valor: SEM_FILTRO, rotulo: 'Todos' }, ...tipos, ...tecnicas];
}

/**
 * As receitas que a lista mostra: as de séries da aba, que batem com a busca (`filtrarReceitasDeSeries`) e têm o tipo ou a
 * técnica do chip. Chip que não existe na aba (trocou de aba) vale como "Todos" (`filtroEfetivo`). Ordem da lista mantida.
 */
export function receitasDaLista(receitas: readonly Receita[], { aba, busca, filtro }: { aba: AbaDeReceitas; busca: string; filtro: string }, config?: Configuracao | null): Receita[] {
  const daAba = receitasDaAba(receitas, aba, config);
  const efetivo = filtroEfetivo(daAba, filtro, config);
  return filtrarReceitasDeSeries(daAba, busca, config).filter((r) => efetivo === SEM_FILTRO || marcasDaReceita(r.conteudo).has(efetivo));
}

/** O chip que vale: o escolhido, se ele existe entre estas receitas; senão "Todos". */
export function filtroEfetivo(daAba: readonly Receita[], filtro: string, config?: Configuracao | null): string {
  return filtrosDasReceitas(daAba, config).some((f) => f.valor === filtro) ? filtro : SEM_FILTRO;
}

/** A receita escolhida: a do id, se ainda está na lista; senão a primeira (busca, chip ou aba novos). Lista vazia = nenhuma. */
export function receitaEscolhida(lista: readonly Receita[], id: string | null): Receita | null {
  return lista.find((r) => r.id === id) ?? lista[0] ?? null;
}

/**
 * Para onde a tecla leva a escolha (APG Listbox, sem dar a volta): setas uma a uma, Home e End às pontas. Tecla que não é
 * de navegação, ou lista vazia, devolve `null`.
 */
export function idDaTecla(lista: readonly Receita[], atual: string | null, tecla: string): string | null {
  if (!lista.length) return null;
  const i = Math.max(0, lista.findIndex((r) => r.id === atual));
  const alvo = tecla === 'ArrowDown' ? Math.min(i + 1, lista.length - 1)
    : tecla === 'ArrowUp' ? Math.max(i - 1, 0)
      : tecla === 'Home' ? 0
        : tecla === 'End' ? lista.length - 1
          : null;
  return alvo === null ? null : lista[alvo].id;
}

/** Rótulo do botão principal com séries no exercício: "Substituir a série" ou "Substituir as 5 séries". */
export function rotuloDeSubstituir(seriesAtuais: number): string {
  return seriesAtuais === 1 ? 'Substituir a série' : `Substituir as ${seriesAtuais} séries`;
}

/** A linha curta acima das ações quando o exercício já tem séries; sem séries, nada. */
export function avisoDasSeriesAtuais(seriesAtuais: number): string | null {
  if (seriesAtuais <= 0) return null;
  return `Este exercício já tem ${seriesAtuais === 1 ? '1 série' : `${seriesAtuais} séries`}.`;
}
