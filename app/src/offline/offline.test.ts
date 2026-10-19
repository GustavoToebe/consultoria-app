import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio } from '../api/tipos';
import { chavePasseio } from '../dominio/passeio';
import { chaveDasPreferencias } from '../dominio/preferencias';
import { emMemoria } from './armazenamento';
import { fabricaNode, type FabricaDeTeste } from './bancoNode.apoioTeste';
import { CHAVE_FILAS_RETIDAS, registrarFilaRetida, varrerFilasRetidas } from './filasRetidas';
import { DIAS_FILA_RETIDA, RepositorioChaveValor, type DadosRegistro, type RepositorioLocal } from './repositorioLocal';
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
type Aparelho = (usuarioId: string, relogio?: () => Date) => RepositorioLocal;

const DIA_MS = 86_400_000;

const implementacoes: [string, () => Aparelho][] = [
  [
    'chave-valor (web)',
    () => {
      const kv = emMemoria();
      return (usuarioId, relogioDoTeste = agora) => new RepositorioChaveValor(kv, usuarioId, novoId, relogioDoTeste);
    },
  ],
  [
    'SQLite (celular)',
    () => {
      const fabrica = fabricaNode();
      return (usuarioId, relogioDoTeste = agora) => new RepositorioSqlite(fabrica, usuarioId, novoId, relogioDoTeste);
    },
  ],
];

