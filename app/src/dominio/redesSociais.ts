import type { RedeDaConsultoria, RedesSociaisDaConsultoria } from '../api/tipos';
import { contraste, misturar } from '../tema/tokens';
import { linkParaAbrir } from './links';

/**
 * Redes sociais (T-107, `docs/planos/ajustes-da-tarde-25-11.md`; 26/11, peça única `ui/RedesSociais`): as da consultoria
 * (Marca › Contato, links https que a API normaliza) e as do aluno (Instagram e TikTok, a API guarda só o usuário, sem `@`;
 * YouTube, Facebook, LinkedIn e Telegram, o link https normalizado). Ordem, nomes, links, o que a edição precisa e as cores
 * dos botões. O WhatsApp não é rede: vem do telefone e só tem cor e glifo aqui. Nada daqui vai a log.
 */

/** Ordem fixa dos botões e dos campos (a da consultoria; a do aluno é esta sem X e site). */
export const REDES_DA_CONSULTORIA: readonly RedeDaConsultoria[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'telegram', 'x', 'site'];
export const NOME_DA_REDE: Record<RedeDaConsultoria, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', telegram: 'Telegram', x: 'X', site: 'Site',
};

/** As seis redes do aluno (as da consultoria menos X e site), na ordem fixa. */
export type RedeSocialDoAluno = Exclude<RedeDaConsultoria, 'x' | 'site'>;
export const REDES_SOCIAIS_DO_ALUNO: readonly RedeSocialDoAluno[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'telegram'];

/** Um botão da fileira: a rede e o link https já conferido. */
export interface LinkDeRede { rede: RedeDaConsultoria; url: string }

/** As redes preenchidas, na ordem fixa; link que não é https seguro (`linkParaAbrir`) fica de fora: nunca vira botão. */
export function redesPreenchidas(redes: Partial<Record<RedeDaConsultoria, string | null>> | null | undefined): LinkDeRede[] {
  return REDES_DA_CONSULTORIA.flatMap((rede) => {
    const url = linkParaAbrir(redes?.[rede]);
    return url ? [{ rede, url }] : [];
  });
}

/**
 * O "@" curto da rede para a dica do botão e o texto da ficha: `@usuario` tirado do link (Instagram, TikTok, YouTube com
 * `@`, Facebook, LinkedIn `in/` ou `company/`, Telegram, X); o site, e o link de que não se tira usuário, viram host +
 * caminho sem `www.` e sem a barra do fim. Texto que não é link volta aparado.
 */
export function rotuloCurto(rede: RedeDaConsultoria, url: string): string {
  let link: URL;
  try {
    link = new URL(url.trim());
  } catch {
    return url.trim();
  }
  const partes = link.pathname.split('/').filter(Boolean).map(decodificar);
  const hostECaminho = `${link.hostname.replace(/^www\./i, '')}${partes.length ? `/${partes.join('/')}` : ''}`;
  if (rede === 'site') return hostECaminho;
  const [primeiro = '', segundo = ''] = partes;
  const usuario = ((): string => {
    if (rede === 'tiktok' || rede === 'youtube') return primeiro.startsWith('@') ? primeiro.slice(1) : '';
    if (rede === 'linkedin') return primeiro === 'in' || primeiro === 'company' ? segundo : '';
    if (rede === 'facebook' && (primeiro === 'profile.php' || primeiro === 'people')) return '';
    return primeiro;
  })();
  return usuario ? `@${usuario}` : hostECaminho;
}

const decodificar = (parte: string): string => {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
};

// ---- Consultoria: o formulário do Contato ----

export type FormDasRedes = Record<RedeDaConsultoria, string>;

/** O que o campo mostra: o link gravado (já normalizado pela API) ou vazio. */
export function formDasRedes(redes: RedesSociaisDaConsultoria | null | undefined): FormDasRedes {
  return Object.fromEntries(REDES_DA_CONSULTORIA.map((r) => [r, redes?.[r] ?? ''])) as FormDasRedes;
}

/** Aceita o form inteiro ou só as redes adicionadas na peça (rede ausente = vazia). */
export const redesAlteradas = (form: Partial<FormDasRedes>, salvas: Partial<FormDasRedes>): boolean =>
  REDES_DA_CONSULTORIA.some((r) => (form[r] ?? '').trim() !== (salvas[r] ?? '').trim());

/** As oito sempre, aparadas: em branco apaga na API, preenchido ela valida e normaliza (como o WhatsApp do Contato). Rede ausente vai em branco. */
export function corpoDasRedes(form: Partial<FormDasRedes>): Record<RedeDaConsultoria, string> {
  return Object.fromEntries(REDES_DA_CONSULTORIA.map((r) => [r, (form[r] ?? '').trim()])) as Record<RedeDaConsultoria, string>;
}

