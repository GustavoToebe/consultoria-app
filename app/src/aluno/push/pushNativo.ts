import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registrarPushToken, removerPushToken } from '../../api/rotas';
import { plataformaDoPush, tokenDePushValido, type PlataformaDoPush } from '../../dominio/pushDoAluno';
import { carregarNotificacoes } from '../compromissos/lembretes';

/**
 * Camada nativa do aviso de compromisso por push (Expo). Só obtém o token deste aparelho; quem o envia à API é o chamador.
 * O valor do token nunca vai a log, aviso nem erro. Na web este arquivo é trocado por `pushNativo.web.ts`.
 */

export type PushDoAparelho =
  | { estado: 'ok'; token: string; plataforma: PlataformaDoPush }
  | { estado: 'negada' }
  | { estado: 'indisponivel' };

/** Quanto o "Sair" espera para apagar o token na API antes de seguir (sem internet, não trava a saída). */
const ESPERA_DO_SAIR_MS = 4000;

/** O aparelho deixa notificar? `null` quando não há suporte (Expo Go no Android). Nunca pede permissão. */
export async function pushPermitido(): Promise<boolean | null> {
  const Notifications = await carregarNotificacoes();
  if (!Notifications) return null;
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Token deste aparelho. `pedirPermissao` só vale quando a pessoa acabou de ligar o interruptor; sem ele, aparelho sem
 * permissão dá `negada`. `exigirPermissao: false` (para APAGAR o token: desligar o aviso e sair) tenta buscar o token mesmo
 * sem permissão, que pode ter sido tirada depois de ligar. Erro de rede ou do Expo vira `indisponivel`.
 */
export async function obterPushDoAparelho(pedirPermissao: boolean, exigirPermissao = true): Promise<PushDoAparelho> {
  const plataforma = plataformaDoPush(Platform.OS);
  const Notifications = await carregarNotificacoes();
  if (!plataforma || !Notifications) return { estado: 'indisponivel' };
  try {
    if (Platform.OS === 'android') {
      // O Android 13 só pede a permissão depois de existir um canal; o push do Expo cai no canal "default".
      await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let permissao = await Notifications.getPermissionsAsync();
    if (!permissao.granted && pedirPermissao) permissao = await Notifications.requestPermissionsAsync();
    if (!permissao.granted && exigirPermissao) return { estado: 'negada' };
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (typeof projectId !== 'string') return { estado: 'indisponivel' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenDePushValido(data) ? { estado: 'ok', token: data, plataforma } : { estado: 'indisponivel' };
  } catch {
    return { estado: 'indisponivel' };
  }
}

/** Registra de novo o token deste aparelho na API (idempotente). Nunca pede permissão; sem token, não faz nada. */
export async function registrarPushDoAparelho(): Promise<void> {
  const aparelho = await obterPushDoAparelho(false);
  if (aparelho.estado === 'ok') await registrarPushToken(aparelho.token, aparelho.plataforma);
}

/**
 * Desligar o aviso: apaga o token deste aparelho na API, mesmo sem a permissão do aparelho. Se nem assim há token para
 * informar, pede ao servidor que apague todos os do próprio usuário (o app registra de novo ao ligar ou ao abrir com o aviso
 * ligado). Falha da API sobe: quem chama avisa e deixa o interruptor como estava.
 */
export async function desligarPushDoAparelho(): Promise<void> {
  const aparelho = await obterPushDoAparelho(false, false);
  await removerPushToken(aparelho.estado === 'ok' ? aparelho.token : undefined);
}

/**
 * "Sair": apaga o token deste aparelho na API enquanto a sessão ainda vale. Falha ou demora não bloqueiam a saída (o token
 * sem uso vence sozinho no servidor em 30 dias).
 */
export async function removerPushDoAparelho(): Promise<void> {
  const apagar = (async () => {
    const aparelho = await obterPushDoAparelho(false, false);
    if (aparelho.estado === 'ok') await removerPushToken(aparelho.token);
  })();
  await Promise.race([apagar, new Promise<void>((resolver) => setTimeout(resolver, ESPERA_DO_SAIR_MS))]).catch(() => undefined);
}
