import { ErroApi } from '../api/cliente';
import type { EtapaRegistrada, LoteResponse, RegistroEnvio, RegistroMobilidadeEnvio } from '../api/tipos';
import { chavePasseio } from '../dominio/passeio';
import { chaveDasPreferencias } from '../dominio/preferencias';
import { emMemoria } from './armazenamento';
import { fabricaNode, type FabricaDeTeste } from './bancoNode.apoioTeste';
import { CHAVE_FILAS_RETIDAS, registrarFilaRetida, varrerFilasRetidas } from './filasRetidas';
import { VERSAO_ESQUEMA } from './banco';
import { DIAS_FILA_RETIDA, RepositorioChaveValor, type DadosMobilidade, type DadosRegistro, type RepositorioLocal } from './repositorioLocal';
import { RepositorioSqlite } from './repositorioSqlite';
import { MOTIVO_MOBILIDADE_FORA_DO_PLANO, Sincronizador } from './sincronizacao';

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
    etapas: null,
    referenciaCarga: null,
    referenciaOrigem: null,
    ...extra,
  };
}

const aceitaTudoMobilidade = async (registros: RegistroMobilidadeEnvio[]): Promise<LoteResponse> => ({
  resultados: registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })),
});

const aceitaTudo = async (registros: RegistroEnvio[]): Promise<LoteResponse> => ({
  resultados: registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })),
});

