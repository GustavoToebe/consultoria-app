import * as Notifications from 'expo-notifications';
import type { Atualizacao } from '../../api/tipos';
import { cancelarLembretesAtualizacao, iniciarLembretesAtualizacao, reagendarLembretesAtualizacao } from './lembretes';

jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(),setItem:jest.fn()}));
jest.mock('expo-notifications',()=>({
  setNotificationHandler:jest.fn(),
  getAllScheduledNotificationsAsync:jest.fn(async()=>[
    {identifier:'treinos:atualizacao:u1:aviso'},
    {identifier:'treinos:atualizacao:u2:aviso'},
    {identifier:'outro-recurso'},
  ]),
  cancelScheduledNotificationAsync:jest.fn(async()=>undefined),
  getPermissionsAsync:jest.fn(async()=>({granted:true,canAskAgain:true})),
  scheduleNotificationAsync:jest.fn(async()=> 'agendada'),
  setNotificationChannelAsync:jest.fn(async()=>undefined),
  SchedulableTriggerInputTypes:{DATE:'date'},AndroidImportance:{DEFAULT:3},
}));
const atual={dataAtualizacao:'2035-10-10',atrasoAte:null,fase:'ABERTA'} as Atualizacao;
beforeEach(()=>{jest.clearAllMocks();iniciarLembretesAtualizacao('u1');});
it('reagenda apenas o usuário atual e cancela ao enviar',async()=>{
  await reagendarLembretesAtualizacao('u1',atual);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('treinos:atualizacao:u1:aviso');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('treinos:atualizacao:u2:aviso');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('outro-recurso');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
  await reagendarLembretesAtualizacao('u1',{...atual,fase:'ENVIADA'});
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it('logout cancela e impede requisição antiga de recriar os lembretes',async()=>{
  await cancelarLembretesAtualizacao('u1');
  await reagendarLembretesAtualizacao('u1',atual);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
