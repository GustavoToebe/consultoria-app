import * as Notifications from 'expo-notifications';
import type { CompromissoDoAluno } from '../../api/agendaTipos';
import {
  desligarLembretesDeCompromisso, encerrarLembretesDeCompromisso, iniciarLembretesDeCompromisso,
  lembretesDeCompromissoPermitidos, pedirPermissaoDeLembretesDeCompromisso, reagendarLembretesDeCompromisso,
} from './lembretes';

jest.mock('expo-notifications',()=>({
  setNotificationHandler:jest.fn(),
  getAllScheduledNotificationsAsync:jest.fn(async()=>[
    {identifier:'treinos:compromisso:u1:c0:1d'},
    {identifier:'treinos:compromisso:u10:c0:1d'},
    {identifier:'treinos:compromisso:u2:c0:1d'},
    {identifier:'treinos:atualizacao:u1:aviso'},
    {identifier:'outro-recurso'},
  ]),
  cancelScheduledNotificationAsync:jest.fn(async()=>undefined),
  getPermissionsAsync:jest.fn(async()=>({granted:true,canAskAgain:true})),
  requestPermissionsAsync:jest.fn(async()=>({granted:true,canAskAgain:true})),
  scheduleNotificationAsync:jest.fn(async()=> 'agendada'),
  setNotificationChannelAsync:jest.fn(async()=>undefined),
  SchedulableTriggerInputTypes:{DATE:'date'},AndroidImportance:{DEFAULT:3},
}));

const em=(horas:number)=>new Date(Date.now()+horas*3_600_000).toISOString();
function compromisso(id:string,horas:number,situacao:CompromissoDoAluno['situacao']='AGENDADO'):CompromissoDoAluno {
  return {id,inicio:em(horas),fim:em(horas+1),data:'2030-01-01',hora:'09:00',horaFim:'10:00',duracaoMinutos:60,local:'Sala fictícia',situacao,responsavelNome:'Ana Fictícia'};
}
const agendados=()=>jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([pedido])=>pedido);

beforeEach(()=>{jest.clearAllMocks();iniciarLembretesDeCompromisso('u1');});

it('cancela só os lembretes de compromisso do próprio usuário e agenda 1 dia e 2 horas antes dos AGENDADOS futuros',async()=>{
  await reagendarLembretesDeCompromisso('u1',[
    compromisso('c1',48),                // os dois
    compromisso('c2',5),                 // só o de 2 h (o de 1 dia já passou)
    compromisso('c3',1),                 // nenhum
    compromisso('c4',72,'CANCELADO'),    // cancelado não lembra
    compromisso('c5',72,'REALIZADO'),
  ]);
  const cancelados=jest.mocked(Notifications.cancelScheduledNotificationAsync).mock.calls.map(([id])=>id);
  expect(cancelados).toEqual(['treinos:compromisso:u1:c0:1d']);
  // Do disparo mais próximo ao mais distante.
  expect(agendados().map(p=>p.identifier)).toEqual([
    'treinos:compromisso:u1:c2:2h','treinos:compromisso:u1:c1:1d','treinos:compromisso:u1:c1:2h',
  ]);
});

it('o texto e o canal não trazem horário, local nem nome',async()=>{
  await reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)]);
  expect(agendados()).toHaveLength(2);
  for(const pedido of agendados()) {
    expect(pedido.content.title).toBe('Seu compromisso');
    expect(pedido.content.body).toMatch(/^Você tem um compromisso (amanhã|daqui a pouco)\. Abra o app para ver\.$/);
    expect(JSON.stringify(pedido)).not.toMatch(/Sala fictícia|Ana Fictícia|09:00/);
    expect(pedido.trigger).toMatchObject({type:'date',channelId:'compromissos'});
  }
});

it('sem permissão do aparelho limpa os antigos e não agenda nada (a permissão é pedida só no interruptor)',async()=>{
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({granted:false,canAskAgain:true} as never);
  await reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)]);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('a lista vazia ou nula só apaga: compromisso que sumiu ou foi cancelado perde o lembrete',async()=>{
  await reagendarLembretesDeCompromisso('u1',[]);
  await reagendarLembretesDeCompromisso('u1',null);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('"Sair" apaga e impede um pedido antigo de recriar os lembretes; entrar de novo libera',async()=>{
  await encerrarLembretesDeCompromisso('u1');
  await reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)]);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  iniciarLembretesDeCompromisso('u1');
  await reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)]);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

it('desligar o interruptor só apaga e não impede de ligar de novo',async()=>{
  await desligarLembretesDeCompromisso('u1');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  await reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)]);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

it('o interruptor pede a permissão só quando falta; negada não liga',async()=>{
  expect(await pedirPermissaoDeLembretesDeCompromisso()).toBe('concedida');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({granted:false,canAskAgain:true} as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({granted:false,canAskAgain:false} as never);
  expect(await pedirPermissaoDeLembretesDeCompromisso()).toBe('negada');
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({granted:false,canAskAgain:true} as never);
  expect(await lembretesDeCompromissoPermitidos()).toBe(false);
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
  it('não pede permissão nem agenda nada',async()=>{
    const lembretes=carregarNoExpoGo();
    expect(await lembretes.pedirPermissaoDeLembretesDeCompromisso()).toBe('indisponivel');
    expect(await lembretes.lembretesDeCompromissoPermitidos()).toBeNull();
    await expect(lembretes.reagendarLembretesDeCompromisso('u1',[compromisso('c1',48)])).resolves.toBeUndefined();
    await expect(lembretes.encerrarLembretesDeCompromisso('u1')).resolves.toBeUndefined();
  });
});