/** Sincronizador que aceita toda a mobilidade: os testes das séries não mexem nela. */
const sincronizadorDe = (repo: RepositorioLocal, enviar: (registros: RegistroEnvio[]) => Promise<LoteResponse>) =>
  new Sincronizador(repo, enviar, aceitaTudoMobilidade);

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

  it('descarta pacote antigo sem apagar a fila e permite baixar o formato atual', async () => {
    const repo = aparelho('u1');
    await repo.registrar(serie('fila'));
    const atual = { treino: { conteudo: { sessoes: [{ uid: 'x', exercicios: [{ uid: 'e', series: [{ uid: 's1', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 0 }, descansoSegundos: null, tecnica: null }] }], grupos: [] }] } }, configuracao: { tipoTrabalho: 'WS', arredondamentoKg: 0.5 } };
    const antigo = JSON.parse(JSON.stringify(atual));
    antigo.treino.conteudo.sessoes[0].exercicios[0].series[0] = { uid: 's1', tipo: 'WS', repsMin: 3, repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO', rir: 0 }, descansoSegundos: null, tecnica: null };
    antigo.treino.conteudo.sessoes[0].exercicios[0].series[0].alvoTexto = 'formato antigo';
    await repo.salvarPacote(antigo);
    expect(await repo.lerPacote()).toBeNull();
    expect(await repo.listar()).toHaveLength(1);
    await repo.salvarPacote(atual as never);
    expect((await repo.lerPacote())?.pacote).toEqual(atual);
  });

  it('etapas da série (Cluster, Rest-pause) persistem ao reabrir, são trocadas inteiras e vão no envio (T18)', async () => {
    const etapas: EtapaRegistrada[] = [
      { posicao: 1, repeticoes: 4, carga: 40, situacao: 'FEITA' },
      { posicao: 2, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' },
    ];
    const repo = aparelho('u1');
    await repo.registrar(serie('cl', { etapas, referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA', concluida: false, carga: 40, repeticoes: null }));
    await repo.fechar();
    const reaberto = aparelho('u1');
    expect((await reaberto.listar())[0]).toMatchObject({ etapas, referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA', concluida: false, repeticoes: null });
    // A lista é trocada inteira (desfazer uma etapa tira a etapa), sem fundir com a anterior e sem duplicar a série.
    await reaberto.registrar(serie('cl', { etapas: [etapas[0]], referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA', concluida: false }));
    const lista = await reaberto.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].etapas).toEqual([etapas[0]]);
    const enviados: RegistroEnvio[] = [];
    const sync = sincronizadorDe(reaberto, async (r) => {
      enviados.push(...r);
      return aceitaTudo(r);
    });
    await sync.sincronizar();
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ etapas: [etapas[0]], referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA' });
    // Série sem etapas vai com a lista nula.
    await reaberto.registrar(serie('ws'));
    await sync.sincronizar();
    expect(enviados[1]).toMatchObject({ serieUid: 'ws', etapas: null, referenciaCarga: null, referenciaOrigem: null });
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
    const salvo = {inicio:'2026-10-05',dias:[{data:'2026-10-05',sessoes:[]}]};
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
    const sync = sincronizadorDe(repo, async (r) => {
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
    const sync = sincronizadorDe(repo, async (r) => {
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
    const sync = sincronizadorDe(repo, async (r) => ({
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
    const sync = sincronizadorDe(repo, async () => {
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
    const sync = sincronizadorDe(repo, async (r) => {
      chamadas++;
      return aceitaTudo(r);
    });
    await Promise.all([sync.sincronizar(), sync.sincronizar()]);
    expect(chamadas).toBe(1);
  });

  it('pacote, dieta e carga de trabalho voltam iguais', async () => {
    const repo = aparelho('u1');
    const pacote = { treino: null, marca: { nome: 'X' }, configuracao: { tipoTrabalho: 'WS', arredondamentoKg: 0.5 } } as unknown as Parameters<RepositorioLocal['salvarPacote']>[0];
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

  it('demonstrações voltam iguais, não se misturam entre alunos e somem quando o aluno sai da conta', async () => {
    const lista = [
      { exercicioId: 'e1', imagens: ['Air_Bike/0.jpg', 'Air_Bike/1.jpg'], imagemPropriaEm: null },
      { exercicioId: 'e2', imagens: [], imagemPropriaEm: '2026-10-20T12:00:00Z' },
    ];
    const ana = aparelho('ana');
    expect(await ana.lerDemonstracoes()).toEqual([]);
    await ana.salvarDemonstracoes(lista);
    expect(await ana.lerDemonstracoes()).toEqual(lista);
    expect(await aparelho('bia').lerDemonstracoes()).toEqual([]);
    await ana.apagarTudo();
    expect(await aparelho('ana').lerDemonstracoes()).toEqual([]);
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
      await repo.salvarDemonstracoes([{ exercicioId: 'e1', imagens: ['A/0.jpg'], imagemPropriaEm: null }]);
      await repo.salvarCargaDeTrabalho('e1', '2026-10-07', 30);
      await repo.salvarRascunhoAtualizacao('p1', { questionarioVersaoId: 'q1', respostas: { peso: 80 } });
      await repo.salvarHistoricoSemana({ inicio: '2026-10-05', dias: [] });
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
      expect(await depois.lerDemonstracoes()).toEqual([]);
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
      const sincronizador = sincronizadorDe(volta, async (registros) => {
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
      expect(await sincronizadorDe(bia, enviar).sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
      expect(enviar).not.toHaveBeenCalled();

      // A fila da Ana continua separada e retida, mesmo depois de a Bia registrar e enviar.
      await bia.registrar(serie('da-bia'));
      await sincronizadorDe(bia, enviar).sincronizar();
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

function item(itemUid: string, extra: Partial<DadosMobilidade> = {}): DadosMobilidade {
  return { planoVersaoId: 'mv1', secaoUid: 'sec1', itemUid, data: '2026-10-07', feito: true, ...extra };
}

/**
 * Mobilidade marcada: a mesma bateria nas duas implementações. Ela entra na mesma fila de envio das séries (mesmo
 * repositório, sincronizador, ciclo e retenção), mas num depósito próprio que o treino não enxerga.
 */
describe.each(implementacoes)('mobilidade na fila de envio – %s', (_nome, criarAparelho) => {
  let aparelho: Aparelho;
  beforeEach(() => {
    aparelho = criarAparelho();
  });

  const instante = (t0: number, ms: number) => () => new Date(t0 + ms);

  it('marcar e desmarcar o mesmo item no mesmo dia é o mesmo registro (mesmo id, o último valor vale)', async () => {
    const repo = aparelho('u1');
    const a = await repo.registrarMobilidade(item('i1'));
    const b = await repo.registrarMobilidade(item('i1', { feito: false }));
    expect(b.id).toBe(a.id);
    expect(b.alteradoEm > a.alteradoEm).toBe(true);
    expect(b).toMatchObject({ feito: false, situacao: 'LOCAL', motivo: null });
    // Outro dia, outro item e outra versão são registros diferentes.
    const outroDia = await repo.registrarMobilidade(item('i1', { data: '2026-10-08' }));
    const outroItem = await repo.registrarMobilidade(item('i2'));
    const outraVersao = await repo.registrarMobilidade(item('i1', { planoVersaoId: 'mv2' }));
    expect(new Set([a.id, outroDia.id, outroItem.id, outraVersao.id]).size).toBe(4);
    expect(await repo.listarMobilidade()).toHaveLength(4);
  });

  it('é um depósito à parte: não aparece como série nem entra nos pendentes do treino', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    await repo.registrar(serie('s1'));
    expect((await repo.listar()).map((r) => r.serieUid)).toEqual(['s1']);
    expect((await repo.pendentes()).map((r) => r.serieUid)).toEqual(['s1']);
    expect((await repo.pendentesMobilidade()).map((r) => r.itemUid)).toEqual(['i1']);
  });

  it('pendentes vêm do mais antigo para o mais novo, até o limite', async () => {
    const repo = aparelho('u1');
    for (const uid of ['a', 'b', 'c']) await repo.registrarMobilidade(item(uid));
    await repo.registrarMobilidade(item('a', { feito: false })); // mexeu de novo: agora é o mais novo
    expect((await repo.pendentesMobilidade()).map((r) => r.itemUid)).toEqual(['b', 'c', 'a']);
    expect((await repo.pendentesMobilidade(2)).map((r) => r.itemUid)).toEqual(['b', 'c']);
  });

  it('volta com o tipo certo (feito é booleano) depois de fechar e reabrir', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    await repo.registrarMobilidade(item('i2', { feito: false }));
    await repo.fechar();
    const lista = await aparelho('u1').listarMobilidade();
    expect(lista.map((r) => [r.itemUid, r.feito])).toEqual([['i1', true], ['i2', false]]);
  });

  it('o mesmo ciclo envia séries e mobilidade, e reenviar não manda de novo o que foi aceito', async () => {
    const repo = aparelho('u1');
    const marcado = await repo.registrarMobilidade(item('i1'));
    await repo.registrar(serie('s1'));
    const series: RegistroEnvio[] = [];
    const itens: RegistroMobilidadeEnvio[] = [];
    const sync = new Sincronizador(
      repo,
      async (r) => {
        series.push(...r);
        return aceitaTudo(r);
      },
      async (r) => {
        itens.push(...r);
        return aceitaTudoMobilidade(r);
      },
    );
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 2 });
    expect(series.map((r) => r.serieUid)).toEqual(['s1']);
    expect(itens).toEqual([
      { id: marcado.id, planoVersaoId: 'mv1', secaoUid: 'sec1', itemUid: 'i1', data: '2026-10-07', feito: true, alteradoNoAparelhoEm: marcado.alteradoEm },
    ]);
    expect((await repo.listarMobilidade()).map((r) => r.situacao)).toEqual(['ENVIADO']);
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
    expect(itens).toHaveLength(1);
  });

  it('desmarcar depois de enviado manda o mesmo id com feito falso', async () => {
    const repo = aparelho('u1');
    const marcado = await repo.registrarMobilidade(item('i1'));
    const itens: RegistroMobilidadeEnvio[] = [];
    const sync = new Sincronizador(repo, aceitaTudo, async (r) => {
      itens.push(...r);
      return aceitaTudoMobilidade(r);
    });
    await sync.sincronizar();
    await repo.registrarMobilidade(item('i1', { feito: false }));
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 1 });
    expect(itens.map((r) => [r.id, r.feito])).toEqual([[marcado.id, true], [marcado.id, false]]);
  });

  it('item alterado durante o envio continua pendente', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    const sync = new Sincronizador(repo, aceitaTudo, async (r) => {
      await repo.registrarMobilidade(item('i1', { feito: false }));
      return aceitaTudoMobilidade(r);
    });
    await sync.sincronizar();
    const [i1] = await repo.listarMobilidade();
    expect(i1).toMatchObject({ feito: false, situacao: 'LOCAL' });
    expect(await repo.pendentesMobilidade()).toHaveLength(1);
  });

  it('RECUSADO vira FALHOU com motivo, e "tentar de novo" põe séries e mobilidade de volta na fila', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    await repo.registrar(serie('s1'));
    const sync = new Sincronizador(
      repo,
      async (r) => ({ resultados: r.map((x) => ({ id: x.id, situacao: 'RECUSADO' as const, motivo: 'Série recusada.' })) }),
      async (r) => ({ resultados: r.map((x) => ({ id: x.id, situacao: 'RECUSADO' as const, motivo: 'Item não existe nesta versão da mobilidade.' })) }),
    );
    await sync.sincronizar();
    const [recusado] = await repo.listarMobilidade();
    expect(recusado).toMatchObject({ situacao: 'FALHOU', motivo: 'Item não existe nesta versão da mobilidade.' });
    expect(await repo.pendentesMobilidade()).toEqual([]);
    expect(await repo.reenviarFalhas()).toBe(2);
    expect((await repo.pendentesMobilidade()).map((r) => r.itemUid)).toEqual(['i1']);
    expect((await repo.pendentes()).map((r) => r.serieUid)).toEqual(['s1']);
  });

  it('mobilidade fora do plano (403) falha com o motivo, sem derrubar o ciclo nem as séries', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    await repo.registrarMobilidade(item('i2'));
    await repo.registrar(serie('s1'));
    let tentativas = 0;
    const sync = new Sincronizador(repo, aceitaTudo, async () => {
      tentativas++;
      throw new ErroApi(403, 'FUNCIONALIDADE_FORA_DO_PLANO', 'Funcionalidade fora do plano.');
    });
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 1 });
    expect(tentativas).toBe(1);
    expect((await repo.listarMobilidade()).map((r) => [r.situacao, r.motivo])).toEqual([
      ['FALHOU', MOTIVO_MOBILIDADE_FORA_DO_PLANO],
      ['FALHOU', MOTIVO_MOBILIDADE_FORA_DO_PLANO],
    ]);
    expect((await repo.listar()).map((r) => r.situacao)).toEqual(['ENVIADO']);
    // Não repete em laço: sem pendência, o próximo ciclo nem chama a rota.
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
    expect(tentativas).toBe(1);
  });

  it('depois do 403, uma marcação nova é tentada uma vez no ciclo seguinte e o aluno lê um texto neutro', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    let tentativas = 0;
    const sync = new Sincronizador(repo, aceitaTudo, async () => {
      tentativas++;
      throw new ErroApi(403, 'FUNCIONALIDADE_FORA_DO_PLANO', 'Funcionalidade fora do plano.');
    });
    await sync.sincronizar();
    await repo.registrarMobilidade(item('i2'));
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
    expect(tentativas).toBe(2);
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 0 });
    expect(tentativas).toBe(2);
    const motivos = (await repo.listarMobilidade()).map((r) => r.motivo ?? '');
    expect(motivos).toEqual([MOTIVO_MOBILIDADE_FORA_DO_PLANO, MOTIVO_MOBILIDADE_FORA_DO_PLANO]);
    expect(MOTIVO_MOBILIDADE_FORA_DO_PLANO).not.toMatch(/403|FUNCIONALIDADE|plano|API/i);
  });

  it('sem conexão a mobilidade continua LOCAL; outro 4xx é erro do lote', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    const semRede = new Sincronizador(repo, aceitaTudo, async () => {
      throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão');
    });
    expect(await semRede.sincronizar()).toEqual({ tipo: 'semConexao' });
    const recusa = new Sincronizador(repo, aceitaTudo, async () => {
      throw new ErroApi(400, 'REQUISICAO_INVALIDA', 'Lote inválido.');
    });
    expect(await recusa.sincronizar()).toEqual({ tipo: 'erro', mensagem: 'Lote inválido.' });
    expect((await repo.listarMobilidade())[0].situacao).toBe('LOCAL');
  });

  it('séries com falha de rede não deixam a mobilidade passar na frente', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('i1'));
    await repo.registrar(serie('s1'));
    const enviarMobilidade = jest.fn(aceitaTudoMobilidade);
    const sync = new Sincronizador(
      repo,
      async () => {
        throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão');
      },
      enviarMobilidade,
    );
    expect(await sync.sincronizar()).toEqual({ tipo: 'semConexao' });
    expect(enviarMobilidade).not.toHaveBeenCalled();
  });

  it('lote de 300 por vez', async () => {
    const repo = aparelho('u1');
    for (let i = 0; i < 305; i++) await repo.registrarMobilidade(item(`i${i}`));
    const tamanhos: number[] = [];
    const sync = new Sincronizador(repo, aceitaTudo, async (r) => {
      tamanhos.push(r.length);
      return aceitaTudoMobilidade(r);
    });
    expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 305 });
    expect(tamanhos).toEqual([300, 5]);
  });

  it('dois alunos no mesmo aparelho não se misturam, e sair apaga só a mobilidade de quem saiu', async () => {
    const ana = aparelho('ana');
    const bia = aparelho('bia');
    await ana.registrarMobilidade(item('i1'));
    expect(await bia.listarMobilidade()).toEqual([]);
    await bia.registrarMobilidade(item('i2'));
    await ana.apagarTudo();
    expect(await ana.listarMobilidade()).toEqual([]);
    expect((await bia.listarMobilidade()).map((r) => r.itemUid)).toEqual(['i2']);
    // Depois de sair, o repositório antigo não grava mais nada.
    await ana.registrarMobilidade(item('i3'));
    expect(await aparelho('ana').listarMobilidade()).toEqual([]);
  });

  it('enviados há mais de 60 dias saem do aparelho; pendentes antigos ficam', async () => {
    const repo = aparelho('u1');
    await repo.registrarMobilidade(item('velho', { data: '2026-07-01' }));
    await repo.registrarMobilidade(item('pendente', { data: '2026-07-01' }));
    await repo.registrarMobilidade(item('novo'));
    const [velho, , novo] = await repo.listarMobilidade();
    await repo.aplicarResultadosMobilidade(
      [velho, novo],
      [velho, novo].map((r) => ({ id: r.id, situacao: 'ACEITO' as const, motivo: null })),
    );
    expect((await repo.listarMobilidade()).map((r) => [r.itemUid, r.situacao])).toEqual([
      ['pendente', 'LOCAL'],
      ['novo', 'ENVIADO'],
    ]);
  });

  describe('sessão recusada pelo servidor', () => {
    it('com só mobilidade na fila retém o que está LOCAL, apaga o resto e o mesmo usuário envia ao voltar', async () => {
      const repo = aparelho('u1');
      const fila1 = await repo.registrarMobilidade(item('fila-1'));
      const fila2 = await repo.registrarMobilidade(item('fila-2', { feito: false }));
      await repo.registrarMobilidade(item('enviado'));
      await repo.registrarMobilidade(item('recusado'));
      const todos = await repo.listarMobilidade();
      const [, , enviado, recusado] = todos;
      await repo.aplicarResultadosMobilidade(
        [enviado, recusado],
        [
          { id: enviado.id, situacao: 'ACEITO', motivo: null },
          { id: recusado.id, situacao: 'RECUSADO', motivo: 'Item não existe nesta versão da mobilidade.' },
        ],
      );
      // Uma série já enviada não é fila: não pode segurar o arquivo nem ficar no aparelho.
      await repo.registrar(serie('s-enviada'));
      const [s] = await repo.listar();
      await repo.aplicarResultados([s], [{ id: s.id, situacao: 'ACEITO', motivo: null }]);
      await repo.salvarMobilidade({ id: 'm1' } as never);

      expect(await repo.reterSoAFila()).toBe(2);

      const volta = aparelho('u1');
      expect(await volta.lerMobilidade()).toBeNull();
      expect(await volta.listar()).toEqual([]);
      expect(await volta.listarMobilidade()).toEqual([fila1, fila2]);
      expect(await volta.descartarFilaRetidaVencida()).toBe('retida');
      expect(await volta.retomarFilaRetida()).toBe(true);

      const itens: RegistroMobilidadeEnvio[] = [];
      const sync = new Sincronizador(volta, aceitaTudo, async (r) => {
        itens.push(...r);
        return aceitaTudoMobilidade(r);
      });
      expect(await sync.sincronizar()).toEqual({ tipo: 'ok', enviados: 2 });
      // Os mesmos ids de antes da recusa: o servidor reconhece o reenvio.
      expect(itens.map((r) => [r.id, r.feito])).toEqual([[fila1.id, true], [fila2.id, false]]);
      expect(await aparelho('u1').descartarFilaRetidaVencida()).toBe('nenhuma');
    });

    it('série e mobilidade na fila ficam juntas; sem nenhuma das duas apaga tudo', async () => {
      const repo = aparelho('u1');
      await repo.registrar(serie('s1'));
      await repo.registrarMobilidade(item('i1'));
      expect(await repo.reterSoAFila()).toBe(2);
      const volta = aparelho('u1');
      expect((await volta.listar()).map((r) => r.serieUid)).toEqual(['s1']);
      expect((await volta.listarMobilidade()).map((r) => r.itemUid)).toEqual(['i1']);

      const vazio = aparelho('vazio');
      await vazio.registrarMobilidade(item('i1'));
      const [i1] = await vazio.listarMobilidade();
      await vazio.aplicarResultadosMobilidade([i1], [{ id: i1.id, situacao: 'ACEITO', motivo: null }]);
      expect(await vazio.reterSoAFila()).toBe(0);
      const depois = aparelho('vazio');
      expect(await depois.listarMobilidade()).toEqual([]);
      expect(await depois.descartarFilaRetidaVencida()).toBe('nenhuma');
    });

    it(`a fila só de mobilidade vence em ${DIAS_FILA_RETIDA} dias e some inteira; o repositório segue usável`, async () => {
      const t0 = Date.parse('2026-10-07T12:00:00Z');
      const repo = aparelho('u1', instante(t0, 0));
      await repo.registrarMobilidade(item('i1'));
      await repo.reterSoAFila();

      const quase = aparelho('u1', instante(t0, DIAS_FILA_RETIDA * DIA_MS - 1000));
      expect(await quase.descartarFilaRetidaVencida()).toBe('retida');
      expect(await quase.listarMobilidade()).toHaveLength(1);

      const vencida = aparelho('u1', instante(t0, DIAS_FILA_RETIDA * DIA_MS));
      expect(await vencida.descartarFilaRetidaVencida()).toBe('vencida');
      expect(await vencida.listarMobilidade()).toEqual([]);
      expect(await vencida.pendentesMobilidade()).toEqual([]);
      await vencida.registrarMobilidade(item('novo'));
      expect((await vencida.listarMobilidade()).map((r) => r.itemUid)).toEqual(['novo']);
    });

    it('a varredura do aparelho apaga a fila de mobilidade vencida sem enviar nada', async () => {
      const listaDeFilas = emMemoria();
      const t0 = Date.parse('2026-10-07T12:00:00Z');
      const repo = aparelho('ana', instante(t0, 0));
      await repo.registrarMobilidade(item('i1'));
      await repo.reterSoAFila();
      await registrarFilaRetida('ana', { kv: listaDeFilas });
      const abrir = (id: string) => aparelho(id, instante(t0, DIAS_FILA_RETIDA * DIA_MS + 1000));
      expect(await varrerFilasRetidas({ kv: listaDeFilas, abrir })).toBe(1);
      expect(await aparelho('ana').listarMobilidade()).toEqual([]);
    });
  });
});

describe('mobilidade no SQLite do celular', () => {
  let fabrica: FabricaDeTeste;
  beforeEach(() => {
    fabrica = fabricaNode();
  });

  it('o mesmo item no mesmo dia é uma linha só (chave única: versão, item e dia)', async () => {
    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    await repo.registrarMobilidade(item('i1'));
    await repo.registrarMobilidade(item('i1', { feito: false }));
    await repo.registrarMobilidade(item('i1', { data: '2026-10-08' }));
    const linhas = await fabrica.banco('treinos-u1.db').todos<{ data: string; feito: number }>(
      'select data, feito from registro_mobilidade order by data',
    );
    expect(linhas).toEqual([
      { data: '2026-10-07', feito: 0 },
      { data: '2026-10-08', feito: 1 },
    ]);
  });

  it('sessão recusada: a tabela de mobilidade guarda só o que está na fila', async () => {
    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    await repo.registrarMobilidade(item('fila'));
    await repo.registrarMobilidade(item('enviado'));
    const [, enviado] = await repo.listarMobilidade();
    await repo.aplicarResultadosMobilidade([enviado], [{ id: enviado.id, situacao: 'ACEITO', motivo: null }]);
    await repo.reterSoAFila();
    const banco = fabrica.banco('treinos-u1.db');
    expect((await banco.todos<{ item_uid: string }>('select item_uid from registro_mobilidade')).map((l) => l.item_uid)).toEqual(['fila']);
    expect(await banco.todos('select * from registro')).toEqual([]);
    expect(fabrica.abertas()).toBe(0);
  });

  it('fila vencida esvazia a tabela de mobilidade sem apagar o arquivo', async () => {
    const t0 = Date.parse('2026-10-07T12:00:00Z');
    const com = new RepositorioSqlite(fabrica, 'com', novoId, () => new Date(t0));
    await com.registrarMobilidade(item('i1'));
    await com.reterSoAFila();
    const tarde = new RepositorioSqlite(fabrica, 'com', novoId, () => new Date(t0 + DIAS_FILA_RETIDA * DIA_MS));
    expect(await tarde.descartarFilaRetidaVencida()).toBe('vencida');
    expect(await fabrica.banco('treinos-com.db').todos('select * from registro_mobilidade')).toEqual([]);
  });

  it('esquema 1 → 2: o banco antigo ganha a tabela nova ao abrir e não perde o que tinha', async () => {
    // Um aparelho com o app da versão anterior: esquema 1 (sem `registro_mobilidade`) e uma série na fila.
    const antigo = fabrica.banco('treinos-u1.db');
    await antigo.executar(`
      create table kv (chave text primary key, valor text not null);
      create table registro (
        id text primary key, plano_versao_id text not null, sessao_uid text not null, exercicio_uid text not null,
        serie_uid text not null, exercicio_id text, trabalho integer not null, data text not null, carga real,
        repeticoes integer, concluida integer not null, observacao text, alterado_em text not null,
        situacao text not null check (situacao in ('LOCAL', 'ENVIADO', 'FALHOU')), motivo text,
        unique (plano_versao_id, serie_uid, data)
      );
      create table carga_trabalho (exercicio_uid text not null, data text not null, carga real not null, primary key (exercicio_uid, data));
      insert into registro values ('r-antigo', 'v1', 's1', 'e1', 'x', 'x1', 0, '2026-10-07', 20, 8, 1, null, '2026-10-07T12:00:00.000Z', 'LOCAL', null);
      pragma user_version = 1;
    `);
    expect((await antigo.primeiro<{ user_version: number }>('pragma user_version'))?.user_version).toBe(1);

    const repo = new RepositorioSqlite(fabrica, 'u1', novoId, agora);
    expect((await repo.pendentes()).map((r) => r.id)).toEqual(['r-antigo']);
    expect(await repo.listarMobilidade()).toEqual([]);
    const marcado = await repo.registrarMobilidade(item('i1'));
    expect((await repo.listarMobilidade()).map((r) => r.id)).toEqual([marcado.id]);
    expect((await antigo.primeiro<{ user_version: number }>('pragma user_version'))?.user_version).toBe(VERSAO_ESQUEMA);
    expect(VERSAO_ESQUEMA).toBe(3);
  });

  it('esquema 2 → 3: o banco antigo ganha as colunas das etapas e a série da fila continua, sem detalhe', async () => {
    const antigo = fabrica.banco('treinos-u3.db');
    await antigo.executar(`
      create table kv (chave text primary key, valor text not null);
      create table registro (
        id text primary key, plano_versao_id text not null, sessao_uid text not null, exercicio_uid text not null,
        serie_uid text not null, exercicio_id text, trabalho integer not null, data text not null, carga real,
        repeticoes integer, concluida integer not null, observacao text, alterado_em text not null,
        situacao text not null check (situacao in ('LOCAL', 'ENVIADO', 'FALHOU')), motivo text,
        unique (plano_versao_id, serie_uid, data)
      );
      create table registro_mobilidade (
        id text primary key, plano_versao_id text not null, secao_uid text not null, item_uid text not null, data text not null,
        feito integer not null, alterado_em text not null, situacao text not null check (situacao in ('LOCAL', 'ENVIADO', 'FALHOU')),
        motivo text, unique (plano_versao_id, item_uid, data)
      );
      create table carga_trabalho (exercicio_uid text not null, data text not null, carga real not null, primary key (exercicio_uid, data));
      insert into registro values ('r-v2', 'v1', 's1', 'e1', 'x', 'x1', 0, '2026-10-07', 20, 8, 1, null, '2026-10-07T12:00:00.000Z', 'LOCAL', null);
      pragma user_version = 2;
    `);
    const repo = new RepositorioSqlite(fabrica, 'u3', novoId, agora);
    const [r] = await repo.pendentes();
    expect(r).toMatchObject({ id: 'r-v2', etapas: null, referenciaCarga: null, referenciaOrigem: null });
    const etapas: EtapaRegistrada[] = [{ posicao: 1, repeticoes: 5, carga: 20, situacao: 'FEITA' }];
    await repo.registrar(serie('y', { etapas, referenciaCarga: 20, referenciaOrigem: 'WS_ANTERIOR', concluida: false }));
    expect((await repo.listar()).find((x) => x.serieUid === 'y')?.etapas).toEqual(etapas);
    expect((await antigo.primeiro<{ user_version: number }>('pragma user_version'))?.user_version).toBe(3);
  });
});

describe('mobilidade na web (chave-valor)', () => {
  it('sessão recusada: a chave da mobilidade fica junto com a marca; sem fila de mobilidade a chave sai', async () => {
    const kv = emMemoria();
    const ana = new RepositorioChaveValor(kv, 'ana', novoId, agora);
    await ana.registrarMobilidade(item('i1'));
    await ana.registrarMobilidade(item('i2'));
    const [, i2] = await ana.listarMobilidade();
    await ana.aplicarResultadosMobilidade([i2], [{ id: i2.id, situacao: 'ACEITO', motivo: null }]);
    await ana.reterSoAFila();
    expect((await kv.chaves()).filter((c) => c.startsWith('treinos:ana:')).sort()).toEqual(
      ['treinos:ana:filaRetida', 'treinos:ana:registrosMobilidade'].sort(),
    );
    expect(JSON.parse((await kv.ler('treinos:ana:registrosMobilidade')) ?? '[]')).toHaveLength(1);

    // Só série na fila: a chave da mobilidade (com itens já enviados) não pode sobrar.
    const bia = new RepositorioChaveValor(kv, 'bia', novoId, agora);
    await bia.registrar(serie('s1'));
    await bia.registrarMobilidade(item('i1'));
    const [i1] = await bia.listarMobilidade();
    await bia.aplicarResultadosMobilidade([i1], [{ id: i1.id, situacao: 'ACEITO', motivo: null }]);
    await bia.reterSoAFila();
    expect((await kv.chaves()).filter((c) => c.startsWith('treinos:bia:')).sort()).toEqual(
      ['treinos:bia:filaRetida', 'treinos:bia:registros'].sort(),
    );
  });

  it('"Sair" apaga a mobilidade junto com o resto', async () => {
    const kv = emMemoria();
    const ana = new RepositorioChaveValor(kv, 'ana', novoId, agora);
    await ana.registrarMobilidade(item('i1'));
    await ana.apagarTudo();
    expect((await kv.chaves()).filter((c) => c.startsWith('treinos:ana:'))).toEqual([]);
  });
});
