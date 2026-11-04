/**
 * Aviso no celular quando um compromisso muda (push do Expo; plano `docs/planos/push-do-expo.md`). Regras puras: a camada
 * nativa (`aluno/push/pushNativo`) só obtém o token do aparelho e as rotas só o enviam à API.
 */

export type PlataformaDoPush = 'ANDROID' | 'IOS';

/** O mesmo formato que a API aceita em `PUT /aluno/push-token` (`PushDtos.RegistrarRequest`). */
const FORMATO_DO_TOKEN = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{8,170}\]$/;
export const TOKEN_TAMANHO_MAXIMO = 200;

export const ROTULO_DO_AVISO_NO_CELULAR = 'Avisar no celular quando um compromisso mudar';
export const AJUDA_DO_AVISO_NO_CELULAR =
  'Você recebe uma notificação quando seu treinador marcar, remarcar ou cancelar um compromisso. O texto não mostra horário nem nome.';
export const AJUDA_SEM_PERMISSAO_DO_PUSH = 'As notificações estão desligadas nas configurações do aparelho.';
export const AVISO_PUSH_NEGADO = 'Você pode liberar as notificações nas configurações do aparelho.';
export const AVISO_PUSH_FALHOU = 'Não foi possível ativar o aviso neste aparelho. Tente de novo com internet.';
export const AVISO_PUSH_NAO_DESLIGOU = 'Não foi possível desligar o aviso agora. Tente de novo com internet.';

/** `ios`/`android` viram o nome que a API usa; web e qualquer outra coisa ficam sem push (`null`). */
export function plataformaDoPush(os: string): PlataformaDoPush | null {
  if (os === 'android') return 'ANDROID';
  if (os === 'ios') return 'IOS';
  return null;
}

export function tokenDePushValido(token: unknown): token is string {
  return typeof token === 'string' && token.length <= TOKEN_TAMANHO_MAXIMO && FORMATO_DO_TOKEN.test(token);
}

/**
 * O interruptor aparece só no celular e só com a chave da plataforma ligada (`pushHabilitado` do `GET /eu`; ausente =
 * desligada). Recurso que não existe não aparece na tela.
 */
export function oferecerAvisoNoCelular(os: string, pushHabilitado: boolean): boolean {
  return pushHabilitado && plataformaDoPush(os) !== null;
}

/**
 * Registrar de novo ao abrir a área do aluno: o token pode mudar e o "Sair" o apagou do servidor. Só com a preferência
 * ligada, a chave ligada e o aparelho ainda deixando notificar; a permissão nunca é pedida aqui.
 */
export function deveRegistrarAoAbrir(p: { preferenciaLigada: boolean; pushHabilitado: boolean; os: string; permitido: boolean | null }): boolean {
  return p.preferenciaLigada && oferecerAvisoNoCelular(p.os, p.pushHabilitado) && p.permitido === true;
}
