import type { Cardio, ModoDeCardio, ProtocoloDeCardio, TipoDeCardio, MedidaDeCardio, TipoDeRecuperacao } from '../api/tipos';
import { rotuloDescanso, textoDoTempo } from './descanso';
import { numeroParaTela } from './formatos';
import { problemasDoCardio, type Problemas } from './validacaoDeSerie';

/**
 * Cardio e HIIT (docs/planos/cardio-e-hiit.md): cada série de um exercício `CARDIO` é um bloco, contínuo ou intervalado.
 * Regras puras do editor, do app do aluno, da lista e da Biblioteca; o servidor repete os limites de `erroDoBloco`.
 */

export interface DefinicaoDoProtocolo {
  codigo: ProtocoloDeCardio;
  /** Opção do select. */
  rotulo: string;
  /** Na lista, na prévia e no aviso ("SIT", "HIIT curto"). */
  curto: string;
  /** Texto do ⓘ. */
  definicao: string;
  /** Valores típicos que o protocolo preenche ao ser escolhido (o treinador muda à vontade). */
  padrao: Pick<Cardio, 'aquecimentoSeg' | 'desaquecimentoSeg' | 'zona' | 'esforcoMaximo'> & { trabalhoSeg: number; descansoSeg: number; voltas: number } | null;
}

export const PROTOCOLOS: readonly DefinicaoDoProtocolo[] = [
  {
    codigo: 'CURTO',
    rotulo: 'HIIT de intervalo curto',
    curto: 'HIIT curto',
    definicao: 'Estímulos intensos de até 60 s com pausas curtas (≤ 60 s).',
    padrao: { aquecimentoSeg: 300, trabalhoSeg: 30, descansoSeg: 30, voltas: 10, desaquecimentoSeg: 300, zona: 5, esforcoMaximo: null },
  },
  {
    codigo: 'LONGO',
    rotulo: 'HIIT de intervalo longo',
    curto: 'HIIT longo',
    definicao: 'Estímulos vigorosos acima de 1 min (geralmente 1–4 min) com descansos acima de 60 s.',
    padrao: { aquecimentoSeg: 300, trabalhoSeg: 180, descansoSeg: 120, voltas: 5, desaquecimentoSeg: 300, zona: 4, esforcoMaximo: null },
  },
  {
    codigo: 'SIT',
    rotulo: 'SIT (Sprint Interval Training)',
    curto: 'SIT',
    definicao: 'Tiros all-out de 20–30 s com descansos longos de 2–4 min para recuperação total.',
    // 4 + 3 min fecha o "~25 min" do pedido (6 × 30 s / 3 min, sem a recuperação depois do último tiro).
    padrao: { aquecimentoSeg: 240, trabalhoSeg: 30, descansoSeg: 180, voltas: 6, desaquecimentoSeg: 180, zona: null, esforcoMaximo: true },
  },
  {
    codigo: 'RST',
    rotulo: 'RST (Repeated Sprint Training)',
    curto: 'RST',
    definicao: 'Tiros curtíssimos all-out de 3–10 s repetidos com intervalos curtos (< 60 s).',
    padrao: { aquecimentoSeg: 300, trabalhoSeg: 6, descansoSeg: 30, voltas: 10, desaquecimentoSeg: 300, zona: null, esforcoMaximo: true },
  },
  {
    codigo: 'PERSONALIZADO',
    rotulo: 'Personalizado',
    curto: 'Intervalado',
    definicao: 'Intervalado do seu jeito, sem faixa de referência.',
    padrao: null,
  },
];

export const definicaoDoProtocolo = (codigo: ProtocoloDeCardio | null | undefined): DefinicaoDoProtocolo =>
  PROTOCOLOS.find((p) => p.codigo === codigo) ?? PROTOCOLOS[PROTOCOLOS.length - 1];

/** Modo do bloco; o dado antigo (sem `modo`) é intervalado quando tem `intervalos`. */
export const modoDoBloco = (c: Cardio): ModoDeCardio => c.modo ?? (c.intervalos ? 'INTERVALADO' : 'CONTINUO');

/** Protocolo do intervalado; sem protocolo (dado antigo) = personalizado. */
export const protocoloDoBloco = (c: Cardio): ProtocoloDeCardio => c.protocolo ?? 'PERSONALIZADO';

/**
 * Bloco novo, contínuo e vazio. Sem `modo` de propósito: o contínuo sai com as mesmas chaves de antes e o pacote offline
 * do app já instalado continua aceitando (só o intervalado novo pede APK novo).
 */
export const blocoContinuo = (): Cardio => ({ duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null });

