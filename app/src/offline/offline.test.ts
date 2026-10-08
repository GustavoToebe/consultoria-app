import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio } from '../api/tipos';
import { emMemoria, type ChaveValor } from './armazenamento';
import { fabricaNode, type FabricaDeTeste } from './bancoNode.apoioTeste';
import { RepositorioChaveValor, type DadosRegistro, type RepositorioLocal } from './repositorioLocal';
import { RepositorioSqlite } from './repositorioSqlite';
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

/**
 * Um "aparelho": cria repositórios por usuário que compartilham o mesmo armazenamento. A mesma bateria roda nas duas
 * implementações (celular = SQLite, web = chave-valor): o contrato é um só.
 */
type Aparelho = (usuarioId: string) => RepositorioLocal;

const implementacoes: [string, () => Aparelho][] = [
  [
    'chave-valor (web)',
    () => {
      const kv = emMemoria();
      return (usuarioId) => new RepositorioChaveValor(kv, usuarioId, novoId, agora);
    },
  ],
  [
    'SQLite (celular)',
    () => {
      const fabrica = fabricaNode();
      return (usuarioId) => new RepositorioSqlite(fabrica, usuarioId, novoId, agora);
    },
  ],
];

describe.each(implementacoes)('offline do aluno – %s', (_nome, criarAparelho) => {
  let aparelho: Aparelho;
  beforeEach(() => {
    aparelho = criarAparelho();
  });

  it('histórico da semana fica isolado, sobrevive à reabertura e sai ao desconectar a conta', async () => {
    const repo = aparelho('u1');
    const salvo = {versaoId:'v1',inicio:'2026-10-05',dias:[{data:'2026-10-05',sessoes:[]}]};
    await repo.salvarHistoricoSemana(salvo);
    expect(await aparelho('u2').lerHistoricoSemana()).toBeNull();
    expect(await aparelho('u1').lerHistoricoSemana()).toEqual(salvo);
    await repo.apagarTudo();
    await repo.salvarHistoricoSemana(salvo);
    expect(await aparelho('u1').lerHistoricoSemana()).toBeNull();
  });

  it('registrar de novo a mesma série no mesmo dia mantém o id e atualiza', async () => {
    const repo = aparelho('u1');
    const a = await repo.registrar(serie('x'));
    const b = await repo.registrar(serie('x', { carga: 22.5 }));
    expect(b.id).toBe(a.id);
    expect(await repo.listar()).toHaveLength(1);
    expect((await repo.listar())[0].carga).toBe(22.5);
    expect(b.alteradoEm > a.alteradoEm).toBe(true);
  });

  it('envio repetido não duplica: o mesmo id vai de novo', async () => {
    const repo = aparelho('u1');
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
    const repo = aparelho('u1');
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
    const repo = aparelho('u1');
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
    const repo = aparelho('u1');
    await repo.registrar(serie('x'));
    const sync = new Sincronizador(repo, async () => {
      throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão');
    });
    expect(await sync.sincronizar()).toEqual({ tipo: 'semConexao' });
    expect((await repo.listar())[0].situacao).toBe('LOCAL');
  });

  it('dois alunos no mesmo aparelho não se misturam, e sair apaga só o de quem saiu', async () => {
    const ana = aparelho('ana');
    const bia = aparelho('bia');
    await ana.registrar(serie('x'));
    expect(await bia.listar()).toEqual([]);
    await bia.registrar(serie('y'));
    await ana.apagarTudo();
    expect(await ana.listar()).toEqual([]);
    expect(await bia.listar()).toHaveLength(1);
  });

  it('uma sincronização por vez', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('x'));
    let chamadas = 0;
    const sync = new Sincronizador(repo, async (r) => {
      chamadas++;
      return aceitaTudo(r);
    });
    await Promise.all([sync.sincronizar(), sync.sincronizar()]);
    expect(chamadas).toBe(1);
  });

  it('pacote, dieta e carga de trabalho voltam iguais', async () => {
    const repo = aparelho('u1');
    const pacote = { treino: null, marca: { nome: 'X' } } as unknown as Parameters<RepositorioLocal['salvarPacote']>[0];
    await repo.salvarPacote(pacote);
    expect((await repo.lerPacote())?.pacote).toEqual(pacote);
    expect(await repo.lerDieta()).toBeNull();
    expect(await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 30)).toEqual({ 'e1|2026-10-07': 30 });
    await repo.salvarCargaDeTrabalho('e1', '2026-10-08', 32.5);
    expect(await repo.salvarCargaDeTrabalho('e1', '2026-10-07', null)).toEqual({ 'e1|2026-10-08': 32.5 });
    expect(await repo.lerCargasDeTrabalho()).toEqual({ 'e1|2026-10-08': 32.5 });
  });

  it('valores voltam com o tipo certo (carga decimal, repetições vazias, booleanos)', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('x', { carga: 25.5, repeticoes: null, trabalho: true, concluida: false }));
    const [r] = await repo.listar();
    expect(r).toMatchObject({ carga: 25.5, repeticoes: null, trabalho: true, concluida: false, observacao: null });
  });

  it('pendentes vêm do mais antigo para o mais novo, até o limite', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('a'));
    await repo.registrar(serie('b'));
    await repo.registrar(serie('c'));
    await repo.registrar(serie('a', { carga: 21 }));
    expect((await repo.pendentes(2)).map((r) => r.serieUid)).toEqual(['b', 'c']);
    expect((await repo.listar()).map((r) => r.serieUid)).toEqual(['a', 'b', 'c']);
  });

  it('enviados há mais de 60 dias saem do aparelho; pendentes antigos ficam', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('velho', { data: '2026-07-01' }));
    await repo.registrar(serie('pendente', { data: '2026-07-01' }));
    await repo.registrar(serie('novo'));
    const [velho, , novo] = await repo.listar();
    await repo.aplicarResultados(
      [velho, novo],
      [velho, novo].map((r) => ({ id: r.id, situacao: 'ACEITO' as const, motivo: null })),
    );
    expect((await repo.listar()).map((r) => [r.serieUid, r.situacao])).toEqual([
      ['pendente', 'LOCAL'],
      ['novo', 'ENVIADO'],
    ]);
  });

  it('depois de sair da conta não grava mais nada', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('x'));
    await repo.apagarTudo();
    await repo.registrar(serie('y'));
    await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 30);
    expect(await repo.listar()).toEqual([]);
    expect(await repo.lerCargasDeTrabalho()).toEqual({});
  });
});

