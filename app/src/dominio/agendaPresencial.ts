import type { Compromisso, CompromissoDoAluno, CompromissoRequest, SituacaoCompromisso } from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { compararItens, rotuloDoDia } from './agenda';
import { dataSemAnoCorrente } from './datasRelativas';
import { dataDaTela, dataParaTela, somarDias } from './formatos';

/**
 * Agenda presencial do consultório (compromissos marcados pela equipe com um aluno) e a tela Agenda, que mostra os
 * compromissos junto das atualizações. Regras puras: o "agora" chega por parâmetro.
 *
 * Fuso: tudo em Brasília (America/Sao_Paulo), nunca o fuso do aparelho. O Brasil não tem horário de verão desde 2019,
 * então Brasília é sempre UTC−3 (a mesma conta de `hojeEmBrasilia` do financeiro); a API manda `data`/`hora` já em
 * Brasília e o app só converte o fim (para o compromisso que atravessa a meia-noite).
 */

/** Limites da API (`AgendaDtos`). */
export const LIMITES_COMPROMISSO = { duracaoMinima: 5, duracaoMaxima: 480, local: 120, observacao: 500, janelaDias: 62 } as const;
/** Duração sugerida num compromisso novo. */
export const DURACAO_PADRAO = 60;
/** Durações oferecidas como atalho no formulário (o campo aceita qualquer valor de 5 a 480). */
export const DURACOES_SUGERIDAS = [15, 30, 45, 60, 90] as const;

const OFFSET_BRASILIA_MS = -3 * 3600 * 1000;

/** Data civil (AAAA-MM-DD) de Brasília de um instante ISO. */
export function dataEmBrasilia(instante: string | Date): string {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante.getTime();
  return new Date(ms + OFFSET_BRASILIA_MS).toISOString().slice(0, 10);
}

/** Hora (HH:MM) de Brasília de um instante ISO. */
export function horaEmBrasilia(instante: string | Date): string {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante.getTime();
  return new Date(ms + OFFSET_BRASILIA_MS).toISOString().slice(11, 16);
}

/** Hoje em Brasília, qualquer que seja o fuso do aparelho. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return dataEmBrasilia(agora);
}

/** Instante ISO de uma data e hora de Brasília (`2026-11-10`, `23:30` → `2026-11-11T02:30:00.000Z`). */
export function instanteDeBrasilia(data: string, hora: string): string {
  const [a, m, d] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return new Date(Date.UTC(a, m - 1, d, h, min) - OFFSET_BRASILIA_MS).toISOString();
}

// ---- Sobreposição ----

export interface Intervalo { inicio: string; fim: string }

/**
 * Dois intervalos se sobrepõem quando um começa antes de o outro terminar (mesma regra da API): encostar (um termina às
 * 10:00 e o outro começa às 10:00) não é sobrepor.
 */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(a.fim) > Date.parse(b.inicio);
}

/**
 * Aviso antes de salvar: o compromisso já carregado do mesmo responsável, não cancelado e que não é o próprio, que se
 * sobrepõe ao horário escolhido. Só um aviso (a lista na tela pode estar filtrada ou velha): quem decide é a API (409
 * `HORARIO_OCUPADO`).
 */
export function conflitoNaLista(lista: readonly Compromisso[], pedido: { id?: string | null; responsavelId: string; inicio: string; fim: string }): Compromisso | null {
  return lista.find((c) => c.id !== pedido.id && c.responsavelId === pedido.responsavelId && c.situacao !== 'CANCELADO'
    && sobrepoe(c, pedido)) ?? null;
}

// ---- Visões Dia e Semana ----

export type VisaoDaAgenda = 'dia' | 'semana';
/** A semana é o dia de referência e os 7 seguintes (oito dias, como a agenda das atualizações sempre mostrou). */
export const DIAS_DA_SEMANA_DA_AGENDA = 8;

export function lerVisao(valor: string | null | undefined): VisaoDaAgenda {
  return valor === 'dia' ? 'dia' : 'semana';
}

/** Data de referência do endereço; inválida ou ausente = hoje. */
export function lerDataDeReferencia(valor: string | null | undefined, hoje: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && dataDaTela(dataParaTela(valor)) === valor ? valor : hoje;
}