/**
 * Bloco intervalado com os valores típicos do protocolo (o "Personalizado" guarda o que já havia). Trocar de modo
 * limpa os campos do outro modo: o servidor recusa campo de contínuo no intervalado e vice-versa.
 */
export function padraoDoProtocolo(codigo: ProtocoloDeCardio, atual?: Cardio | null): Cardio {
  const p = definicaoDoProtocolo(codigo).padrao;
  const i = atual?.intervalos;
  if (!p) {
    return {
      modo: 'INTERVALADO', protocolo: codigo, duracaoMin: null, distanciaKm: null, ritmo: null,
      zona: atual?.zona ?? null, esforcoMaximo: atual?.esforcoMaximo ?? null,
      aquecimentoSeg: atual?.aquecimentoSeg ?? null, desaquecimentoSeg: atual?.desaquecimentoSeg ?? null,
      recuperacaoTipo: atual?.recuperacaoTipo ?? null,
      intervalos: { trabalhoSeg: i?.trabalhoSeg ?? null, descansoSeg: i?.descansoSeg ?? null, voltas: i?.voltas ?? null },
    };
  }
  return {
    modo: 'INTERVALADO', protocolo: codigo, duracaoMin: null, distanciaKm: null, ritmo: null,
    zona: p.zona ?? null, esforcoMaximo: p.esforcoMaximo ?? null,
    aquecimentoSeg: p.aquecimentoSeg ?? null, desaquecimentoSeg: p.desaquecimentoSeg ?? null,
    recuperacaoTipo: atual?.recuperacaoTipo ?? null,
    intervalos: { trabalhoSeg: p.trabalhoSeg, descansoSeg: p.descansoSeg, voltas: p.voltas },
  };
}

/**
 * Faixa de cada categoria, só para o AVISO (nunca bloqueia; o servidor não confere). Derivada das definições do pedido:
 * CURTO estímulo ≤ 60 s e recuperação ≤ 60 s; LONGO estímulo > 60 s e recuperação > 60 s; SIT estímulo de 20 a 30 s,
 * recuperação de 120 a 240 s e esforço máximo; RST estímulo de 3 a 10 s, recuperação < 60 s e esforço máximo.
 * Campo vazio não gera aviso (o erro do campo já aparece). Personalizado não tem faixa.
 */
type Regra = { fora: (c: Cardio) => boolean; texto: string };
const est = (c: Cardio) => c.intervalos?.trabalhoSeg ?? null;
const rec = (c: Cardio) => c.intervalos?.descansoSeg ?? null;
const foraSe = (v: number | null, ok: (n: number) => boolean) => v != null && !ok(v);
const semMaximo = (c: Cardio) => c.esforcoMaximo !== true;

const FAIXAS: Partial<Record<ProtocoloDeCardio, readonly Regra[]>> = {
  CURTO: [
    { fora: (c) => foraSe(est(c), (n) => n <= 60), texto: 'estímulo de até 60 s' },
    { fora: (c) => foraSe(rec(c), (n) => n <= 60), texto: 'recuperação de até 60 s' },
  ],
  LONGO: [
    { fora: (c) => foraSe(est(c), (n) => n > 60), texto: 'estímulo acima de 1 min' },
    { fora: (c) => foraSe(rec(c), (n) => n > 60), texto: 'recuperação acima de 60 s' },
  ],
  SIT: [
    { fora: (c) => foraSe(est(c), (n) => n >= 20 && n <= 30), texto: 'estímulo de 20 a 30 s' },
    { fora: (c) => foraSe(rec(c), (n) => n >= 120 && n <= 240), texto: 'recuperação de 2 a 4 min' },
    { fora: semMaximo, texto: 'esforço máximo' },
  ],
  RST: [
    { fora: (c) => foraSe(est(c), (n) => n >= 3 && n <= 10), texto: 'estímulo de 3 a 10 s' },
    { fora: (c) => foraSe(rec(c), (n) => n < 60), texto: 'recuperação abaixo de 60 s' },
    { fora: semMaximo, texto: 'esforço máximo' },
  ],
};

/** "Fora da faixa do SIT (estímulo de 20 a 30 s)"; um aviso por bloco, com as partes fora juntas; nulo dentro da faixa. */
export function avisoForaDaFaixa(c: Cardio): string | null {
  if (modoDoBloco(c) !== 'INTERVALADO') return null;
  const cod = protocoloDoBloco(c);
  const fora = (FAIXAS[cod] ?? []).filter((r) => r.fora(c)).map((r) => r.texto);
  return fora.length ? `Fora da faixa do ${definicaoDoProtocolo(cod).curto} (${fora.join('; ')})` : null;
}

