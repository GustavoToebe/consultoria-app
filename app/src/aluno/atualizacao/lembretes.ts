import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { Atualizacao } from '../../api/tipos';
import { lembretesDaAtualizacao } from '../../dominio/lembretesAtualizacao';

const CANAL='atualizacoes';
const encerrados=new Set<string>();
let fila:Promise<unknown>=Promise.resolve();
function emFila<T>(acao:()=>Promise<T>):Promise<T> {const resultado=fila.then(acao,acao);fila=resultado.catch(()=>undefined);return resultado;}
const prefixo=(id:string)=>`treinos:atualizacao:${id}:`;
const chaveExplicacao=(id:string)=>`treinos:${id}:lembreteAtualizacaoPerguntado`;
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
    name:'Atualizações',importance:Notifications.AndroidImportance.DEFAULT,
  });
}
export function iniciarLembretesAtualizacao(usuarioId:string) {encerrados.delete(usuarioId);}
async function limpar(usuarioId:string) {
  const Notifications=await notificacoes();
  if(!Notifications)return;
  const pendentes=await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pendentes.filter(n=>n.identifier.startsWith(prefixo(usuarioId)))
    .map(n=>Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
export function cancelarLembretesAtualizacao(usuarioId:string) {
  encerrados.add(usuarioId);
  return emFila(()=>limpar(usuarioId));
}
export function reagendarLembretesAtualizacao(usuarioId:string,atualizacao:Atualizacao|null) {
  return emFila(async()=>{
    if(encerrados.has(usuarioId))return;
    await limpar(usuarioId);
    const Notifications=await notificacoes();
    if(!Notifications || !(await Notifications.getPermissionsAsync()).granted || encerrados.has(usuarioId))return;
    await prepararCanal(Notifications);
    for(const lembrete of lembretesDaAtualizacao(atualizacao)) {
      if(encerrados.has(usuarioId))return;
      await Notifications.scheduleNotificationAsync({
        identifier:`${prefixo(usuarioId)}${lembrete.chave}`,
        content:{title:'Sua atualização',body:lembrete.texto,data:{atualizacao:true},sound:false},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:lembrete.data,channelId:CANAL},
      });
    }
  });
}
export async function precisaExplicacaoLembrete(usuarioId:string) {
  if(await AsyncStorage.getItem(chaveExplicacao(usuarioId)))return false;
  const Notifications=await notificacoes();
  if(!Notifications)return false;
  const permissao=await Notifications.getPermissionsAsync();
  return !permissao.granted && permissao.canAskAgain;
}
export const dispensarExplicacaoLembrete=(usuarioId:string)=>AsyncStorage.setItem(chaveExplicacao(usuarioId),'1');
export async function permitirLembretesAtualizacao(usuarioId:string,atualizacao:Atualizacao) {
  const Notifications=await notificacoes();
  if(!Notifications)return false;
  await dispensarExplicacaoLembrete(usuarioId);
  await prepararCanal(Notifications);
  const permissao=await Notifications.requestPermissionsAsync();
  if(permissao.granted)await reagendarLembretesAtualizacao(usuarioId,atualizacao);
  return permissao.granted;
}
