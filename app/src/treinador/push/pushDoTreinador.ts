import { registrarPushTokenDoTreinador, removerPushTokenDoTreinador } from '../../api/rotas';
import { obterPushDoAparelho, pushPermitido } from '../../aluno/push/pushNativo';
import { carregarNotificacoes } from '../../aluno/compromissos/lembretes';

/**
 * Push do aviso de pontos de atenção no aparelho do membro da equipe (C7 de `docs/planos/regras-de-atencao.md`). Usa a mesma
 * camada nativa do aluno (`aluno/push/pushNativo`, que só obtém o token) com as rotas `/eu/push-token`. A permissão do aparelho
 * só é pedida em `ativarPushDoTreinador` (ação da pessoa no cartão "Avisos no celular"); o resto nunca pede. O token nunca vai a
 * log, aviso nem erro. Na web este arquivo é trocado por `pushDoTreinador.web.ts`.
 */

export { pushPermitido };

/** Para onde o toque na notificação leva (`data.tipo` do `TipoDePush.ATUALIZACAO_ATENCAO`). */
export const DESTINO_DO_TOQUE_DE_ATENCAO = '/treinador/atualizacoes?comAtencao=true';

/** Quanto o "Sair" espera para apagar o token antes de seguir (sem internet, não trava a saída). */
const ESPERA_DO_SAIR_MS = 4000;

/** Ligar neste aparelho: pede a permissão (se ainda não há) e registra o token. Falha da API sobe para quem chama avisar. */
export async function ativarPushDoTreinador(): Promise<'ok' | 'negada' | 'indisponivel'> {
  const aparelho = await obterPushDoAparelho(true);
  if (aparelho.estado !== 'ok') return aparelho.estado;
  await registrarPushTokenDoTreinador(aparelho.token, aparelho.plataforma);
  return 'ok';
}

/** Registra de novo (idempotente) só se o aparelho já deixa notificar; nunca pede permissão. */
export async function registrarPushDoTreinador(): Promise<void> {
  if ((await pushPermitido()) !== true) return;
  const aparelho = await obterPushDoAparelho(false);
  if (aparelho.estado === 'ok') await registrarPushTokenDoTreinador(aparelho.token, aparelho.plataforma);
}

/**
 * "Sair": apaga na API só o token DESTE aparelho (o `DELETE` sem corpo apagaria os outros celulares da pessoa), enquanto a
 * sessão vale. Sem permissão não há token a apagar. Falha ou demora não bloqueiam a saída (o servidor apaga em 30 dias).
 */
export async function removerPushDoTreinadorAoSair(): Promise<void> {
  const apagar = (async () => {
    if ((await pushPermitido()) !== true) return;
    const aparelho = await obterPushDoAparelho(false, false);
    if (aparelho.estado === 'ok') await removerPushTokenDoTreinador(aparelho.token);
  })();
  let espera: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([apagar, new Promise<void>((resolver) => { espera = setTimeout(resolver, ESPERA_DO_SAIR_MS); })])
    .catch(() => undefined)
    .finally(() => clearTimeout(espera));
}

type RespostaDoToque = { actionIdentifier: string; notification: { request: { identifier: string; content: { data?: unknown } } } };

/** Regra pura: só o toque no corpo (ação padrão) de um push `atencao` leva à lista; o resto (compromisso, lembrete local) não. */
export function destinoDoToque(resposta: RespostaDoToque, acaoPadrao: string): string | null {
  if (resposta.actionIdentifier !== acaoPadrao) return null;
  const dados = resposta.notification.request.content.data;
  return dados && typeof dados === 'object' && (dados as { tipo?: unknown }).tipo === 'atencao' ? DESTINO_DO_TOQUE_DE_ATENCAO : null;
}

// O mesmo toque pode chegar pelo ouvinte e pela "última resposta" (app aberto pela notificação): navega uma vez só.
let ultimoTratado: string | null = null;

/**
 * Ouve o toque na notificação (app aberto e app aberto pela notificação) e chama `navegar` com o destino. Devolve a função
 * que para de ouvir. Sem o módulo (Expo Go no Android), não faz nada.
 */
export async function ouvirToqueNaNotificacao(navegar: (destino: string) => void): Promise<() => void> {
  const Notifications = await carregarNotificacoes();
  if (!Notifications) return () => undefined;
  const tratar = (resposta: RespostaDoToque) => {
    const destino = destinoDoToque(resposta, Notifications.DEFAULT_ACTION_IDENTIFIER);
    if (!destino || resposta.notification.request.identifier === ultimoTratado) return;
    ultimoTratado = resposta.notification.request.identifier;
    navegar(destino);
    Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };
  const assinatura = Notifications.addNotificationResponseReceivedListener(tratar);
  const ultima = await Notifications.getLastNotificationResponseAsync().catch(() => null);
  if (ultima) tratar(ultima);
  return () => assinatura.remove();
}