export type FaseDoIntervalado = 'AQUECIMENTO' | 'ESTIMULO' | 'RECUPERACAO' | 'DESAQUECIMENTO';
export interface Fase { fase: FaseDoIntervalado; segundos: number; /** 1 a voltas no estímulo e na recuperação. */ volta?: number }

/**
 * Sequência do timer do aluno: aquecimento, estímulo e recuperação a cada volta, sem a recuperação depois do último
 * estímulo (dali o aluno vai ao desaquecimento), e desaquecimento. Fase de 0 s não entra. Vazio se faltar estímulo ou
 * voltas. O tempo total do intervalado é a soma destas fases (a conta e o timer nunca divergem).
 */
export function fasesDoBloco(c: Cardio): Fase[] {
  const i = c.intervalos;
  if (modoDoBloco(c) !== 'INTERVALADO' || !i?.trabalhoSeg || !i.voltas) return [];
  const fases: Fase[] = [];
  if (c.aquecimentoSeg) fases.push({ fase: 'AQUECIMENTO', segundos: c.aquecimentoSeg });
  for (let volta = 1; volta <= i.voltas; volta++) {
    fases.push({ fase: 'ESTIMULO', segundos: i.trabalhoSeg, volta });
    if (volta < i.voltas && i.descansoSeg) fases.push({ fase: 'RECUPERACAO', segundos: i.descansoSeg, volta });
  }
  if (c.desaquecimentoSeg) fases.push({ fase: 'DESAQUECIMENTO', segundos: c.desaquecimentoSeg });
  return fases;
}

/**
 * Segundos do bloco; nulo quando não dá para saber. Contínuo: a duração (só a distância não dá tempo). Intervalado: a
 * soma das fases; o dado antigo (sem `modo`) que trazia duração junto dos intervalos usa a duração.
 */
export function tempoTotalDoBloco(c: Cardio): number | null {
  if (modoDoBloco(c) === 'CONTINUO' || (c.modo == null && c.duracaoMin != null)) return c.duracaoMin != null ? c.duracaoMin * 60 : null;
  const fases = fasesDoBloco(c);
  return fases.length ? fases.reduce((t, f) => t + f.segundos, 0) : null;
}

/** Soma dos blocos; nulo se algum bloco não tem tempo (um "~30 min" parcial enganaria) ou não há bloco. */
export function tempoTotalDoCardio(blocos: readonly Cardio[]): number | null {
  if (!blocos.length) return null;
  let total = 0;
  for (const b of blocos) {
    const t = tempoTotalDoBloco(b);
    if (t == null) return null;
    total += t;
  }
  return total;
}

/** "~20 min": arredonda uma vez, no total, para o minuto mais próximo (nunca "~0 min"). */
export const minutosAproximados = (segundos: number): string => `~${Math.max(1, Math.round(segundos / 60))} min`;

/** "30 s", "3 min", "1 min 30 s" (o mesmo formato do descanso das séries). */
export const tempoCurto = (segundos: number): string => rotuloDescanso(segundos);

export const textoDaZona = (zona: number): string => `Zona ${zona}`;

/** "10 × 30 s" e, com o esforço máximo, "6 × 30 s all-out". */
function voltasEEstimulo(c: Cardio, comEsforco: boolean): string | null {
  const i = c.intervalos;
  if (!i?.voltas || !i.trabalhoSeg) return null;
  return `${i.voltas} × ${tempoCurto(i.trabalhoSeg)}${comEsforco && c.esforcoMaximo ? ' all-out' : ''}`;
}

/** " / 30 s" e, com o tipo, " / 3 min (passiva)"; vazio sem recuperação. */
function recuperacao(c: Cardio, comTipo: boolean): string {
  const r = c.intervalos?.descansoSeg;
  if (!r) return '';
  return ` / ${tempoCurto(r)}${comTipo && c.recuperacaoTipo ? ` (${ROTULOS_DA_RECUPERACAO[c.recuperacaoTipo]})` : ''}`;
}

export const ROTULOS_DA_RECUPERACAO: Record<TipoDeRecuperacao, string> = { ATIVA: 'ativa', PASSIVA: 'passiva' };

function partesDoContinuo(c: Cardio): string[] {
  const partes: string[] = [];
  if (c.duracaoMin != null) partes.push(`${c.duracaoMin} min`);
  if (c.distanciaKm != null) partes.push(`${numeroParaTela(c.distanciaKm)} km`);
  return partes;
}