/** Erro do 422 `MARCA_INVALIDA` de uma rede: `redesSociais.<rede>` (o esperado) ou só `<rede>`. */
export const erroDaRede = (campos: Record<string, string>, rede: RedeDaConsultoria): string | undefined =>
  campos[`redesSociais.${rede}`] ?? campos[rede];

// ---- Aluno: Instagram e TikTok guardam o usuário ----

/**
 * As redes em que a API guarda só o usuário (Instagram e TikTok). Nome antigo mantido de propósito: `FormAluno`,
 * `DetalheMeusDados` e `meusDados` indexam um formulário de dois campos com ele até migrarem para a peça
 * (`REDES_SOCIAIS_DO_ALUNO` é a lista das seis).
 */
export type RedeDoAluno = 'instagram' | 'tiktok';
export const REDES_DO_ALUNO: readonly RedeDoAluno[] = ['instagram', 'tiktok'];
const eRedeDeUsuario = (rede: RedeDaConsultoria): rede is RedeDoAluno => rede === 'instagram' || rede === 'tiktok';

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

/**
 * Pré-validação leve do campo da peça, para qualquer rede: Instagram e TikTok com as regras de sempre; as outras só recusam
 * espaço no meio (a API normaliza e decide). Vazio não é erro: a rede vai em branco (apaga ou não manda nada).
 */
export function erroDaRedeDigitada(rede: RedeDaConsultoria, texto: string): string | undefined {
  if (eRedeDeUsuario(rede)) return erroDoUsuarioDaRede(rede, texto);
  if (!/\s/.test(texto.trim())) return undefined;
  return rede === 'site' ? 'Use o link do site, sem espaços.' : `Use @usuario ou o link do perfil no ${NOME_DA_REDE[rede]}.`;
}

/** Link do perfil do aluno montado pelo app (a API guarda só o usuário). Usuário fora do formato = `null`, sem botão. */
export function linkDoPerfilDoAluno(rede: RedeDoAluno, usuario: string | null | undefined): string | null {
  const u = usuario?.trim().replace(/^@/, '');
  if (!u || !USUARIO.test(u)) return null;
  return rede === 'instagram' ? `https://www.instagram.com/${u}` : `https://www.tiktok.com/@${u}`;
}

/**
 * Os perfis do aluno que existem: botões e o texto da linha ("@usuario (Instagram) · @canal (YouTube)"). Instagram e TikTok
 * viram link por `linkDoPerfilDoAluno`; as outras já chegam como link (só https seguro vira botão).
 */
export function redesDoAluno(aluno: Partial<Record<RedeSocialDoAluno, string | null>>): { links: LinkDeRede[]; texto: string | null } {
  const links = REDES_SOCIAIS_DO_ALUNO.flatMap((rede): LinkDeRede[] => {
    const url = eRedeDeUsuario(rede) ? linkDoPerfilDoAluno(rede, aluno[rede]) : linkParaAbrir(aluno[rede]);
    return url ? [{ rede, url }] : [];
  });
  return {
    links,
    texto: links.length ? links.map(({ rede, url }) => `${rotuloCurto(rede, url)} (${NOME_DA_REDE[rede]})`).join(' · ') : null,
  };
}

/** O que o campo do aluno manda: só o que mudou (ausente não mexe); em branco apaga. No cadastro novo, só o preenchido. */
export function redeParaEnvio(texto: string, inicial: string | null | undefined, editando: boolean): string | undefined {
  const t = texto.trim();
  if (!editando) return t || undefined;
  return t === (inicial ?? '').trim() ? undefined : t;
}

// ---- A edição da peça (`ui/RedesSociais` modo edição) ----

/**
 * Os campos da peça: a chave presente (também `''`) é uma rede adicionada; ausente, não adicionada. Remover a rede tira a
 * chave; quem envia trata a ausente como em branco (apaga o que estava gravado).
 */
export type ValoresDasRedes<R extends RedeDaConsultoria = RedeDaConsultoria> = Partial<Record<R, string>>;

/** As redes adicionadas, na ordem fixa das permitidas. */
export const redesAdicionadas = <R extends RedeDaConsultoria>(valores: ValoresDasRedes<R>, redesPermitidas: readonly R[]): R[] =>
  redesPermitidas.filter((r) => valores[r] !== undefined);

/** As que o "Adicionar rede" oferece: as permitidas que ainda não estão na lista. Vazia = o botão some. */
export const redesDisponiveisParaAdicionar = <R extends RedeDaConsultoria>(valores: ValoresDasRedes<R>, redesPermitidas: readonly R[]): R[] =>
  redesPermitidas.filter((r) => valores[r] === undefined);