/** Período pedido à API: o dia, ou o dia e os 7 seguintes. */
export function periodoDaVisao(visao: VisaoDaAgenda, referencia: string): { de: string; ate: string } {
  return { de: referencia, ate: visao === 'dia' ? referencia : somarDias(referencia, DIAS_DA_SEMANA_DA_AGENDA - 1) };
}

/** Anterior/próximo: um dia na visão Dia, sete na Semana (o último dia de uma é o primeiro da seguinte). */
export function deslocarReferencia(visao: VisaoDaAgenda, referencia: string, sentido: 1 | -1): string {
  return somarDias(referencia, sentido * (visao === 'dia' ? 1 : DIAS_DA_SEMANA_DA_AGENDA - 1));
}

/** "Segunda-feira, 03/11" (dia) ou "03/11 a 10/11" (semana). */
export function tituloDoPeriodo(visao: VisaoDaAgenda, referencia: string, hoje: string): string {
  const { de, ate } = periodoDaVisao(visao, referencia);
  if (visao === 'dia') return `${rotuloDoDia(de, hoje)}, ${dataSemAnoCorrente(de, hoje)}`;
  return `${dataSemAnoCorrente(de, hoje)} a ${dataSemAnoCorrente(ate, hoje)}`;
}

/** Datas de Brasília que o compromisso toca: o das 23:30 de 60 minutos aparece no dia e no seguinte. */
export function diasDoCompromisso(c: Pick<Compromisso, 'inicio' | 'fim'>): string[] {
  const primeiro = dataEmBrasilia(c.inicio);
  const ultimo = dataEmBrasilia(new Date(Date.parse(c.fim) - 1));
  const dias = [primeiro];
  while (dias[dias.length - 1] < ultimo) dias.push(somarDias(dias[dias.length - 1], 1));
  return dias;
}

export interface DiaDaAgendaPresencial {
  /** Data civil; `null` no grupo das atualizações sem data. */
  data: string | null;
  titulo: string;
  compromissos: Compromisso[];
  atualizacoes: AtualizacaoDaLista[];
}

/**
 * Os dias do período, todos (dia vazio aparece com a faixa "Nada marcado"), com os compromissos que tocam o dia (por
 * hora de início; o que começou na véspera vem primeiro) e as atualizações que vencem nele (por nome). Atualização sem
 * data só entra quando o período inclui hoje (a lista `PROXIMAS` é de hoje em diante), num grupo no fim.
 */
export function diasDaAgenda(de: string, ate: string, hoje: string, compromissos: readonly Compromisso[],
  atualizacoes: readonly AtualizacaoDaLista[]): DiaDaAgendaPresencial[] {
  const dias = new Map<string, DiaDaAgendaPresencial>();
  for (let data = de; data <= ate; data = somarDias(data, 1)) {
    dias.set(data, { data, titulo: `${rotuloDoDia(data, hoje)}, ${dataSemAnoCorrente(data, hoje)}`, compromissos: [], atualizacoes: [] });
  }
  for (const c of compromissos) {
    for (const data of diasDoCompromisso(c)) dias.get(data)?.compromissos.push(c);
  }
  const semData: AtualizacaoDaLista[] = [];
  for (const a of atualizacoes) {
    const data = a.dataAtualizacao?.slice(0, 10);
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) semData.push(a);
    else dias.get(data)?.atualizacoes.push(a);
  }
  const lista = [...dias.values()];
  for (const dia of lista) {
    dia.compromissos.sort((x, y) => Date.parse(x.inicio) - Date.parse(y.inicio) || x.id.localeCompare(y.id));
    dia.atualizacoes.sort(compararItens);
  }
  if (semData.length && de <= hoje && hoje <= ate) {
    lista.push({ data: null, titulo: 'Sem data', compromissos: [], atualizacoes: semData.sort(compararItens) });
  }
  return lista;
}

/** Resumo na faixa do dia: "Nada marcado", "1 compromisso", "2 compromissos · 1 atualização". */
export function resumoDoDia(compromissos: number, atualizacoes: number): string {
  const partes: string[] = [];
  if (compromissos > 0) partes.push(`${compromissos} ${compromissos === 1 ? 'compromisso' : 'compromissos'}`);
  if (atualizacoes > 0) partes.push(`${atualizacoes} ${atualizacoes === 1 ? 'atualização' : 'atualizações'}`);
  return partes.length ? partes.join(' · ') : 'Nada marcado';
}

// ---- Textos ----