/** Resumo do inspetor: "10 × 30 s / 30 s · ~20 min no total"; contínuo, "30 min · 5 km"; nulo enquanto falta o essencial. */
export function resumoDoBloco(c: Cardio): string | null {
  if (modoDoBloco(c) === 'CONTINUO') return partesDoContinuo(c).join(' · ') || null;
  const base = voltasEEstimulo(c, false);
  if (!base) return null;
  const t = tempoTotalDoBloco(c);
  return `${base}${recuperacao(c, false)}${t != null ? ` · ${minutosAproximados(t)} no total` : ''}`;
}

/** Lista de exercícios e cabeçalho: "SIT · 6 × 30 s · ~25 min", "Contínuo · 30 min", "2 blocos · ~30 min". */
export function resumoDaLista(blocos: readonly Cardio[]): string {
  if (!blocos.length) return 'Sem bloco de cardio';
  const t = tempoTotalDoCardio(blocos);
  if (blocos.length > 1) return `${blocos.length} blocos${t != null ? ` · ${minutosAproximados(t)}` : ''}`;
  const c = blocos[0];
  if (modoDoBloco(c) === 'CONTINUO') return ['Contínuo', ...partesDoContinuo(c)].join(' · ');
  return [definicaoDoProtocolo(protocoloDoBloco(c)).curto, voltasEEstimulo(c, false), t != null ? minutosAproximados(t) : null].filter(Boolean).join(' · ');
}

/**
 * As partes da prévia; a primeira é sempre o modo ou o protocolo ("Contínuo", "SIT"), que o cartão do aluno põe no
 * cabeçalho do bloco, e o resto vai na linha de baixo.
 */
export function partesDaPrevia(c: Cardio): string[] {
  const zona = c.zona != null ? textoDaZona(c.zona) : null;
  if (modoDoBloco(c) === 'CONTINUO') return ['Contínuo', ...partesDoContinuo(c), c.ritmo?.trim() || null, zona].filter((p): p is string => !!p);
  const base = voltasEEstimulo(c, true);
  const t = tempoTotalDoBloco(c);
  return [definicaoDoProtocolo(protocoloDoBloco(c)).curto, base ? `${base}${recuperacao(c, true)}` : null, zona, t != null ? minutosAproximados(t) : null]
    .filter((p): p is string => !!p);
}

/** Uma linha por bloco, como o aluno lê: "SIT · 6 × 30 s all-out / 3 min · ~25 min", "Contínuo · 30 min · 6 min/km · Zona 2". */
export const previaDoBloco = (c: Cardio): string => partesDaPrevia(c).join(' · ');

/** O que fica fora das voltas, para o aluno: "Aquecimento 4 min · Desaquecimento 3 min"; nulo sem os dois. */
export function textoDoAquecimento(c: Cardio): string | null {
  if (modoDoBloco(c) !== 'INTERVALADO') return null;
  const partes = [c.aquecimentoSeg ? `Aquecimento ${tempoCurto(c.aquecimentoSeg)}` : null, c.desaquecimentoSeg ? `Desaquecimento ${tempoCurto(c.desaquecimentoSeg)}` : null];
  return partes.filter(Boolean).join(' · ') || null;
}

export const previaParaOAluno = (blocos: readonly Cardio[]): string[] => blocos.map(previaDoBloco);

/**
 * Timer do intervalado, só no aparelho (sem registro na API). Guarda o instante de início no relógio de parede, como o
 * descanso (`dominio/descanso`): a aba em segundo plano ou o aparelho travado não atrasam a contagem. Pausar congela o
 * instante; retomar empurra o início pelo tempo parado; pular adianta o início pelo que faltava da fase.
 */
export interface TimerDoBloco { inicioEm: number; pausadoEm: number | null }

export const iniciarTimer = (agora: number): TimerDoBloco => ({ inicioEm: agora, pausadoEm: null });
export const pausarTimer = (t: TimerDoBloco, agora: number): TimerDoBloco => (t.pausadoEm != null ? t : { ...t, pausadoEm: agora });
export const retomarTimer = (t: TimerDoBloco, agora: number): TimerDoBloco =>
  t.pausadoEm == null ? t : { inicioEm: t.inicioEm + (agora - t.pausadoEm), pausadoEm: null };

export interface RelogioDoTimer {
  /** Posição da fase em `fasesDoBloco`; igual ao número de fases quando acabou. */
  indice: number;
  fase: Fase | null;
  proxima: Fase | null;
  restanteMs: number;
  /** Arredondado para cima: "0:01" até zerar, como a barra de descanso. */
  segundos: number;
  texto: string;
  /** 0 a 1 do que falta da fase. */
  proporcao: number;
  terminado: boolean;
  pausado: boolean;
}

