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
it('registra o handler de notificação uma única vez, mesmo com várias chamadas',async()=>{
  let lembretes!:typeof import('./lembretes');
  let notificacoes!:typeof Notifications;
  jest.isolateModules(()=>{
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lembretes=require('./lembretes');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificacoes=require('expo-notifications');
  });
  lembretes.iniciarLembretesAtualizacao('u1');
  await lembretes.reagendarLembretesAtualizacao('u1',atual);
  await lembretes.reagendarLembretesAtualizacao('u1',atual);
  await lembretes.precisaExplicacaoLembrete('u1');
  expect(notificacoes.setNotificationHandler).toHaveBeenCalledTimes(1);
});
describe('Expo Go no Android (sem expo-notifications)',()=>{
  function carregarNoExpoGo() {
    let modulo!:typeof import('./lembretes');
    jest.isolateModules(()=>{
      jest.doMock('expo-constants',()=>({
        __esModule:true,default:{executionEnvironment:'storeClient'},ExecutionEnvironment:{StoreClient:'storeClient'},
      }));
      jest.doMock('react-native',()=>({Platform:{OS:'android'}}));
      jest.doMock('expo-notifications',()=>{throw new Error('módulo não deve ser carregado no Expo Go');});
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modulo=require('./lembretes');
    });
    return modulo;
  }
  afterEach(()=>{jest.dontMock('expo-constants');jest.dontMock('react-native');jest.dontMock('expo-notifications');});
  it('não explica nem pede permissão, e não agenda nada',async()=>{
    const lembretes=carregarNoExpoGo();
    expect(await lembretes.precisaExplicacaoLembrete('u1')).toBe(false);
    expect(await lembretes.permitirLembretesAtualizacao('u1',atual)).toBe(false);
    await expect(lembretes.reagendarLembretesAtualizacao('u1',atual)).resolves.toBeUndefined();
    await expect(lembretes.cancelarLembretesAtualizacao('u1')).resolves.toBeUndefined();
  });
});