/** Abre a edição do aluno: só as redes com valor; Instagram e TikTok com o `@` na frente (a API guarda só o usuário). */
export function valoresDasRedesDoAluno(aluno: Partial<Record<RedeSocialDoAluno, string | null>>): ValoresDasRedes<RedeSocialDoAluno> {
  return Object.fromEntries(REDES_SOCIAIS_DO_ALUNO.flatMap((rede) => {
    const v = aluno[rede]?.trim();
    if (!v) return [];
    return [[rede, eRedeDeUsuario(rede) ? `@${v.replace(/^@/, '')}` : v]];
  })) as ValoresDasRedes<RedeSocialDoAluno>;
}

/** Abre a edição da consultoria: só as redes com link gravado. */
export function valoresDasRedesDaConsultoria(redes: RedesSociaisDaConsultoria | null | undefined): ValoresDasRedes {
  return Object.fromEntries(REDES_DA_CONSULTORIA.flatMap((r) => (redes?.[r]?.trim() ? [[r, redes[r]!.trim()]] : []))) as ValoresDasRedes;
}

/**
 * Corpo das seis redes do aluno no `PUT`/`POST` (`AlunoRequest`, `MeusDadosRequest`): cada uma por `redeParaEnvio` (só o
 * que mudou; rede removida ou em branco vai `''` e apaga; no cadastro novo, só o preenchido). Ausente = não mexe.
 */
export function redesDoAlunoParaEnvio(
  valores: ValoresDasRedes<RedeSocialDoAluno>, iniciais: ValoresDasRedes<RedeSocialDoAluno>, editando: boolean,
): Partial<Record<RedeSocialDoAluno, string>> {
  return Object.fromEntries(REDES_SOCIAIS_DO_ALUNO.flatMap((rede) => {
    const envio = redeParaEnvio(valores[rede] ?? '', iniciais[rede], editando);
    return envio === undefined ? [] : [[rede, envio]];
  }));
}

// ---- Cores dos botões ----

/** O WhatsApp entra na fileira de leitura (vem do telefone), com glifo e cor próprios. */
export type MarcaDoBotao = RedeDaConsultoria | 'whatsapp';

/**
 * Cor de identificação de cada rede (identidade de terceiros, como o glifo: Simple Icons, CC0), no glifo e no brilho do
 * quadrado/círculo escuro (26/11). X e site são neutros (`null`): glifo claro e brilho na cor do texto.
 * shortcut: hex fora de `tema/tokens.ts` (arquivo de outro dono nesta onda); mover para os tokens quando a peça entrar no design system.
 */
export const COR_DA_REDE: Record<MarcaDoBotao, string | null> = {
  instagram: '#E1306C',
  tiktok: '#25F4EE',
  youtube: '#FF0000',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  x: null,
  site: null,
};

/**
 * O fundo dos botões de rede é escuro nos dois temas (a cor da rede só contrasta assim, como um ícone de app) e o glifo
 * neutro é claro. shortcut: hex fixos fora dos tokens, como `COR_DA_REDE`; mover junto.
 */
export const FUNDO_DO_BOTAO_DE_REDE = '#18181B';
export const FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR = '#27272A';
export const GLIFO_NEUTRO_DA_REDE = '#F4F4F5';

/** Contraste mínimo do glifo (objeto gráfico, WCAG 1.4.11) sobre o fundo escuro, também com o mouse em cima. */
export const CONTRASTE_DO_GLIFO = 3;

/** A cor do glifo sobre o fundo escuro: a da rede, clareada na direção do neutro até passar 3:1 (o LinkedIn passa por pouco). */
export function corDoGlifo(marca: MarcaDoBotao): string {
  const cor = COR_DA_REDE[marca] ?? GLIFO_NEUTRO_DA_REDE;
  let t = 0;
  let resultado = cor;
  while (contraste(resultado, FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR) < CONTRASTE_DO_GLIFO && t < 1) {
    t = Math.min(1, t + 0.05);
    resultado = misturar(cor, GLIFO_NEUTRO_DA_REDE, t);
  }
  return resultado;
}

/** Contraste mínimo do brilho contra a superfície do botão: abaixo disso (o ciano no branco) escurece para o lado do texto. */
export const CONTRASTE_DO_BRILHO = 2;

/** A cor do brilho sobre `superficie` (a página em volta do botão), puxada para o `texto` até ficar visível. */
export function corDoBrilho(marca: MarcaDoBotao, cores: { superficie: string; texto: string }): string {
  const cor = COR_DA_REDE[marca];
  if (!cor) return cores.texto;
  let t = 0;
  let resultado = cor;
  while (contraste(resultado, cores.superficie) < CONTRASTE_DO_BRILHO && t < 1) {
    t = Math.min(1, t + 0.05);
    resultado = misturar(cor, cores.texto, t);
  }
  return resultado;
}