describe('SQLite no celular', () => {
  let fabrica: FabricaDeTeste;
  beforeEach(() => {
    fabrica = fabricaNode();
  });

  it('um banco por usuário; sair apaga o arquivo', async () => {
    const ana = new RepositorioSqlite(fabrica, 'ana', novoId, agora);
    const bia = new RepositorioSqlite(fabrica, 'bia', novoId, agora);
    await ana.registrar(serie('x'));
    await bia.registrar(serie('y'));
    expect(fabrica.nomes().sort()).toEqual(['treinos-ana.db', 'treinos-bia.db']);
    await ana.apagarTudo();
    expect(fabrica.nomes()).toEqual(['treinos-bia.db']);
  });

  it('a mesma série no mesmo dia é uma linha só (chave única igual à do servidor)', async () => {
    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    await repo.registrar(serie('x', { carga: 30 }));
    await repo.registrar(serie('x', { data: '2026-10-08' }));
    const linhas = await fabrica.banco('treinos-u1.db').todos<{ data: string; carga: number }>(
      'select data, carga from registro order by data',
    );
    expect(linhas).toEqual([
      { data: '2026-10-07', carga: 30 },
      { data: '2026-10-08', carga: 20 },
    ]);
  });

  it('fechar libera a conexão e a próxima operação reabre com os dados', async () => {
    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    await repo.registrar(serie('x'));
    expect(fabrica.abertas()).toBe(1);
    await repo.fechar();
    expect(fabrica.abertas()).toBe(0);
    expect(await repo.listar()).toHaveLength(1);
    expect(fabrica.abertas()).toBe(1);
  });

  it('transação: erro no meio não deixa metade gravada', async () => {
    const banco = fabrica.banco('t.db');
    await banco.executar('create table t (a text not null)');
    await expect(
      banco.transacao(async (t) => {
        await t.rodar('insert into t values (?)', ['ok']);
        await t.rodar('insert into t values (?)', [null]);
      }),
    ).rejects.toThrow();
    expect(await banco.todos('select a from t')).toEqual([]);
  });

  describe('migração do AsyncStorage da versão anterior', () => {
    async function antigo(kv: ChaveValor, usuarioId: string) {
      const velho = new RepositorioChaveValor(kv, usuarioId, novoId, agora);
      await velho.salvarPacote({ marca: { nome: 'Saraiva' } } as unknown as Parameters<RepositorioLocal['salvarPacote']>[0]);
      await velho.salvarCargaDeTrabalho('e1', '2026-10-07', 30);
      const pendente = await velho.registrar(serie('p'));
      const enviado = await velho.registrar(serie('e'));
      await velho.aplicarResultados([enviado], [{ id: enviado.id, situacao: 'ACEITO', motivo: null }]);
      return { pendente, enviado };
    }

    it('traz pacote, cargas e registros (com a situação) e apaga do AsyncStorage', async () => {
      const kv = emMemoria();
      const { pendente } = await antigo(kv, 'u1');
      await kv.gravar('treinos:outro:registros', '[]');
      const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora, kv);
      const registros = await repo.listar();
      expect(registros.map((r) => [r.serieUid, r.situacao])).toEqual([
        ['p', 'LOCAL'],
        ['e', 'ENVIADO'],
      ]);
      expect((await repo.pendentes()).map((r) => r.id)).toEqual([pendente.id]);
      expect((await repo.lerPacote())?.pacote).toEqual({ marca: { nome: 'Saraiva' } });
      expect(await repo.lerCargasDeTrabalho()).toEqual({ 'e1|2026-10-07': 30 });
      expect([...kv.dados.keys()]).toEqual(['treinos:outro:registros']);
    });

    it('não sobrescreve o que já está no SQLite e rodar de novo não muda nada', async () => {
      const kv = emMemoria();
      const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora, kv);
      const atual = await repo.registrar(serie('p', { carga: 40 }));
      await repo.fechar();
      await antigo(kv, 'u1');
      const [r] = (await repo.listar()).filter((x) => x.serieUid === 'p');
      expect(r).toMatchObject({ id: atual.id, carga: 40 });
      expect(kv.dados.size).toBe(0);
    });

    it('registro antigo malformado fica de fora sem travar o app', async () => {
      const kv = emMemoria();
      await kv.gravar('treinos:u1:registros', JSON.stringify([{ id: 'sem-campos' }]));
      await kv.gravar('treinos:u1:pacote', '{json quebrado');
      const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora, kv);
      expect(await repo.listar()).toEqual([]);
      expect(await repo.lerPacote()).toBeNull();
      await repo.registrar(serie('x'));
      expect(await repo.listar()).toHaveLength(1);
    });
  });
});
