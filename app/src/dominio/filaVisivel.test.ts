import type { RegistroSessaoConcluidaLocal, SituacaoLocal } from '../offline/repositorioLocal';
import { filaVisivel } from './filaVisivel';
import { treinosNaoEnviados } from './treinosNaoEnviados';

const serie = (situacao: SituacaoLocal, data = '2026-10-19', sessaoUid = 'sx') => ({ situacao, data, sessaoUid });
const marca = (situacao: SituacaoLocal) => ({ situacao });
const conclusao = (situacao: SituacaoLocal, data: string, sessaoUid = 'sx'): RegistroSessaoConcluidaLocal => ({
  id: `${data}|${sessaoUid}|${situacao}`,
  planoVersaoId: 'v1',
  sessaoUid,
  data,
  concluida: true,
  resultado: 'COMPLETA',
  duracaoSegundos: 3600,
  comentario: 'Comentario-ficticio',
  alteradoEm: '2026-10-19T12:00:00.000Z',
  situacao,
  motivo: situacao === 'FALHOU' ? 'Recusado.' : null,
});

describe('filaVisivel', () => {
  const conclusoes = [conclusao('LOCAL', '2026-10-19'), conclusao('FALHOU', '2026-10-18'), conclusao('ENVIADO', '2026-10-17')];

  it('chave ligada: as conclusões contam como pendência, falha e treino no aparelho', () => {
    const v = filaVisivel([serie('LOCAL')], [marca('LOCAL'), marca('ENVIADO')], conclusoes, true);
    expect(v.pendentes).toBe(3);
    expect(v.falhasDeConclusao.map((c) => c.data)).toEqual(['2026-10-18']);
    expect(v.sessoesConcluidasNoAparelho).toEqual(conclusoes);
  });

  it('chave desligada: pendentes não soma as conclusões e as listas saem vazias', () => {
    const v = filaVisivel([serie('LOCAL')], [marca('LOCAL'), marca('ENVIADO')], conclusoes, false);
    expect(v.pendentes).toBe(2);
    expect(v.falhasDeConclusao).toEqual([]);
    expect(v.sessoesConcluidasNoAparelho).toEqual([]);
  });

  it('chave desligada: só conclusões na fila não deixam pendência nenhuma', () => {
    const v = filaVisivel([serie('ENVIADO')], [], conclusoes, false);
    expect(v).toEqual({ pendentes: 0, falhasDeConclusao: [], sessoesConcluidasNoAparelho: [] });
  });

  it('o aviso de "Sair" não conta o dia que só tem conclusão enquanto a chave está desligada', () => {
    const registros = [serie('LOCAL', '2026-10-20', 'sy')];
    expect(treinosNaoEnviados(registros, filaVisivel(registros, [], conclusoes, true).sessoesConcluidasNoAparelho)).toBe(3);
    expect(treinosNaoEnviados(registros, filaVisivel(registros, [], conclusoes, false).sessoesConcluidasNoAparelho)).toBe(1);
  });
});
