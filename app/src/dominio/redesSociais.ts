import type { RedeDaConsultoria, RedesSociaisDaConsultoria } from '../api/tipos';
import { contraste, misturar } from '../tema/tokens';
import { linkParaAbrir } from './links';

/**
 * Redes sociais (T-107, `docs/planos/ajustes-da-tarde-25-11.md`): as da consultoria (Marca › Contato, links https que a API
 * normaliza) e as do aluno (Instagram e TikTok, a API guarda só o usuário, sem `@`). Ordem, nomes, o link do perfil do aluno e
 * a cor do brilho de cada botão. Nada daqui vai a log.
 */

/** Ordem fixa dos botões e dos campos. */
export const REDES_DA_CONSULTORIA: readonly RedeDaConsultoria[] = ['instagram', 'tiktok', 'youtube', 'x', 'site'];
export const NOME_DA_REDE: Record<RedeDaConsultoria, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', site: 'Site' };

/** Um botão da fileira: a rede e o link https já conferido. */
export interface LinkDeRede { rede: RedeDaConsultoria; url: string }

/** As redes preenchidas, na ordem fixa; link que não é https seguro (`linkParaAbrir`) fica de fora: nunca vira botão. */
export function redesPreenchidas(redes: Partial<Record<RedeDaConsultoria, string | null>> | null | undefined): LinkDeRede[] {
  return REDES_DA_CONSULTORIA.flatMap((rede) => {
    const url = linkParaAbrir(redes?.[rede]);
    return url ? [{ rede, url }] : [];
  });
}

// ---- Consultoria: o formulário do Contato ----

export type FormDasRedes = Record<RedeDaConsultoria, string>;

/** O que o campo mostra: o link gravado (já normalizado pela API) ou vazio. */
export function formDasRedes(redes: RedesSociaisDaConsultoria | null | undefined): FormDasRedes {
  return Object.fromEntries(REDES_DA_CONSULTORIA.map((r) => [r, redes?.[r] ?? ''])) as FormDasRedes;
}

export const redesAlteradas = (form: FormDasRedes, salvas: FormDasRedes): boolean =>
  REDES_DA_CONSULTORIA.some((r) => form[r].trim() !== salvas[r].trim());

/** As cinco sempre, aparadas: em branco apaga na API, preenchido ela valida e normaliza (como o WhatsApp do Contato). */
export function corpoDasRedes(form: FormDasRedes): Record<RedeDaConsultoria, string> {
  return Object.fromEntries(REDES_DA_CONSULTORIA.map((r) => [r, form[r].trim()])) as Record<RedeDaConsultoria, string>;
}

/** Erro do 422 `MARCA_INVALIDA` de uma rede: `redesSociais.<rede>` (o esperado) ou só `<rede>`. */
export const erroDaRede = (campos: Record<string, string>, rede: RedeDaConsultoria): string | undefined =>
  campos[`redesSociais.${rede}`] ?? campos[rede];

// ---- Aluno: Instagram e TikTok ----

export type RedeDoAluno = 'instagram' | 'tiktok';
export const REDES_DO_ALUNO: readonly RedeDoAluno[] = ['instagram', 'tiktok'];

// O que o Instagram e o TikTok aceitam no nome de usuário (letras, números, ponto e sublinhado); a API decide de verdade.
const USUARIO = /^[A-Za-z0-9._]{1,30}$/;
const HOSTS: Record<RedeDoAluno, RegExp> = { instagram: /^(www\.|m\.)?instagram\.com$/i, tiktok: /^(www\.|m\.)?tiktok\.com$/i };

/**
 * Usuário de `@usuario`, `usuario` ou do link do perfil (`instagram.com/usuario`, `tiktok.com/@usuario`), sem `@`.
 * Vazio = `null` (sem rede); `undefined` = não deu para entender (o campo mostra o erro).
 */
