import type { TomDoPerfil } from '../tema/tokens';
import { alternarComLimite } from './selecaoMultipla';

// Preferências do próprio perfil na Comunidade (`GET`/`PUT /aluno/comunidade/perfil`, plano `perfil-estilo-steam`,
// decisões 2, 3, 6, 7 e 11). Quem decide se o perfil está reservado é a API (`reservadoEfetivo`); o app só espelha as listas
// curtas de cor e moldura (`CorDoPerfil`, `MolduraDoPerfil`: mudou lá, mude aqui) e monta o corpo do PUT.

/** Teto de destaques (`PerfilDoAlunoService.MAXIMO_DE_DESTAQUES`). */
export const MAXIMO_DE_DESTAQUES = 4;

export type CorDoPerfil = 'AZUL' | 'VERDE' | 'ROXO' | 'LARANJA' | 'ROSA';
export type MolduraDoPerfil = 'SIMPLES' | 'DUPLA' | 'TRACEJADA' | 'GROSSA';

/**
 * Cada cor do perfil com o nome escrito e o tom de identificação (`tema/tokens.corDoTomDoPerfil`: a paleta das agendas e o
 * laranja só do perfil), com par claro/escuro e 3:1 de marcador nos temas. A cor só pinta a amostra e a moldura; o nome fica
 * na cor do texto. Um lugar só para trocar o tom de uma cor.
 */
// shortcut: VERDE usa OLIVA porque o único verde dos tokens é o `sucesso` (status, não identifica ninguém); trocar se o design system ganhar um verde de identificação.
export const CORES_DO_PERFIL: readonly { valor: CorDoPerfil; nome: string; tom: TomDoPerfil }[] = [
  { valor: 'AZUL', nome: 'Azul', tom: 'AZUL' },
  { valor: 'VERDE', nome: 'Verde', tom: 'OLIVA' },
  { valor: 'ROXO', nome: 'Roxo', tom: 'VIOLETA' },
  { valor: 'LARANJA', nome: 'Laranja', tom: 'LARANJA' },
  { valor: 'ROSA', nome: 'Rosa', tom: 'MAGENTA' },
];

/** A moldura se distingue pela forma (nunca só pela cor) e o nome vem escrito. */
export const MOLDURAS_DO_PERFIL: readonly { valor: MolduraDoPerfil; nome: string; descricao: string }[] = [
  { valor: 'SIMPLES', nome: 'Simples', descricao: 'Uma linha fina' },
  { valor: 'DUPLA', nome: 'Dupla', descricao: 'Duas linhas, uma dentro da outra' },
  { valor: 'TRACEJADA', nome: 'Tracejada', descricao: 'Linha em traços' },
  { valor: 'GROSSA', nome: 'Grossa', descricao: 'Uma linha larga' },
];

/** Valor desconhecido (app antigo com a API nova) cai no padrão da API, sem derrubar a tela. */
export const corDoPerfil = (valor: string | null | undefined) => CORES_DO_PERFIL.find((c) => c.valor === valor) ?? CORES_DO_PERFIL[0];
export const molduraDoPerfil = (valor: string | null | undefined) => MOLDURAS_DO_PERFIL.find((m) => m.valor === valor) ?? MOLDURAS_DO_PERFIL[0];

/** O que a API devolve (o mínimo que estas regras leem). */
export interface PreferenciasLidas {
  perfilReservado: boolean | null;
  reservadoEfetivo: boolean;
  destaques: string[];
  cor: string;
  moldura: string;
}

/** O que o aluno mexeu no cartão; campo ausente = não mexeu (vale o lido). */
export interface EdicaoDoPerfil {
  reservado?: boolean;
  destaques?: string[];
  cor?: CorDoPerfil;
  moldura?: MolduraDoPerfil;
}

export interface CorpoDoPerfil {
  perfilReservado: boolean | null;
  destaques: string[];
  cor: string;
  moldura: string;
}

