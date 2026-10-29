import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { CompromissoDoAluno } from '../../api/agendaTipos';
import {
  identificadorDoLembreteDeCompromisso, lembretesDeCompromissos, prefixoDosLembretesDeCompromisso,
  TITULO_DO_LEMBRETE_DE_COMPROMISSO,
} from '../../dominio/lembretesCompromisso';

/**
 * Camada nativa dos lembretes de compromisso (D13): notificações locais 1 dia e 2 horas antes, agendadas a partir da lista
 * que o app baixou (`GET /aluno/compromissos`). Molde de `atualizacao/lembretes.ts`. A regra de quais lembretes existem e o
 * texto (sem horário, P7) ficam em `dominio/lembretesCompromisso`.
 */

const CANAL='compromissos';
const encerrados=new Set<string>();
let fila:Promise<unknown>=Promise.resolve();
function emFila<T>(acao:()=>Promise<T>):Promise<T> {const resultado=fila.then(acao,acao);fila=resultado.catch(()=>undefined);return resultado;}
type Notificacoes=typeof import('expo-notifications');
// No Expo Go do Android o módulo lança ao ser importado (push remoto saiu no SDK 53) e derrubaria a área do aluno:
// lá os lembretes ficam desligados; em build próprio e na web nada muda.
const semSuporte=Platform.OS==='android' && Constants.executionEnvironment===ExecutionEnvironment.StoreClient;
let carregado:Promise<Notificacoes|null>|null=null;
function notificacoes():Promise<Notificacoes|null> {
  carregado??=new Promise<Notificacoes|null>(resolver=>{
    if(semSuporte){resolver(null);return;}
    try {
      // require sob demanda: o import estático avalia o módulo (e o erro do Expo Go) ao carregar a área do aluno.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modulo=require('expo-notifications') as Notificacoes;
      modulo.setNotificationHandler({handleNotification:async()=>({
        shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false,
      })});
      resolver(modulo);
    } catch {resolver(null);}
  });
  return carregado;
}
async function prepararCanal(Notifications:Notificacoes) {
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(CANAL,{
    name:'Compromissos',importance:Notifications.AndroidImportance.DEFAULT,
  });
}
async function limpar(usuarioId:string) {
  const Notifications=await notificacoes();
  if(!Notifications)return;
  const pendentes=await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pendentes.filter(n=>n.identifier.startsWith(prefixoDosLembretesDeCompromisso(usuarioId)))
    .map(n=>Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Ao entrar na área do aluno: este usuário volta a poder agendar (o "Sair" anterior o tinha encerrado). */
export function iniciarLembretesDeCompromisso(usuarioId:string) {encerrados.delete(usuarioId);}
/** "Sair" e sessão recusada: apaga os lembretes do usuário e impede que um pedido atrasado os recrie. */
export function encerrarLembretesDeCompromisso(usuarioId:string) {
  encerrados.add(usuarioId);
  return emFila(()=>limpar(usuarioId));
}
/** Interruptor desligado: só apaga os lembretes; ligar de novo volta a agendar. */
export function desligarLembretesDeCompromisso(usuarioId:string) {return emFila(()=>limpar(usuarioId));}
/**
 * Apaga os lembretes do usuário e agenda de novo os da lista dada (os `AGENDADO` futuros; cancelado, remarcado e
 * passado saem por aqui). Sem permissão do aparelho não agenda nada: ela é pedida só no interruptor.
 */
export function reagendarLembretesDeCompromisso(usuarioId:string,compromissos:readonly CompromissoDoAluno[]|null) {
  return emFila(async()=>{
    if(encerrados.has(usuarioId))return;
    await limpar(usuarioId);
    const Notifications=await notificacoes();
    if(!Notifications || !(await Notifications.getPermissionsAsync()).granted || encerrados.has(usuarioId))return;
    await prepararCanal(Notifications);
    for(const lembrete of lembretesDeCompromissos(compromissos)) {
      if(encerrados.has(usuarioId))return;
      await Notifications.scheduleNotificationAsync({
        identifier:identificadorDoLembreteDeCompromisso(usuarioId,lembrete),
        content:{title:TITULO_DO_LEMBRETE_DE_COMPROMISSO,body:lembrete.texto,data:{compromisso:true},sound:false},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:lembrete.data,channelId:CANAL},
      });
    }
  });
}
/** O aparelho deixa notificar? `null` quando não há suporte (Expo Go no Android). */
export async function lembretesDeCompromissoPermitidos():Promise<boolean|null> {
  const Notifications=await notificacoes();
  if(!Notifications)return null;
  return (await Notifications.getPermissionsAsync()).granted;
}
/** Chamada pelo interruptor: pede a permissão do aparelho no momento em que a pessoa liga. */
export async function pedirPermissaoDeLembretesDeCompromisso():Promise<'concedida'|'negada'|'indisponivel'> {
  const Notifications=await notificacoes();
  if(!Notifications)return 'indisponivel';
  await prepararCanal(Notifications);
  const atual=await Notifications.getPermissionsAsync();
  if(atual.granted)return 'concedida';
  return (await Notifications.requestPermissionsAsync()).granted?'concedida':'negada';
}