describe.each(implementacoes)('offline do aluno – %s', (_nome, criarAparelho) => {
  let aparelho: Aparelho;
  beforeEach(() => {
    aparelho = criarAparelho();
  });

  it('rascunho da atualização persiste por pasta, fica isolado e some ao enviar ou sair', async () => {
    const repo = aparelho('u1');
    const salvo = {questionarioVersaoId:'v-uuid-1',respostas:{peso:80.5,sono:7,dor:false,extras:['a','b']}};
    await repo.salvarRascunhoAtualizacao('p1',salvo);
    expect(await aparelho('u2').lerRascunhoAtualizacao('p1')).toBeNull();
    expect(await repo.lerRascunhoAtualizacao('p2')).toBeNull();
    await repo.fechar();
    expect(await aparelho('u1').lerRascunhoAtualizacao('p1')).toEqual(salvo);
    await repo.apagarRascunhoAtualizacao('p1');
    expect(await repo.lerRascunhoAtualizacao('p1')).toBeNull();
    await repo.salvarRascunhoAtualizacao('p2',salvo);
    await repo.apagarTudo();
    await repo.salvarRascunhoAtualizacao('p1',salvo);
    expect(await aparelho('u1').lerRascunhoAtualizacao('p1')).toBeNull();
    expect(await aparelho('u1').lerRascunhoAtualizacao('p2')).toBeNull();
  });

  it('rascunho da anamnese persiste por anamnese, fica isolado, separado do da atualização, e some ao sair', async () => {
    const repo = aparelho('u1');
    const salvo = {questionarioVersaoId:'v-anamnese',respostas:{pratica:true,qual:'Texto fictício'},fotosLocais:{fotos:['f1.jpg']}};
    await repo.salvarRascunhoAnamnese('a1',salvo);
    expect(await aparelho('u2').lerRascunhoAnamnese('a1')).toBeNull();
    expect(await repo.lerRascunhoAtualizacao('a1')).toBeNull();
    await repo.fechar();
    expect(await aparelho('u1').lerRascunhoAnamnese('a1')).toEqual(salvo);
    await repo.apagarRascunhoAnamnese('a1');
    expect(await repo.lerRascunhoAnamnese('a1')).toBeNull();
    await repo.salvarRascunhoAnamnese('a2',salvo);
    await repo.apagarTudo();
    expect(await aparelho('u1').lerRascunhoAnamnese('a2')).toBeNull();
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

  it('mobilidade volta igual, não se mistura entre alunos e some quando o aluno sai da conta', async () => {
    const versao = {
      id: 'v1', planoId: 'p1', numero: 2, titulo: 'Mobilidade', inicio: '2026-10-01', fim: '2026-10-14', publicadoEm: '2026-10-01T10:00:00Z',
      conteudo: { orientacoes: null, secoes: [{ uid: 's1', titulo: 'Alongamentos', itens: [{ uid: 'i1', nome: 'Gato e vaca', prescricao: null, videoUrl: 'https://youtu.be/x' }] }] },
    };
    const ana = aparelho('ana');
    expect(await ana.lerMobilidade()).toBeNull();
    await ana.salvarMobilidade(versao);
    expect(await ana.lerMobilidade()).toEqual(versao);
    expect(await aparelho('bia').lerMobilidade()).toBeNull();
    await ana.apagarTudo();
    expect(await aparelho('ana').lerMobilidade()).toBeNull();
    await ana.salvarMobilidade(null);
    expect(await aparelho('ana').lerMobilidade()).toBeNull();
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

  describe('sessão recusada pelo servidor: guarda só a fila de envio', () => {
    const instante = (t0: number, ms: number) => () => new Date(t0 + ms);

    /** Um aluno com tudo no aparelho: 2 registros na fila, 1 enviado, 1 recusado, plano, dieta, cargas e rascunho. */
    async function encher(repo: RepositorioLocal) {
      await repo.registrar(serie('fila-1'));
      await repo.registrar(serie('fila-2', { carga: 35, repeticoes: 6, observacao: 'pesado' }));
      await repo.registrar(serie('enviada'));
      await repo.registrar(serie('recusada'));
      const todos = await repo.listar();
      const [, , enviada, recusada] = todos;
      await repo.aplicarResultados(
        [enviada, recusada],
        [
          { id: enviada.id, situacao: 'ACEITO', motivo: null },
          { id: recusada.id, situacao: 'RECUSADO', motivo: 'Versão inexistente.' },
        ],
      );
      await repo.salvarPacote({ aluno: { nome: 'Fictício' } } as never);
      await repo.salvarDieta({ id: 'd1' } as never);
      await repo.salvarMobilidade({ id: 'm1' } as never);
      await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 30);
      await repo.salvarRascunhoAtualizacao('p1', { questionarioVersaoId: 'q1', respostas: { peso: 80 } });
      await repo.salvarHistoricoSemana({ versaoId: 'v1', inicio: '2026-10-05', dias: [] });
      return todos;
    }

    it('apaga plano, dieta, mobilidade, rascunho e o resto, e fica só com os registros não enviados', async () => {
      const repo = aparelho('u1');
      const [fila1, fila2] = await encher(repo);
      expect(await repo.reterSoAFila()).toBe(2);

      const depois = aparelho('u1');
      expect(await depois.lerPacote()).toBeNull();
      expect(await depois.lerDieta()).toBeNull();
      expect(await depois.lerMobilidade()).toBeNull();
      expect(await depois.lerAtualizacao()).toBeNull();
      expect(await depois.lerRascunhoAtualizacao('p1')).toBeNull();
      expect(await depois.lerHistoricoSemana()).toBeNull();
      expect(await depois.lerCargasDeTrabalho()).toEqual({});
      // Os dois da fila voltam iguais (mesmo id, para o servidor reconhecer o reenvio); enviado e recusado se foram.
      expect(await depois.listar()).toEqual([fila1, fila2]);
      expect((await depois.pendentes()).map((r) => r.id)).toEqual([fila1.id, fila2.id]);
    });

    it('depois da recusa o repositório antigo não grava mais nada', async () => {
      const repo = aparelho('u1');
      await encher(repo);
      await repo.reterSoAFila();
      await repo.registrar(serie('tarde'));
      await repo.salvarPacote({ aluno: { nome: 'Fictício' } } as never);
      await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 99);
      const depois = aparelho('u1');
      expect((await depois.listar()).map((r) => r.serieUid)).toEqual(['fila-1', 'fila-2']);
      expect(await depois.lerPacote()).toBeNull();
      expect(await depois.lerCargasDeTrabalho()).toEqual({});
    });

    it('sem nada na fila apaga tudo, como sair', async () => {
      const repo = aparelho('u1');
      await repo.registrar(serie('x'));
      const [x] = await repo.listar();
      await repo.aplicarResultados([x], [{ id: x.id, situacao: 'ACEITO', motivo: null }]);
      await repo.salvarPacote({ aluno: { nome: 'Fictício' } } as never);
      expect(await repo.reterSoAFila()).toBe(0);
      const depois = aparelho('u1');
      expect(await depois.listar()).toEqual([]);
      expect(await depois.lerPacote()).toBeNull();
      expect(await depois.descartarFilaRetidaVencida()).toBe('nenhuma');
    });

    it('o mesmo usuário que entra de novo envia a fila, e reenviar não duplica', async () => {
      const repo = aparelho('u1');
      const [fila1, fila2] = await encher(repo);
      await repo.reterSoAFila();

      const volta = aparelho('u1');
      expect(await volta.descartarFilaRetidaVencida()).toBe('retida');
      expect(await volta.retomarFilaRetida()).toBe(true);
      expect(await volta.retomarFilaRetida()).toBe(false);

      const enviados: RegistroEnvio[] = [];
      const sincronizador = new Sincronizador(volta, async (registros) => {
        enviados.push(...registros);
        return aceitaTudo(registros);
      });
      expect(await sincronizador.sincronizar()).toEqual({ tipo: 'ok', enviados: 2 });
      // O servidor é idempotente por id: o envio leva os mesmos ids que o aparelho já tinha antes da recusa.
      expect(enviados.map((e) => e.id)).toEqual([fila1.id, fila2.id]);
      expect(enviados[1]).toMatchObject({ carga: 35, repeticoes: 6, observacao: 'pesado', concluida: true });
      expect((await volta.listar()).map((r) => r.situacao)).toEqual(['ENVIADO', 'ENVIADO']);
      expect(await volta.pendentes()).toEqual([]);
      // Marca tirada: nada mais a descartar por prazo.
      expect(await aparelho('u1').descartarFilaRetidaVencida()).toBe('nenhuma');
    });

    it('outro usuário no aparelho não vê nem envia a fila do primeiro', async () => {
      const ana = aparelho('ana');
      await ana.registrar(serie('da-ana'));
      await ana.registrar(serie('da-ana-2'));
      await ana.reterSoAFila();

      const bia = aparelho('bia');
      await bia.descartarFilaRetidaVencida();
      await bia.retomarFilaRetida();
      expect(await bia.listar()).toEqual([]);
      expect(await bia.pendentes()).toEqual([]);
      const enviar = jest.fn(aceitaTudo);
      expect(await new Sincronizador(bia, enviar).sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
      expect(enviar).not.toHaveBeenCalled();

      // A fila da Ana continua separada e retida, mesmo depois de a Bia registrar e enviar.
      await bia.registrar(serie('da-bia'));
      await new Sincronizador(bia, enviar).sincronizar();
      expect(enviar.mock.calls.flatMap(([lote]) => lote.map((r) => r.serieUid))).toEqual(['da-bia']);
      const anaDepois = aparelho('ana');
      expect(await anaDepois.descartarFilaRetidaVencida()).toBe('retida');
      expect((await anaDepois.listar()).map((r) => r.serieUid)).toEqual(['da-ana', 'da-ana-2']);
    });

    it(`a fila vence em ${DIAS_FILA_RETIDA} dias e some inteira; o repositório segue usável`, async () => {
      const t0 = Date.parse('2026-10-07T12:00:00Z');
      const repo = aparelho('u1', instante(t0, 0));
      await encher(repo);
      await repo.reterSoAFila();

      const quase = aparelho('u1', instante(t0, DIAS_FILA_RETIDA * DIA_MS - 1000));
      expect(await quase.descartarFilaRetidaVencida()).toBe('retida');
      expect(await quase.listar()).toHaveLength(2);

      const vencida = aparelho('u1', instante(t0, DIAS_FILA_RETIDA * DIA_MS));
      expect(await vencida.descartarFilaRetidaVencida()).toBe('vencida');
      expect(await vencida.listar()).toEqual([]);
      expect(await vencida.pendentes()).toEqual([]);
      expect(await vencida.descartarFilaRetidaVencida()).toBe('nenhuma');
      // Quem entra depois do prazo começa do zero e grava normalmente.
      await vencida.registrar(serie('novo'));
      expect((await vencida.listar()).map((r) => r.serieUid)).toEqual(['novo']);
    });

    it('a varredura do aparelho apaga a fila vencida de qualquer usuário, sem enviar e sem tocar nas outras', async () => {
      const listaDeFilas = emMemoria();
      const t0 = Date.parse('2026-10-07T12:00:00Z');
      for (const id of ['ana', 'bia']) {
        const repo = aparelho(id, instante(t0, id === 'ana' ? 0 : 10 * DIA_MS));
        await repo.registrar(serie(`de-${id}`));
        await repo.reterSoAFila();
        await registrarFilaRetida(id, { kv: listaDeFilas });
      }
      await registrarFilaRetida('ana', { kv: listaDeFilas });
      expect(JSON.parse((await listaDeFilas.ler(CHAVE_FILAS_RETIDAS)) ?? '[]')).toEqual(['ana', 'bia']);

      const abrir = (id: string) => aparelho(id, instante(t0, DIAS_FILA_RETIDA * DIA_MS + 1000));
      expect(await varrerFilasRetidas({ kv: listaDeFilas, abrir })).toBe(1);
      expect(await aparelho('ana').listar()).toEqual([]);
      expect((await aparelho('bia').listar()).map((r) => r.serieUid)).toEqual(['de-bia']);
      expect(JSON.parse((await listaDeFilas.ler(CHAVE_FILAS_RETIDAS)) ?? '[]')).toEqual(['bia']);

      // Quem acabou de entrar fica de fora da varredura: o provider dele é que cuida da fila.
      const daAna = aparelho('ana', instante(t0, 0));
      await daAna.registrar(serie('de-ana-2'));
      await daAna.reterSoAFila();
      await registrarFilaRetida('ana', { kv: listaDeFilas });
      const todosVencidos = (id: string) => aparelho(id, instante(t0, 90 * DIA_MS));
      expect(await varrerFilasRetidas({ kv: listaDeFilas, abrir: todosVencidos, exceto: 'ana' })).toBe(1);
      expect((await aparelho('ana').listar()).map((r) => r.serieUid)).toEqual(['de-ana-2']);
      expect(JSON.parse((await listaDeFilas.ler(CHAVE_FILAS_RETIDAS)) ?? '[]')).toEqual(['ana']);
      await varrerFilasRetidas({ kv: listaDeFilas, abrir: todosVencidos });
      expect(await listaDeFilas.ler(CHAVE_FILAS_RETIDAS)).toBeNull();
    });

    it('a varredura para quando a fila da Bia vence depois da da Ana', async () => {
      const listaDeFilas = emMemoria();
      const t0 = Date.parse('2026-10-07T12:00:00Z');
      for (const id of ['ana', 'bia']) {
        const repo = aparelho(id, instante(t0, id === 'ana' ? 0 : 10 * DIA_MS));
        await repo.registrar(serie(`de-${id}`));
        await repo.reterSoAFila();
        await registrarFilaRetida(id, { kv: listaDeFilas });
      }
      await varrerFilasRetidas({ kv: listaDeFilas, abrir: (id) => aparelho(id, instante(t0, DIAS_FILA_RETIDA * DIA_MS + 1000)) });
      // Mais tarde a da Bia também vence e a lista some.
      const maisTarde = (id: string) => aparelho(id, instante(t0, 41 * DIA_MS));
      expect(await varrerFilasRetidas({ kv: listaDeFilas, abrir: maisTarde })).toBe(1);
      expect(await listaDeFilas.ler(CHAVE_FILAS_RETIDAS)).toBeNull();
    });
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

  it('sessão recusada: sobra no arquivo só a tabela de registros com a fila e a marca', async () => {
    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    await repo.registrar(serie('fila'));
    await repo.registrar(serie('enviada'));
    const [, enviada] = await repo.listar();
    await repo.aplicarResultados([enviada], [{ id: enviada.id, situacao: 'ACEITO', motivo: null }]);
    await repo.salvarDieta({ id: 'd1' } as never);
    await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 30);
    await repo.reterSoAFila();
    const banco = fabrica.banco('treinos-u1.db');
    expect((await banco.todos<{ chave: string }>('select chave from kv')).map((l) => l.chave)).toEqual(['filaRetida']);
    expect(await banco.todos('select * from carga_trabalho')).toEqual([]);
    expect((await banco.todos<{ serie_uid: string }>('select serie_uid from registro')).map((l) => l.serie_uid)).toEqual(['fila']);
    expect(fabrica.abertas()).toBe(0);
  });

  it('sessão recusada sem fila apaga o arquivo; fila vencida esvazia as tabelas sem apagar o arquivo', async () => {
    const vazio = new RepositorioSqlite(fabrica, 'vazio', novoId, agora);
    await vazio.salvarDieta({ id: 'd1' } as never);
    await vazio.reterSoAFila();
    expect(fabrica.nomes()).not.toContain('treinos-vazio.db');

    const t0 = Date.parse('2026-10-07T12:00:00Z');
    const com = new RepositorioSqlite(fabrica, 'com', novoId, () => new Date(t0));
    await com.registrar(serie('x'));
    await com.reterSoAFila();
    expect(fabrica.nomes()).toContain('treinos-com.db');
    const tarde = new RepositorioSqlite(fabrica, 'com', novoId, () => new Date(t0 + DIAS_FILA_RETIDA * DIA_MS));
    expect(await tarde.descartarFilaRetidaVencida()).toBe('vencida');
    // O arquivo fica (outra conexão aberta o faria falhar ao apagar); o que importa é estar vazio.
    const banco = fabrica.banco('treinos-com.db');
    expect(await banco.todos('select * from registro')).toEqual([]);
    expect(await banco.todos('select * from kv')).toEqual([]);
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
});

describe('sessão recusada na web (chave-valor)', () => {
  it('sobram só os registros não enviados, a marca e o que já sobrevive ao sair; "Sair" depois apaga a fila também', async () => {
    const kv = emMemoria();
    const preferencias = chaveDasPreferencias('ana');
    for (const chave of [preferencias, chavePasseio('ana'), 'treinos:ana:favoritos', 'treinos:ana:pacote', 'treinos:bia:favoritos']) {
      await kv.gravar(chave, '1');
    }
    const ana = new RepositorioChaveValor(kv, 'ana', novoId, agora);
    await ana.registrar(serie('x'));
    await ana.reterSoAFila();
    const restam = (await kv.chaves()).filter((c) => c.startsWith('treinos:'));
    expect([...restam].sort()).toEqual(
      [preferencias, chavePasseio('ana'), 'treinos:ana:registros', 'treinos:ana:filaRetida', 'treinos:bia:favoritos'].sort(),
    );
    // A pessoa ainda tocou em "Sair" a tempo: aí a fila também vai embora.
    await new RepositorioChaveValor(kv, 'ana', novoId, agora).apagarTudo();
    expect((await kv.chaves()).filter((c) => c.startsWith('treinos:ana:')).sort()).toEqual([preferencias, chavePasseio('ana')].sort());
  });
});

describe('sair da conta na web (chave-valor)', () => {
  it('guarda só a preferência de tela e o passeio já visto, e apenas as de quem saiu', async () => {
    const kv = emMemoria();
    const mantidas = [chaveDasPreferencias('ana'), chavePasseio('ana'), chaveDasPreferencias('bia'), chavePasseio('bia')];
    for (const chave of [...mantidas, 'treinos:ana:favoritos', 'treinos:ana:lembreteAtualizacaoPerguntado', 'treinos:bia:favoritos']) {
      await kv.gravar(chave, '1');
    }
    const ana = new RepositorioChaveValor(kv, 'ana', novoId, agora);
    await ana.registrar(serie('x'));
    await ana.apagarTudo();
    const restam = (await kv.chaves()).filter((c) => c.startsWith('treinos:'));
    expect([...restam].sort()).toEqual([...mantidas, 'treinos:bia:favoritos'].sort());
    expect(await ana.listar()).toEqual([]);
  });
});
