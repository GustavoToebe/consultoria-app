import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Atualizacao } from '../../api/tipos';
import { lembretesDaAtualizacao } from '../../dominio/lembretesAtualizacao';

const CANAL='atualizacoes';
const encerrados=new Set<string>();
let fila:Promise<unknown>=Promise.resolve();
function emFila<T>(acao:()=>Promise<T>):Promise<T> {const resultado=fila.then(acao,acao);fila=resultado.catch(()=>undefined);return resultado;}
const prefixo=(id:string)=>`treinos:atualizacao:${id}:`;
const chaveExplicacao=(id:string)=>`treinos:${id}:lembreteAtualizacaoPerguntado`;
async function prepararCanal() {
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(CANAL,{
    name:'Atualizações',importance:Notifications.AndroidImportance.DEFAULT,
  });
}
Notifications.setNotificationHandler({handleNotification:async()=>({
  shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false,
})});
export function iniciarLembretesAtualizacao(usuarioId:string) {encerrados.delete(usuarioId);}
async function limpar(usuarioId:string) {
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
    if(!(await Notifications.getPermissionsAsync()).granted || encerrados.has(usuarioId))return;
    await prepararCanal();
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
  const permissao=await Notifications.getPermissionsAsync();
  return !permissao.granted && permissao.canAskAgain;
}
export const dispensarExplicacaoLembrete=(usuarioId:string)=>AsyncStorage.setItem(chaveExplicacao(usuarioId),'1');
export async function permitirLembretesAtualizacao(usuarioId:string,atualizacao:Atualizacao) {
  await dispensarExplicacaoLembrete(usuarioId);
  await prepararCanal();
  const permissao=await Notifications.requestPermissionsAsync();
  if(permissao.granted)await reagendarLembretesAtualizacao(usuarioId,atualizacao);
  return permissao.granted;
}