/**
 * Corpo do PUT, que substitui as quatro preferências: o que o aluno não tocou volta como veio. Em especial o reservado não
 * tocado volta `null` (vale o padrão da idade), nunca o efetivo: salvar só a cor não pode virar uma escolha de privacidade.
 */
export function corpoDoPerfil(lido: PreferenciasLidas, edicao: EdicaoDoPerfil): CorpoDoPerfil {
  return {
    perfilReservado: edicao.reservado ?? lido.perfilReservado,
    destaques: edicao.destaques ?? lido.destaques,
    cor: edicao.cor ?? lido.cor,
    moldura: edicao.moldura ?? lido.moldura,
  };
}

/** "Entendi, manter visível": a escolha explícita de não reservar, com o resto como está salvo. */
export const corpoDoManterVisivel = (lido: PreferenciasLidas): CorpoDoPerfil => corpoDoPerfil(lido, { reservado: false });

/** Valor do interruptor: o que o aluno mexeu ou, sem isso, o efetivo da API. */
export const reservadoNaTela = (lido: PreferenciasLidas, edicao: EdicaoDoPerfil): boolean => edicao.reservado ?? lido.reservadoEfetivo;

/** Algo a salvar: o corpo difere do que está gravado. */
export function perfilMudou(lido: PreferenciasLidas, edicao: EdicaoDoPerfil): boolean {
  const c = corpoDoPerfil(lido, edicao);
  return c.perfilReservado !== lido.perfilReservado || c.cor !== lido.cor || c.moldura !== lido.moldura
    || c.destaques.length !== lido.destaques.length || c.destaques.some((d, i) => d !== lido.destaques[i]);
}

/**
 * Marca ou desmarca o destaque (o `tipo` da conquista, que é o que a API guarda), na ordem em que o aluno marcou.
 * `recusado` = quis marcar o 5º: nada muda.
 */
export function alternarDestaque(destaques: readonly string[], tipo: string, marcar: boolean): { destaques: string[]; recusado: boolean } {
  const r = alternarComLimite(new Set(destaques), tipo, marcar, MAXIMO_DE_DESTAQUES);
  return { destaques: [...r.marcados], recusado: r.recusado };
}

/** "2 de 4" e, cheio, como trocar. */
export function contadorDeDestaques(quantos: number, recusou: boolean): string {
  const base = `${quantos} de ${MAXIMO_DE_DESTAQUES}`;
  if (quantos < MAXIMO_DE_DESTAQUES) return base;
  return recusou ? `${base}. Você já escolheu ${MAXIMO_DE_DESTAQUES}: desmarque um para trocar.` : `${base}. Para trocar, desmarque um.`;
}

/** Aviso único (decisão 11): visível sem ter escolhido. Some quando o aluno escolhe (reservar ou "Entendi"). */
export const mostrarAvisoDoPerfil = (p: Pick<PreferenciasLidas, 'perfilReservado' | 'reservadoEfetivo'>): boolean =>
  p.perfilReservado === null && !p.reservadoEfetivo;

export const TEXTO_DO_AVISO_DO_PERFIL = 'Seus colegas podem ver seu perfil; você pode reservá-lo.';

/** O que o interruptor esconde (decisão 3). */
export const AJUDA_DO_RESERVAR = 'Esconde dos colegas sua foto, nível, insígnias, destaques, atividade e recordes. Eles continuam vendo seu nome e apelido.';

/** Explicação extra quando a reserva é o padrão (menor de idade ou sem data de nascimento) e o aluno ainda não escolheu. */
export function notaDoReservar(lido: PreferenciasLidas, edicao: EdicaoDoPerfil): string | null {
  if (edicao.reservado !== undefined || lido.perfilReservado !== null || !lido.reservadoEfetivo) return null;
  return 'Seu perfil começa reservado. Se quiser que os colegas o vejam, desligue e salve.';
}

/** 429 do PUT (balde das escritas da comunidade): a mensagem da API fala de "tentativas", então o texto é fixo. */
export const TEXTO_LIMITE_DO_PERFIL = 'Você mudou o perfil muitas vezes em pouco tempo. Espere alguns minutos e tente de novo.';