const SITUACOES: Record<SituacaoCompromisso, { texto: string; tipo: TipoSelo }> = {
  AGENDADO: { texto: 'Agendado', tipo: 'atencao' },
  REALIZADO: { texto: 'Realizado', tipo: 'sucesso' },
  FALTOU: { texto: 'Faltou', tipo: 'perigo' },
  CANCELADO: { texto: 'Cancelado', tipo: 'neutro' },
};

/** Selo da situação (status sempre com texto; nunca a cor da marca). */
export function seloDaSituacao(situacao: SituacaoCompromisso): { texto: string; tipo: TipoSelo } {
  return SITUACOES[situacao] ?? { texto: situacao, tipo: 'neutro' };
}

export const OPCOES_SITUACAO: { valor: SituacaoCompromisso | 'TODAS'; rotulo: string }[] = [
  { valor: 'TODAS', rotulo: 'Todas' },
  { valor: 'AGENDADO', rotulo: 'Agendados' },
  { valor: 'REALIZADO', rotulo: 'Realizados' },
  { valor: 'FALTOU', rotulo: 'Faltas' },
  { valor: 'CANCELADO', rotulo: 'Cancelados' },
];

export function lerSituacao(valor: string | null | undefined): SituacaoCompromisso | null {
  return valor === 'AGENDADO' || valor === 'REALIZADO' || valor === 'FALTOU' || valor === 'CANCELADO' ? valor : null;
}

/** "09:00–10:00", ou "23:30–00:30 (termina no dia seguinte)" quando atravessa a meia-noite. */
export function textoDoHorario(c: Pick<Compromisso, 'inicio' | 'fim' | 'hora' | 'horaFim'>): string {
  const vira = dataEmBrasilia(c.inicio) !== dataEmBrasilia(new Date(Date.parse(c.fim) - 1));
  return `${c.hora}–${c.horaFim}${vira ? ' (termina no dia seguinte)' : ''}`;
}

/** "1 h 30 min", "45 min", "2 h". */
export function textoDaDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Linha de metadados na agenda: "Compromisso · 09:00–10:00 · Sala 2 · com Ana". */
export function metadadosDoCompromisso(c: Compromisso): string {
  const partes = ['Compromisso', textoDoHorario(c)];
  if (c.local) partes.push(c.local);
  if (c.responsavelNome) partes.push(`com ${c.responsavelNome}`);
  return partes.join(' · ');
}

/** Para o aluno: "Terça-feira, 04/11 · 09:00–10:00" e, abaixo, "Sala 2 · com Ana" (sem o que não existe). */
export function textosDoCompromissoDoAluno(c: CompromissoDoAluno, hoje: string): { titulo: string; detalhe: string | null } {
  const titulo = `${rotuloDoDia(c.data, hoje)}, ${dataSemAnoCorrente(c.data, hoje)} · ${textoDoHorario(c)}`;
  const partes = [c.local, c.responsavelNome ? `com ${c.responsavelNome}` : null].filter((p): p is string => !!p);
  return { titulo, detalhe: partes.length ? partes.join(' · ') : null };
}

// ---- Ações sobre a situação ----

export interface AcaoDeSituacao {
  situacao: SituacaoCompromisso;
  rotulo: string;
  /** Desabilitada, com o porquê (vai ao `motivo` do botão). */
  motivo?: string;
  /** Pede confirmação (cancelar). */
  confirmar?: boolean;
  perigo?: boolean;
}

/**
 * O que dá para fazer com o compromisso agora (mesmas regras da API): realizado e falta só depois do início; cancelar
 * só o que está agendado; o que não está agendado pode voltar a agendado (o cancelado volta a ocupar o horário e a API
 * confere o conflito de novo).
 */
export function acoesDeSituacao(c: Pick<Compromisso, 'situacao' | 'inicio'>, agora: Date = new Date()): AcaoDeSituacao[] {
  const comecou = Date.parse(c.inicio) <= agora.getTime();
  const antes = comecou ? undefined : 'Disponível depois do horário do compromisso.';
  const acoes: AcaoDeSituacao[] = [];
  if (c.situacao !== 'REALIZADO' && c.situacao !== 'CANCELADO') acoes.push({ situacao: 'REALIZADO', rotulo: 'Marcar realizado', motivo: antes });
  if (c.situacao !== 'FALTOU' && c.situacao !== 'CANCELADO') acoes.push({ situacao: 'FALTOU', rotulo: 'Marcar falta', motivo: antes });
  if (c.situacao === 'AGENDADO') acoes.push({ situacao: 'CANCELADO', rotulo: 'Cancelar compromisso', confirmar: true, perigo: true });
  else acoes.push({ situacao: 'AGENDADO', rotulo: c.situacao === 'CANCELADO' ? 'Reativar compromisso' : 'Voltar para agendado' });
  return acoes;
}

