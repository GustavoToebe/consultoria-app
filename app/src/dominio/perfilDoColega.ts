import { ErroApi } from '@plataforma/web';

import type { ColegaDaLista, PerfilDaComunidade } from '../api/comunidadeTipos';
import { dataParaTela } from './formatos';

// Perfil de um colega e lista de colegas na Comunidade (plano `perfil-estilo-steam`, passo 7). Quem decide o que é visível é
// a API (reserva, idade, quem é colega); aqui só a paginação da lista, os textos dos erros e a grade dos últimos 30 dias.

// ---- Lista de colegas (`GET /aluno/comunidade/perfis?pagina=&tamanho=`) ----

/** Tamanho de cada página pedida à API (o padrão dela). */
export const COLEGAS_POR_PAGINA = 30;

/** Colegas já lidos, na ordem da API (nome sem acento), página a página. `total` é o da API: só serve para saber se há mais. */
export interface ColegasLidos { itens: ColegaDaLista[]; total: number }

export const colegasDaPrimeiraPagina = (p: ColegasLidos): ColegasLidos => ({ itens: p.itens, total: p.total });

/** Ainda há colegas que a tela não mostra ("Ver mais"). O total nunca aparece escrito nem é comparado com nada na tela. */
export const haMaisColegas = (c: ColegasLidos): boolean => c.itens.length < c.total;

/**
 * Página a pedir no "Ver mais". Arredonda para baixo, como os comentários: se alguém reservou o perfil no meio-tempo a lista
 * anda para trás e `página + 1` pularia um colega; pedir a página que contém o próximo e juntar por `autorId` não pula nem repete.
 */
export const proximaPaginaDeColegas = (c: ColegasLidos): number => Math.floor(c.itens.length / COLEGAS_POR_PAGINA);

/** Acrescenta uma página sem repetir colega; página sem nada novo encerra o "Ver mais" em vez de oferecer o mesmo de novo. */
export function juntarPaginaDeColegas(c: ColegasLidos, p: ColegasLidos): ColegasLidos {
  const vistos = new Set(c.itens.map((i) => i.autorId));
  const novos = p.itens.filter((i) => !vistos.has(i.autorId));
  const itens = [...c.itens, ...novos];
  return { itens, total: novos.length === 0 ? Math.min(p.total, itens.length) : p.total };
}

/** Nome acessível da linha: nome, apelido e nível, na ordem em que aparecem. */
export const rotuloDoColega = (c: Pick<ColegaDaLista, 'nome' | 'apelido' | 'nivel'>): string =>
  [c.nome, c.apelido ? `apelido ${c.apelido}` : null, textoDoNivel(c.nivel)].filter(Boolean).join(', ');

// ---- Perfil ----

export const TEXTO_PERFIL_NAO_ENCONTRADO = 'Perfil não encontrado.';
export const TEXTO_PERFIL_RESERVADO = 'Este aluno reservou o perfil.';
/** 429 do balde de leitura (perfil e lista, 300 por hora): fixo, sem dizer quanto falta. */
export const TEXTO_LIMITE_DE_LEITURA = 'Muitos perfis abertos em pouco tempo. Espere alguns minutos e tente de novo.';
export const TEXTO_PERFIL_SEM_CONEXAO = 'Sem conexão. O perfil aparece quando o aparelho voltar a ter internet.';

/**
 * Como a tela trata um erro da leitura: 404 é um só (equipe, outra consultoria, inativo, inexistente: a API não distingue e a
 * tela também não), sem "Tentar de novo"; 429 é o texto fixo; o resto segue o texto padrão com "Tentar de novo".
 */
export function erroDaLeitura(erro: unknown): 'nao-encontrado' | 'limite' | 'outro' {
  if (erro instanceof ErroApi && erro.status === 404) return 'nao-encontrado';
  if (erro instanceof ErroApi && erro.status === 429) return 'limite';
  return 'outro';
}

/** Perfil reservado visto por outro aluno: só nome e apelido. O próprio aluno vê tudo, mesmo reservado. */
export const soONome = (p: Pick<PerfilDaComunidade, 'reservado' | 'ehVoce'>): boolean => p.reservado && !p.ehVoce;

/** Busca a foto só quando a API disse que há e o perfil está aberto a quem vê (o 404 da foto não distingue os casos). */
export const buscarFotoDoColega = (p: Pick<PerfilDaComunidade, 'reservado' | 'ehVoce' | 'temFoto'>): boolean => !soONome(p) && p.temFoto === true;

export const textoDoNivel = (nivel: number): string => `Nível ${nivel}`;

export const textoDosTreinos = (n: number): string => (n === 1 ? '1 treino concluído' : `${n} treinos concluídos`);

// ---- Atividade: os últimos 30 dias ----

/** Dias da atividade (`diasTreinadosUltimos30`): de hoje−29 a hoje, como a API. */
export const DIAS_DA_ATIVIDADE = 30;

export interface DiaDaAtividade { data: string; treinou: boolean; hoje: boolean }

export interface GradeDaAtividade {
  /** Semanas de domingo a sábado; `null` = dia fora da janela (antes do primeiro ou depois de hoje). */
  semanas: (DiaDaAtividade | null)[][];
  treinados: number;
  /** Frase para o leitor de tela e para a legenda: o número de dias e o período. A cor nunca é a única pista. */
  resumo: string;
}

const somarDias = (iso: string, dias: number): string => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};
const diaDaSemana = (iso: string): number => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};

/**
 * Mini calendário dos últimos 30 dias, em semanas de domingo a sábado (como o calendário do ciclo). `hoje` é o de Brasília,
 * o mesmo da API; dia que a API mandou fora da janela (relógio do aparelho diferente) não conta nem aparece.
 */
export function gradeDaAtividade(diasTreinados: readonly string[], hoje: string): GradeDaAtividade {
  const primeiro = somarDias(hoje, -(DIAS_DA_ATIVIDADE - 1));
  const treinou = new Set(diasTreinados.filter((d) => d >= primeiro && d <= hoje));
  const dias: (DiaDaAtividade | null)[] = Array.from({ length: diaDaSemana(primeiro) }, () => null);
  for (let i = 0; i < DIAS_DA_ATIVIDADE; i++) {
    const data = somarDias(primeiro, i);
    dias.push({ data, treinou: treinou.has(data), hoje: data === hoje });
  }
  while (dias.length % 7) dias.push(null);
  const semanas = Array.from({ length: dias.length / 7 }, (_, s) => dias.slice(s * 7, s * 7 + 7));
  const periodo = `de ${dataParaTela(primeiro)} a ${dataParaTela(hoje)}`;
  const n = treinou.size;
  const resumo = n === 0
    ? `Nenhum dia com treino nos últimos ${DIAS_DA_ATIVIDADE} dias, ${periodo}.`
    : `Treinou em ${n} ${n === 1 ? 'dia' : 'dias'} dos últimos ${DIAS_DA_ATIVIDADE}, ${periodo}.`;
  return { semanas, treinados: n, resumo };
}
