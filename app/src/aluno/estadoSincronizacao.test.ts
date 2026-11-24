import { estadoSincronizacao } from './estadoSincronizacao';
it('pulsa somente durante envio e permite tentar novamente em qualquer falha', () => {
  expect(estadoSincronizacao({ pendentes: 1, falhas: 0, envio: 'enviando', online: true }).pulsar).toBe(true);
  expect(estadoSincronizacao({ pendentes: 1, falhas: 0, envio: 'erro', online: true }).tentar).toBe(true);
  expect(estadoSincronizacao({ pendentes: 0, falhas: 1, envio: 'ocioso', online: true }).tipo).toBe('perigo');
});
it('mostra o registro salvo sem conexão e sucesso somente sem pendências', () => {
  expect(estadoSincronizacao({ pendentes: 2, falhas: 0, envio: 'ocioso', online: false })).toMatchObject({ texto: 'Sem conexão — 2 salvos no aparelho', pulsar: false });
  expect(estadoSincronizacao({ pendentes: 1, falhas: 0, envio: 'ocioso', online: false }).texto).toBe('Sem conexão — 1 salvo no aparelho');
  expect(estadoSincronizacao({ pendentes: 1, falhas: 0, envio: 'ocioso', online: true }).tipo).toBe('atencao');
  expect(estadoSincronizacao({ pendentes: 0, falhas: 0, envio: 'ocioso', online: true }).tipo).toBe('sucesso');
});
