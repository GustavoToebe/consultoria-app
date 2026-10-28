import { contraste, textoSobre } from '../tema/tokens';
import { semanasDoMes, type DiaDoCalendario } from './calendario';
import { dataCurta } from './formatos';

/**
 * Tela "Bom trabalho!" e cartão para compartilhar (frente Engajamento, passo 0.4, decisão P8). O cartão é uma imagem
 * Stories (1080 × 1920) com a marca da consultoria, o número do treino e o calendário do mês com os dias treinados.
 * Nunca leva peso corporal, foto, medidas, dieta nem o nome do aluno; o volume só entra se o aluno ligar. Tudo aqui é
 * regra pura; o desenho é `aluno/CartaoDoTreino` (SVG) e a imagem sai no aparelho, sem servidor.
 */

export const LARGURA_DO_CARTAO = 1080;
export const ALTURA_DO_CARTAO = 1920;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** `12` → `12º`. */
export const ordinal = (n: number) => `${n}º`;

/**
 * A frase da tela. Hoje: "Este é o seu 12º treino." (o total já inclui este). Outra data o total não diz a posição
 * dele, então: "Você já concluiu 12 treinos.". Sem total (nunca baixou, sem internet): nenhuma frase, nada inventado.
 */
export function fraseDoNumero(total: number | null, data: string, hoje: string): string | null {
  if (total == null || total < 1) return null;
  if (data === hoje) return `Este é o seu ${ordinal(total)} treino.`;
  return total === 1 ? 'Você já concluiu 1 treino.' : `Você já concluiu ${total} treinos.`;
}

/** O título grande do cartão: "12º treino", "12 treinos concluídos" ou "Treino concluído" (sem total). */
export function tituloDoCartao(total: number | null, data: string, hoje: string): string {
  if (total == null || total < 1) return 'Treino concluído';
  if (data === hoje) return `${ordinal(total)} treino`;
  return total === 1 ? '1 treino concluído' : `${total} treinos concluídos`;
}

/** Linha do mês: "Outubro de 2026". */
export function tituloDoMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  const nome = MESES[(m ?? 1) - 1] ?? '';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

/**
 * Dias treinados no mês da data: dia com treino concluído (aparelho ou servidor) ou com ao menos uma série marcada como
 * feita. Só o que o app conhece; dia sem registro não é inventado.
 */
export function diasTreinadosNoMes(
  data: string,
  conclusoes: readonly { data: string; concluida: boolean }[],
  registros: readonly { data: string; concluida: boolean }[],
): Set<string> {
  const mes = data.slice(0, 7);
  const dias = new Set<string>();
  for (const c of conclusoes) if (c.concluida && c.data.startsWith(mes)) dias.add(c.data);
  for (const r of registros) if (r.concluida && r.data.startsWith(mes)) dias.add(r.data);
  return dias;
}

/** "1 dia treinado em outubro", "4 dias treinados em outubro". */
export function textoDosDias(quantos: number, data: string): string {
  const mes = MESES[Number(data.slice(5, 7)) - 1] ?? '';
  return `${quantos} ${quantos === 1 ? 'dia treinado' : 'dias treinados'} em ${mes}`;
}

/** As semanas do mês (domingo a sábado) sem as linhas que só têm dias dos meses vizinhos. */
export function semanasDoCartao(data: string): DiaDoCalendario[][] {
  const [a, m] = data.split('-').map(Number);
  return semanasDoMes({ ano: a!, mes: m! - 1 }).filter((s) => s.some((d) => d.doMes));
}

/** Texto que não cabe na largura vira "…" no fim (o cartão não quebra linha). */
export function cortar(texto: string, maximo: number): string {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/** Linha de baixo do título: "Treino A · 19/10". */
export function subtituloDoCartao(nomeDoTreino: string, data: string): string {
  return `${cortar(nomeDoTreino, 30)} · ${dataCurta(data)}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const NEUTRA = '#333333';

/** Cores fixas do cartão (é uma imagem: não segue o tema do aparelho). O dia treinado usa a marca se ela aparece no fundo. */
export function coresDoCartao(corPrimaria: string | null | undefined) {
  const marca = typeof corPrimaria === 'string' && HEX.test(corPrimaria) ? corPrimaria : NEUTRA;
  const fundo = '#111318';
  const marcado = contraste(marca, fundo) >= 3 ? marca : '#FFFFFF';
  return { fundo, texto: '#FFFFFF', suave: '#9AA0A6', marca, sobreMarca: textoSobre(marca), marcado, sobreMarcado: textoSobre(marcado) };
}

/** `treino-2026-10-19.png`. */
export const nomeDoArquivoDoCartao = (data: string) => `treino-${data}.png`;