/** O que o timer mostra agora; relógio injetado (`agora` em ms), sem temporizador aqui. */
export function relogioDoTimer(t: TimerDoBloco, fases: readonly Fase[], agora: number): RelogioDoTimer {
  const decorrido = Math.max(0, (t.pausadoEm ?? agora) - t.inicioEm);
  const pausado = t.pausadoEm != null;
  let fim = 0;
  for (let i = 0; i < fases.length; i++) {
    const duracao = fases[i].segundos * 1000;
    fim += duracao;
    if (decorrido < fim) {
      const restanteMs = fim - decorrido;
      const segundos = Math.ceil(restanteMs / 1000);
      return { indice: i, fase: fases[i], proxima: fases[i + 1] ?? null, restanteMs, segundos, texto: textoDoTempo(segundos), proporcao: restanteMs / duracao, terminado: false, pausado };
    }
  }
  return { indice: fases.length, fase: null, proxima: null, restanteMs: 0, segundos: 0, texto: textoDoTempo(0), proporcao: 0, terminado: true, pausado };
}

/** Vai direto ao começo da próxima fase (pausado continua pausado); depois da última, o timer acaba. */
export function pularFase(t: TimerDoBloco, fases: readonly Fase[], agora: number): TimerDoBloco {
  const r = relogioDoTimer(t, fases, agora);
  return r.terminado ? t : { ...t, inicioEm: t.inicioEm - r.restanteMs };
}

const NOMES_DAS_FASES: Record<FaseDoIntervalado, string> = { AQUECIMENTO: 'Aquecimento', ESTIMULO: 'Estímulo', RECUPERACAO: 'Recuperação', DESAQUECIMENTO: 'Desaquecimento' };

/** "Estímulo", "Recuperação passiva", "Aquecimento". */
export function nomeDaFase(f: Fase, c: Cardio): string {
  if (f.fase === 'RECUPERACAO' && c.recuperacaoTipo) return `Recuperação ${ROTULOS_DA_RECUPERACAO[c.recuperacaoTipo]}`;
  return NOMES_DAS_FASES[f.fase];
}

/** Intensidade escrita pelo treinador, só no estímulo: "All-out" ou "Zona 5"; nulo sem ela (nada inventado). */
export function esforcoDaFase(f: Fase, c: Cardio): string | null {
  if (f.fase !== 'ESTIMULO') return null;
  if (c.esforcoMaximo) return 'All-out';
  return c.zona != null ? textoDaZona(c.zona) : null;
}

/** "3 de 10" no estímulo e na recuperação da volta; nulo no aquecimento e no desaquecimento. */
export const voltaDaFase = (f: Fase, c: Cardio): string | null =>
  f.volta != null && c.intervalos?.voltas ? `${f.volta} de ${c.intervalos.voltas}` : null;

/** O que o leitor de tela anuncia na troca de fase (uma vez, nunca a cada segundo): "Estímulo, All-out, volta 3 de 10, 30 s". */
export function anuncioDaFase(f: Fase, c: Cardio): string {
  const volta = voltaDaFase(f, c);
  return [nomeDaFase(f, c), esforcoDaFase(f, c), volta ? `volta ${volta}` : null, tempoCurto(f.segundos)].filter(Boolean).join(', ');
}

const inteiroEntre = (v: number | null | undefined, min: number, max: number) => v != null && Number.isInteger(v) && v >= min && v <= max;
const SO_NO_INTERVALADO = 'Só vale no intervalado.';
const SO_NO_CONTINUO = 'Só vale no contínuo.';
const PROTOCOLOS_VALIDOS = new Set<string>(PROTOCOLOS.map((p) => p.codigo));

/**
 * Erros do bloco, por campo (o mesmo caminho do 422 da API, sem o prefixo `cardio.`), um erro por problema: no contínuo
 * "basta um entre duração e distância" sai só em `duracaoMin`. O contínuo nunca leva `modo` e usa sempre estas regras
 * (o dado antigo sem intervalos já exigia duração ou distância, com os mesmos limites); o intervalado sem `modo` (dado
 * antigo) segue as regras antigas (`problemasDoCardio`). Textos fixos, sem o valor digitado; o servidor repete os mesmos (passo P1).
 */