export function usuarioDaRede(rede: RedeDoAluno, texto: string): string | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  // Sem barra é o usuário ("joao.comercial" também); com barra, o link do perfil.
  if (!t.includes('/')) {
    const u = t.replace(/^@/, '');
    return USUARIO.test(u) ? u : undefined;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!HOSTS[rede].test(url.hostname)) return undefined;
    const primeiro = url.pathname.split('/').filter(Boolean)[0] ?? '';
    // O TikTok põe o `@` no caminho; o Instagram não.
    const u = rede === 'tiktok' ? (primeiro.startsWith('@') ? primeiro.slice(1) : '') : primeiro;
    return USUARIO.test(u) ? u : undefined;
  } catch {
    return undefined;
  }
}

export const MENSAGEM_USUARIO_DA_REDE: Record<RedeDoAluno, string> = {
  instagram: 'Use @usuario ou o link do perfil no Instagram.',
  tiktok: 'Use @usuario ou o link do perfil no TikTok.',
};

export const erroDoUsuarioDaRede = (rede: RedeDoAluno, texto: string): string | undefined =>
  usuarioDaRede(rede, texto) === undefined ? MENSAGEM_USUARIO_DA_REDE[rede] : undefined;

/** Link do perfil do aluno montado pelo app (a API guarda só o usuário). Usuário fora do formato = `null`, sem botão. */
export function linkDoPerfilDoAluno(rede: RedeDoAluno, usuario: string | null | undefined): string | null {
  const u = usuario?.trim().replace(/^@/, '');
  if (!u || !USUARIO.test(u)) return null;
  return rede === 'instagram' ? `https://www.instagram.com/${u}` : `https://www.tiktok.com/@${u}`;
}

/** Os perfis do aluno que existem: botões e o texto da linha ("@usuario (Instagram) · @outro (TikTok)"). */
export function redesDoAluno(aluno: { instagram?: string | null; tiktok?: string | null }): { links: LinkDeRede[]; texto: string | null } {
  const itens = REDES_DO_ALUNO.flatMap((rede) => {
    const url = linkDoPerfilDoAluno(rede, aluno[rede]);
    return url ? [{ rede, url, usuario: aluno[rede]!.trim().replace(/^@/, '') }] : [];
  });
  return {
    links: itens.map(({ rede, url }) => ({ rede, url })),
    texto: itens.length ? itens.map((i) => `@${i.usuario} (${NOME_DA_REDE[i.rede]})`).join(' · ') : null,
  };
}

/** O que o campo do aluno manda: só o que mudou (ausente não mexe); em branco apaga. No cadastro novo, só o preenchido. */
export function redeParaEnvio(texto: string, inicial: string | null | undefined, editando: boolean): string | undefined {
  const t = texto.trim();
  if (!editando) return t || undefined;
  return t === (inicial ?? '').trim() ? undefined : t;
}

// ---- Cor do brilho ----

/**
 * Cor de identificação de cada rede (identidade de terceiros, como o glifo: Simple Icons, CC0). O glifo é monocromático
 * (`cores.texto`); a cor entra só no brilho e no contorno do botão. TikTok e X são pretos na marca: o TikTok usa o ciano
 * dele, e o X e o site ficam neutros (`null`, o brilho sai do `cores.texto`).
 * shortcut: hex fora de `tema/tokens.ts` (arquivo de outro dono nesta onda); mover para os tokens quando a peça entrar no design system.
 */
export const COR_DA_REDE: Record<RedeDaConsultoria, string | null> = {
  instagram: '#FF0069',
  tiktok: '#25F4EE',
  youtube: '#FF0000',
  x: null,
  site: null,
};

/** Contraste mínimo do brilho contra a superfície do botão: abaixo disso (o ciano no branco) escurece para o lado do texto. */
export const CONTRASTE_DO_BRILHO = 2;

/** A cor do brilho e do contorno sobre `superficie`, puxada para o `texto` até ficar visível. */
export function corDoBrilho(rede: RedeDaConsultoria, cores: { superficie: string; texto: string }): string {
  const cor = COR_DA_REDE[rede];
  if (!cor) return cores.texto;
  let t = 0;
  let resultado = cor;
  while (contraste(resultado, cores.superficie) < CONTRASTE_DO_BRILHO && t < 1) {
    t = Math.min(1, t + 0.05);
    resultado = misturar(cor, cores.texto, t);
  }
  return resultado;
}
