import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio } from '../api/tipos';
import { emMemoria } from './armazenamento';
import { RepositorioLocal, type DadosRegistro } from './repositorioLocal';
import { Sincronizador } from './sincronizacao';

jest.mock('@react-native-async-storage/async-storage', () =>
  // O mock oficial só existe em CommonJS (fábrica do jest.mock não aceita import).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let ids = 0;
const novoId = () => `id-${++ids}`;
let relogio = Date.parse('2026-10-07T12:00:00Z');
const agora = () => new Date((relogio += 1000));

function serie(serieUid: string, extra: Partial<DadosRegistro> = {}): DadosRegistro {
  return {
    planoVersaoId: 'v1',
    sessaoUid: 's1',
    exercicioUid: 'e1',
    serieUid,
    exercicioId: 'x1',
    trabalho: false,
    data: '2026-10-07',
    carga: 20,
    repeticoes: 8,
    concluida: true,
    observacao: null,
    ...extra,
  };
}

const aceitaTudo = async (registros: RegistroEnvio[]): Promise<LoteResponse> => ({
  resultados: registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })),
});

describe('offline do aluno', () => {
  it('registrar de novo a mesma série no mesmo dia mantém o id e atualiza', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    const a = await repo.registrar(serie('x'));
    const b = await repo.registrar(serie('x', { carga: 22.5 }));
    expect(b.id).toBe(a.id);
    expect(await repo.listar()).toHaveLength(1);
    expect((await repo.listar())[0].carga).toBe(22.5);
    expect(b.alteradoEm > a.alteradoEm).toBe(true);
  });

  it('envio repetido não duplica: o mesmo id vai de novo', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    const enviados: string[] = [];
    const sync = new Sincronizador(repo, async (r) => {
      enviados.push(...r.map((x) => x.id));
      return aceitaTudo(r);
    });
    const a = await repo.registrar(serie('x'));
    await sync.sincronizar();
    await repo.registrar(serie('x', { repeticoes: 9 }));
    await sync.sincronizar();
    expect(enviados).toEqual([a.id, a.id]);
    expect((await repo.listar()).map((r) => r.situacao)).toEqual(['ENVIADO']);
  });

  it('registro alterado durante o envio continua pendente', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    const sync = new Sincronizador(repo, async (r) => {
      await repo.registrar(serie('x', { carga: 25 }));
      return aceitaTudo(r);
    });
    await sync.sincronizar();
    const [r] = await repo.listar();
    expect(r.carga).toBe(25);
    expect(r.situacao).toBe('LOCAL');
  });

  it('RECUSADO vira FALHOU com motivo, e "tentar de novo" volta para a fila', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    const sync = new Sincronizador(repo, async (r) => ({
      resultados: r.map((x) => ({ id: x.id, situacao: 'RECUSADO' as const, motivo: 'Data fora do período aceito.' })),
    }));
    await sync.sincronizar();
    const [r] = await repo.listar();
    expect(r.situacao).toBe('FALHOU');
    expect(r.motivo).toBe('Data fora do período aceito.');
    expect(await repo.reenviarFalhas()).toBe(1);
    expect((await repo.pendentes()).length).toBe(1);
  });

  it('falha de rede mantém LOCAL', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    const sync = new Sincronizador(repo, async () => {
      throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão');
    });
    expect(await sync.sincronizar()).toEqual({ tipo: 'semConexao' });
    expect((await repo.listar())[0].situacao).toBe('LOCAL');
  });

  it('o prefixo por usuário isola dois alunos no mesmo aparelho', async () => {
    const kv = emMemoria();
    const ana = new RepositorioLocal(kv, 'ana', novoId, agora);
    const bia = new RepositorioLocal(kv, 'bia', novoId, agora);
    await ana.registrar(serie('x'));
    expect(await bia.listar()).toEqual([]);
    await bia.registrar(serie('y'));
    await ana.apagarTudo();
    expect(await ana.listar()).toEqual([]);
    expect(await bia.listar()).toHaveLength(1);
  });

  it('uma sincronização por vez', async () => {
    const repo = new RepositorioLocal(emMemoria(), 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    let chamadas = 0;
    const sync = new Sincronizador(repo, async (r) => {
      chamadas++;
      return aceitaTudo(r);
    });
    await Promise.all([sync.sincronizar(), sync.sincronizar()]);
    expect(chamadas).toBe(1);
  });
});