export function erroDoBloco(c: Cardio): Problemas {
  if (c.modo == null && c.intervalos != null) return problemasDoCardio(c);
  const p: Problemas = {};
  if (c.zona != null && !inteiroEntre(c.zona, 1, 5)) p.zona = 'Zona de 1 a 5.';
  if (modoDoBloco(c) === 'CONTINUO') {
    if (c.duracaoMin == null && c.distanciaKm == null) p.duracaoMin = 'Informe a duração ou a distância.';
    else if (c.duracaoMin != null && !inteiroEntre(c.duracaoMin, 1, 600)) p.duracaoMin = 'Duração de 1 a 600 minutos.';
    if (c.distanciaKm != null && !(Number.isFinite(c.distanciaKm) && c.distanciaKm > 0 && c.distanciaKm <= 1000)) p.distanciaKm = 'Distância maior que zero e até 1000 km.';
    if (c.ritmo != null && c.ritmo.length > 40) p.ritmo = 'Ritmo com no máximo 40 caracteres.';
    if (c.intervalos != null) p.intervalos = SO_NO_INTERVALADO;
    for (const campo of ['protocolo', 'aquecimentoSeg', 'desaquecimentoSeg', 'recuperacaoTipo'] as const) {
      if (c[campo] != null) p[campo] = SO_NO_INTERVALADO;
    }
    if (c.esforcoMaximo) p.esforcoMaximo = SO_NO_INTERVALADO;
    return p;
  }
  for (const campo of ['duracaoMin', 'distanciaKm', 'ritmo'] as const) if (c[campo] != null) p[campo] = SO_NO_CONTINUO;
  if (c.protocolo != null && !PROTOCOLOS_VALIDOS.has(c.protocolo)) p.protocolo = 'Protocolo inválido.';
  const i = c.intervalos;
  if (!inteiroEntre(i?.trabalhoSeg, 1, 3600)) p['intervalos.trabalhoSeg'] = 'Estímulo de 1 s a 60 min.';
  if (i?.descansoSeg != null && !inteiroEntre(i.descansoSeg, 0, 3600)) p['intervalos.descansoSeg'] = 'Recuperação de 0 a 60 min.';
  if (!inteiroEntre(i?.voltas, 1, 100)) p['intervalos.voltas'] = 'Voltas de 1 a 100.';
  if (c.aquecimentoSeg != null && !inteiroEntre(c.aquecimentoSeg, 0, 3600)) p.aquecimentoSeg = 'Aquecimento de 0 a 60 min.';
  if (c.desaquecimentoSeg != null && !inteiroEntre(c.desaquecimentoSeg, 0, 3600)) p.desaquecimentoSeg = 'Desaquecimento de 0 a 60 min.';
  if (c.zona != null && c.esforcoMaximo) p.esforcoMaximo = 'Use a zona ou o esforço máximo, não os dois.';
  return p;
}

/**
 * Tempo digitado em segundos: "75" (na unidade padrão do campo: segundos no estímulo e na recuperação, minutos no
 * aquecimento), "1:30", "2 min", "90 s", "1 min 30 s", "1,5 min". Vazio ou ilegível = nulo (a tela diferencia pelo
 * texto: digitado e nulo = "Tempo inválido").
 */
export function segundosDoTexto(texto: string, unidadePadrao: 's' | 'min'): number | null {
  const t = texto.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  const relogio = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (relogio) return Number(relogio[1]) * 60 + Number(relogio[2]);
  const misto = /^(\d+)\s*m(?:in)?\s*(\d+)\s*(?:s|seg)?$/.exec(t);
  if (misto) return Number(misto[1]) * 60 + Number(misto[2]);
  const simples = /^(\d+(?:\.\d+)?)\s*(min|m|s|seg)?$/.exec(t);
  if (!simples) return null;
  const emMinutos = simples[2] === 'min' || simples[2] === 'm' || (simples[2] == null && unidadePadrao === 'min');
  return Math.round(Number(simples[1]) * (emMinutos ? 60 : 1));
}

// ---- Editor do bloco (passo P2: o inspetor do exercício de cardio no editor de treino) ----

/**
 * Troca Contínuo ⇄ Intervalado. O contínuo volta vazio, sem `modo` (sai com as chaves de sempre, D3), e guarda só a zona
 * (o esforço máximo não existe no contínuo, D5). O intervalado nasce Personalizado, sem número nenhum: os valores típicos
 * só entram quando o treinador escolhe um protocolo (o app não sugere tempo de estímulo por conta própria).
 */
export function trocarModoDoBloco(c: Cardio, modo: ModoDeCardio): Cardio {
  if (modoDoBloco(c) === modo) return c;
  if (modo === 'CONTINUO') return { ...blocoContinuo(), zona: c.esforcoMaximo ? null : (c.zona ?? null) };
  return padraoDoProtocolo('PERSONALIZADO', { ...c, intervalos: null });
}