// ---- Formulário ----

export interface FormularioDoCompromisso {
  alunoId: string;
  responsavelId: string;
  /** DD/MM/AAAA, como no `CampoData`. */
  data: string;
  /** HH:MM digitado. */
  hora: string;
  duracao: string;
  local: string;
  observacao: string;
}

export type ErrosDoCompromisso = Partial<Record<keyof FormularioDoCompromisso, string>>;

export function formularioNovo(responsavelId: string, data: string): FormularioDoCompromisso {
  return { alunoId: '', responsavelId, data: dataParaTela(data), hora: '', duracao: String(DURACAO_PADRAO), local: '', observacao: '' };
}

export function formularioDoCompromisso(c: Compromisso): FormularioDoCompromisso {
  return {
    alunoId: c.alunoId, responsavelId: c.responsavelId ?? '', data: dataParaTela(c.data), hora: c.hora,
    duracao: String(c.duracaoMinutos), local: c.local ?? '', observacao: c.observacao ?? '',
  };
}

/** Máscara da hora enquanto digita: só dígitos, "0930" → "09:30", até 5 caracteres. */
export function mascaraHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

/** "09:30" válida (00:00 a 23:59)? */
export function horaValida(texto: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(texto.trim());
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/**
 * Confere o formulário e monta o pedido. `comObservacao`: só quem grava dado sensível manda a observação (sem a
 * permissão a API ignoraria; aqui ela nem vai).
 */
export function pedidoDoFormulario(f: FormularioDoCompromisso, comObservacao: boolean, versao?: number):
  { erros: ErrosDoCompromisso; pedido: CompromissoRequest | null } {
  const erros: ErrosDoCompromisso = {};
  if (!f.alunoId) erros.alunoId = 'Escolha o aluno.';
  if (!f.responsavelId) erros.responsavelId = 'Escolha o responsável.';
  const data = dataDaTela(f.data);
  if (!data) erros.data = data === null ? 'Informe a data.' : 'Data inválida.';
  const hora = f.hora.trim();
  if (!hora) erros.hora = 'Informe a hora.';
  else if (!horaValida(hora)) erros.hora = 'Use HH:MM, de 00:00 a 23:59.';
  const duracao = /^\d+$/.test(f.duracao.trim()) ? Number(f.duracao.trim()) : NaN;
  if (!Number.isInteger(duracao) || duracao < LIMITES_COMPROMISSO.duracaoMinima || duracao > LIMITES_COMPROMISSO.duracaoMaxima) {
    erros.duracao = `De ${LIMITES_COMPROMISSO.duracaoMinima} a ${LIMITES_COMPROMISSO.duracaoMaxima} minutos.`;
  }
  const local = f.local.trim();
  if (local.length > LIMITES_COMPROMISSO.local) erros.local = `Use até ${LIMITES_COMPROMISSO.local} caracteres.`;
  const observacao = f.observacao.trim();
  if (comObservacao && observacao.length > LIMITES_COMPROMISSO.observacao) {
    erros.observacao = `Use até ${LIMITES_COMPROMISSO.observacao} caracteres.`;
  }
  if (Object.keys(erros).length || !data) return { erros, pedido: null };
  return {
    erros,
    pedido: {
      alunoId: f.alunoId, responsavelId: f.responsavelId, data, hora, duracaoMinutos: duracao,
      local: local || null, observacao: comObservacao ? observacao || null : null,
      ...(versao === undefined ? {} : { versao }),
    },
  };
}

/** Intervalo do pedido (para o aviso de conflito antes de salvar). */
export function intervaloDoPedido(p: Pick<CompromissoRequest, 'data' | 'hora' | 'duracaoMinutos'>): Intervalo {
  const inicio = instanteDeBrasilia(p.data, p.hora);
  return { inicio, fim: new Date(Date.parse(inicio) + p.duracaoMinutos * 60_000).toISOString() };
}