type ParteDoIntervalado = Omit<Partial<Cardio>, 'intervalos'> & { intervalos?: Partial<NonNullable<Cardio['intervalos']>> };

/**
 * Uma mudança no intervalado: o bloco passa a `modo: "INTERVALADO"` (também o antigo, sem `modo`, que só muda de regra
 * quando o treinador mexe nele, D3) e perde duração, distância e ritmo, que o intervalado novo não aceita.
 */
export function alterarIntervalado(c: Cardio, parte: ParteDoIntervalado): Cardio {
  const { intervalos, ...resto } = parte;
  const i = c.intervalos;
  return {
    ...c, modo: 'INTERVALADO', duracaoMin: null, distanciaKm: null, ritmo: null, ...resto,
    intervalos: { trabalhoSeg: i?.trabalhoSeg ?? null, descansoSeg: i?.descansoSeg ?? null, voltas: i?.voltas ?? null, ...intervalos },
  };
}

const emLista = (partes: string[]) => (partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`);

/**
 * Intervalado antigo (sem `modo`) que ainda guarda duração, distância ou ritmo: o aviso que o editor mostra ANTES de o
 * treinador mexer, porque a primeira mudança tira esses valores. Nulo quando não há nada a perder.
 */
export function avisoDoIntervaladoAntigo(c: Cardio): string | null {
  if (c.modo != null || !c.intervalos) return null;
  const partes = [c.duracaoMin != null ? 'a duração' : null, c.distanciaKm != null ? 'a distância' : null, c.ritmo?.trim() ? 'o ritmo' : null]
    .filter((p): p is string => !!p);
  if (!partes.length) return null;
  return `Este bloco veio do formato antigo. Ao mudar qualquer campo, ${emLista(partes)} ${partes.length > 1 ? 'saem' : 'sai'}: o intervalado não usa.`;
}

/** O bloco usa alguma chave nova (`modo` em diante), que o app do aluno das lojas recusa no pacote offline (D16). Espelho de `Cardio.temChaveNova` na API. */
export const temChaveNovaDoCardio = (c: Cardio): boolean =>
  c.modo != null || c.protocolo != null || c.aquecimentoSeg != null || c.desaquecimentoSeg != null || c.recuperacaoTipo != null || c.esforcoMaximo != null;

export const AVISO_DO_INTERVALADO_DESLIGADO = 'Cardio intervalado ainda não liberado: este bloco só pode ser salvo depois da liberação.';
export const AVISO_DO_INTERVALADO_ANTIGO_DESLIGADO = 'Cardio intervalado ainda não liberado: este bloco fica como está e só pode ser alterado depois da liberação.';

/**
 * Com `cardioIntervaladoHabilitado` desligado (D16), o intervalado (novo ou antigo) fica só para leitura no editor: mexer
 * nele grava `modo` e o servidor recusa. Nulo = editável. O novo não salva; o antigo, sem chave nova, salva como está.
 */
export function avisoDoIntervaladoDesligado(c: Cardio, liberado: boolean): string | null {
  if (liberado) return null;
  if (temChaveNovaDoCardio(c)) return AVISO_DO_INTERVALADO_DESLIGADO;
  return modoDoBloco(c) === 'INTERVALADO' ? AVISO_DO_INTERVALADO_ANTIGO_DESLIGADO : null;
}

/** O esforço do bloco numa escolha só: zona de 1 a 5 ou "Máximo (all-out)"; nunca os dois (D5). */
export type EsforcoDoBloco = number | 'MAXIMO' | null;
export const esforcoDoBloco = (c: Cardio): EsforcoDoBloco => (c.esforcoMaximo ? 'MAXIMO' : (c.zona ?? null));
export const comEsforco = (v: EsforcoDoBloco): Pick<Cardio, 'zona' | 'esforcoMaximo'> =>
  v === 'MAXIMO' ? { zona: null, esforcoMaximo: true } : { zona: v, esforcoMaximo: null };

/** As opções do esforço: as zonas e, só no intervalado, o máximo. */
export function opcoesDeEsforco(modo: ModoDeCardio): { valor: EsforcoDoBloco; rotulo: string }[] {
  const zonas = [1, 2, 3, 4, 5].map((z) => ({ valor: z as EsforcoDoBloco, rotulo: textoDaZona(z) }));
  return modo === 'INTERVALADO' ? [...zonas, { valor: 'MAXIMO', rotulo: 'Máximo (all-out)' }] : zonas;
}

export type CampoDeTempo = 'aquecimento' | 'estimulo' | 'recuperacao' | 'desaquecimento';

/** Unidade do número digitado sem unidade (D10): segundos no estímulo e na recuperação, minutos nas pontas. */
export const UNIDADE_DO_TEMPO: Record<CampoDeTempo, 's' | 'min'> = { aquecimento: 'min', estimulo: 's', recuperacao: 's', desaquecimento: 'min' };

/**
 * Atalhos da lista "Digite ou escolha" de cada tempo, como os do descanso da série: só um atalho de digitação, não uma
 * sugestão de prescrição (os valores de cada protocolo vêm só de `padraoDoProtocolo`, quando o treinador o escolhe).
 */
const ATALHOS_DE_TEMPO: Record<CampoDeTempo, readonly number[]> = {
  aquecimento: [120, 180, 300, 600],
  estimulo: [10, 15, 20, 30, 45, 60, 120, 180, 240],
  recuperacao: [10, 15, 20, 30, 45, 60, 90, 120, 180, 240],
  desaquecimento: [120, 180, 300, 600],
};

/** O texto da opção vazia: o estímulo é obrigatório; os outros, opcionais. */
const SEM_TEMPO: Record<CampoDeTempo, string | null> = { aquecimento: 'Sem aquecimento', estimulo: null, recuperacao: 'Sem recuperação', desaquecimento: 'Sem desaquecimento' };

/** As opções do tempo, com o valor gravado entre elas quando não é um atalho (nunca some) e a opção vazia dos opcionais. */
export function opcoesDeTempo(campo: CampoDeTempo, atual: number | null | undefined): { valor: number | null; rotulo: string }[] {
  const base = ATALHOS_DE_TEMPO[campo];
  const lista = atual != null && !base.includes(atual) ? [...base, atual].sort((a, b) => a - b) : [...base];
  const vazio = SEM_TEMPO[campo];
  return [...(vazio ? [{ valor: null, rotulo: vazio }] : []), ...lista.map((s) => ({ valor: s as number | null, rotulo: tempoCurto(s) }))];
}

/**
 * O tempo digitado (`segundosDoTexto`) dentro do limite do contrato: estímulo de 1 s a 60 min, os outros de 0 a 60 min.
 * Fora disso, ilegível ou vazio, nulo (a lista não oferece nada e diz o formato).
 */
export function lerTempo(campo: CampoDeTempo, texto: string): number | null {
  const s = segundosDoTexto(texto, UNIDADE_DO_TEMPO[campo]);
  if (s == null || s > 3600 || s < (campo === 'estimulo' ? 1 : 0)) return null;
  return s;
}

/** Ritmo como o aluno lê: "6" ou "5:30" ganham " min/km"; texto já escrito fica como está; vazio = nulo. */
export function ritmoTexto(entrada: string | null | undefined): string | null {
  const t = entrada?.trim() ?? '';
  if (!t) return null;
  return /^\d{1,2}(?:[:.,]\d{1,2})?$/.test(t) ? `${t} min/km` : t;
}

/** Biblioteca › exercício de cardio. */
export const TIPOS_DE_CARDIO: readonly { codigo: TipoDeCardio; rotulo: string }[] = [
  { codigo: 'ESTEIRA', rotulo: 'Esteira' },
  { codigo: 'BIKE', rotulo: 'Bike' },
  { codigo: 'ELIPTICO', rotulo: 'Elíptico' },
  { codigo: 'ESCADA', rotulo: 'Escada' },
  { codigo: 'REMO', rotulo: 'Remo' },
  { codigo: 'CORRIDA_AO_AR_LIVRE', rotulo: 'Corrida ao ar livre' },
  { codigo: 'NATACAO', rotulo: 'Natação' },
  { codigo: 'OUTRO', rotulo: 'Outro' },
];

export const MEDIDAS_DE_CARDIO: readonly { codigo: MedidaDeCardio; rotulo: string }[] = [
  { codigo: 'DISTANCIA', rotulo: 'Distância' },
  { codigo: 'RITMO', rotulo: 'Ritmo' },
];

/**
 * O campo aparece no contínuo: sempre com valor já gravado (nunca esconde dado); sem a medida na biblioteca, some.
 * `medidas` ausente (cardio manual ou exercício de antes da V113) = as duas.
 */
export function mostraMedida(medida: MedidaDeCardio, medidas: readonly MedidaDeCardio[] | null | undefined, c: Cardio): boolean {
  const valor = medida === 'DISTANCIA' ? c.distanciaKm : c.ritmo;
  return valor != null || medidas == null || medidas.includes(medida);
}
