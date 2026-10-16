import type { Atualizacao, ConteudoDieta, ConteudoMobilidadeApi, PainelAluno, VersaoDetalhe } from '../api/tipos';
import { nomeDoBanco, prepararEsquema, type BancoSql, type ConexaoSql, type FabricaBanco, type ValorSql } from './banco';
import {
  filaRetidaVenceu,
  limiteGuardados,
  proximoInstante,
  type DadosRegistro,
  type HistoricoSemanaSalvo,
  type MarcaDaFilaRetida,
  type PacoteSalvo,
  type RegistroLocal,
  type RepositorioLocal,
  type RascunhoAtualizacao,
  type ResultadoEnvio,
  type SituacaoDaFilaRetida,
} from './repositorioLocal';

interface LinhaRegistro {
  id: string;
  plano_versao_id: string;
  sessao_uid: string;
  exercicio_uid: string;
  serie_uid: string;
  exercicio_id: string | null;
  trabalho: number;
  data: string;
  carga: number | null;
  repeticoes: number | null;
  concluida: number;
  observacao: string | null;
  alterado_em: string;
  situacao: RegistroLocal['situacao'];
  motivo: string | null;
}

const COLUNAS =
  'id, plano_versao_id, sessao_uid, exercicio_uid, serie_uid, exercicio_id, trabalho, data, carga, repeticoes, ' +
  'concluida, observacao, alterado_em, situacao, motivo';

const paraRegistro = (l: LinhaRegistro): RegistroLocal => ({
  id: l.id,
  planoVersaoId: l.plano_versao_id,
  sessaoUid: l.sessao_uid,
  exercicioUid: l.exercicio_uid,
  serieUid: l.serie_uid,
  exercicioId: l.exercicio_id,
  trabalho: l.trabalho === 1,
  data: l.data,
  carga: l.carga,
  repeticoes: l.repeticoes,
  concluida: l.concluida === 1,
  observacao: l.observacao,
  alteradoEm: l.alterado_em,
  situacao: l.situacao,
  motivo: l.motivo,
});

const paraLinha = (r: RegistroLocal): ValorSql[] => [
  r.id,
  r.planoVersaoId,
  r.sessaoUid,
  r.exercicioUid,
  r.serieUid,
  r.exercicioId,
  r.trabalho ? 1 : 0,
  r.data,
  r.carga,
  r.repeticoes,
  r.concluida ? 1 : 0,
  r.observacao,
  r.alteradoEm,
  r.situacao,
  r.motivo,
];

const INSERIR_REGISTRO = `insert into registro (${COLUNAS}) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * Repositório do aluno no celular: um banco SQLite por usuário (`treinos-<usuarioId>.db`). Cada operação roda numa
 * transação, e uma por vez (fila em memória), como o repositório chave-valor. Gravar uma série mexe só na linha dela,
 * não reescreve a lista inteira.
 */
export class RepositorioSqlite implements RepositorioLocal {
  private fila: Promise<unknown> = Promise.resolve();
  private conexao: Promise<ConexaoSql> | null = null;
  private encerrado = false;

  constructor(
    private readonly fabrica: FabricaBanco,
    readonly usuarioId: string,
    private readonly novoId: () => string,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  private get nome() {
    return nomeDoBanco(this.usuarioId);
  }

  private abrir(): Promise<ConexaoSql> {
    if (!this.conexao) {
      const abrindo = (async () => {
        const conexao = await this.fabrica.abrir(this.nome);
        await prepararEsquema(conexao.banco);
        return conexao;
      })();
      // Falhou ao abrir: a próxima operação tenta de novo.
      abrindo.catch(() => {
        if (this.conexao === abrindo) this.conexao = null;
      });
      this.conexao = abrindo;
    }
    return this.conexao;
  }

  /**
   * Uma operação por vez, como no chave-valor. Depois de `apagarTudo` (sair da conta) não abre o banco de novo:
   * leitura devolve vazio e escrita é ignorada, para nada recriar o arquivo de quem saiu.
   */
  private emFila<T>(semBanco: T, op: (banco: BancoSql) => Promise<T>): Promise<T> {
    const executar = async () => {
      if (this.encerrado) return semBanco;
      const { banco } = await this.abrir();
      return op(banco);
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  // ---- Documentos (pacote e dieta) ----
  lerAtualizacao(): Promise<Atualizacao | null> { return this.emFila(null,b => this.lerDocumento(b,'atualizacao')); }
  salvarAtualizacao(atualizacao: Atualizacao): Promise<void> { return this.emFila(undefined,b => this.gravarDocumento(b,'atualizacao',atualizacao)); }
  lerRascunhoAtualizacao(pastaId: string): Promise<RascunhoAtualizacao | null> {
    return this.emFila(null,b => this.lerDocumento(b,`atualizacao:rascunho:${pastaId}`));
  }
  salvarRascunhoAtualizacao(pastaId: string, rascunho: RascunhoAtualizacao): Promise<void> {
    return this.emFila(undefined,b => this.gravarDocumento(b,`atualizacao:rascunho:${pastaId}`,rascunho));
  }
  apagarRascunhoAtualizacao(pastaId: string): Promise<void> {
    return this.emFila(undefined, async b => { await b.rodar('delete from kv where chave = ?',[`atualizacao:rascunho:${pastaId}`]); });
  }

  private async lerDocumento<T>(banco: BancoSql, chave: string): Promise<T | null> {
    const linha = await banco.primeiro<{ valor: string }>('select valor from kv where chave = ?', [chave]);
    if (!linha) return null;
    try {
      return JSON.parse(linha.valor) as T;
    } catch {
      return null;
    }
  }

  private async gravarDocumento(banco: BancoSql, chave: string, valor: unknown): Promise<void> {
    await banco.rodar(
      'insert into kv (chave, valor) values (?, ?) on conflict (chave) do update set valor = excluded.valor',
      [chave, JSON.stringify(valor)],
    );
  }

  lerPacote(): Promise<PacoteSalvo | null> {
    return this.emFila(null, (b) => this.lerDocumento<PacoteSalvo>(b, 'pacote'));
  }

  salvarPacote(pacote: PainelAluno): Promise<void> {
    return this.emFila(undefined, (b) =>
      this.gravarDocumento(b, 'pacote', { pacote, salvoEm: this.agora().toISOString() }),
    );
  }

  lerDieta(): Promise<VersaoDetalhe<ConteudoDieta> | null> {
    return this.emFila(null, (b) => this.lerDocumento<VersaoDetalhe<ConteudoDieta>>(b, 'dieta'));
  }

  salvarDieta(dieta: VersaoDetalhe<ConteudoDieta> | null): Promise<void> {
    return this.emFila(undefined, (b) => this.gravarDocumento(b, 'dieta', dieta));
  }

  // Mesma tabela kv da dieta: documento novo, sem mudar o esquema (VERSAO_ESQUEMA fica como está).
  lerMobilidade(): Promise<VersaoDetalhe<ConteudoMobilidadeApi> | null> {
    return this.emFila(null, (b) => this.lerDocumento<VersaoDetalhe<ConteudoMobilidadeApi>>(b, 'mobilidade'));
  }

  salvarMobilidade(mobilidade: VersaoDetalhe<ConteudoMobilidadeApi> | null): Promise<void> {
    return this.emFila(undefined, (b) => this.gravarDocumento(b, 'mobilidade', mobilidade));
  }

  lerHistoricoSemana(): Promise<HistoricoSemanaSalvo | null> {
    return this.emFila(null, b => this.lerDocumento<HistoricoSemanaSalvo>(b, 'historicoSemana'));
  }
  salvarHistoricoSemana(historico: HistoricoSemanaSalvo): Promise<void> {
    return this.emFila(undefined, b => this.gravarDocumento(b, 'historicoSemana', historico));
  }

  // ---- Carga de trabalho do dia ----

  private async todasAsCargas(banco: BancoSql): Promise<Record<string, number>> {
    const linhas = await banco.todos<{ exercicio_uid: string; data: string; carga: number }>(
      'select exercicio_uid, data, carga from carga_trabalho',
    );
    return Object.fromEntries(linhas.map((l) => [`${l.exercicio_uid}|${l.data}`, l.carga]));
  }

  lerCargasDeTrabalho(): Promise<Record<string, number>> {
    return this.emFila({}, (b) => this.todasAsCargas(b));
  }

  salvarCargaDeTrabalho(exercicioUid: string, data: string, carga: number | null): Promise<Record<string, number>> {
    return this.emFila({}, (b) =>
      b.transacao(async (t) => {
        if (carga === null) {
          await t.rodar('delete from carga_trabalho where exercicio_uid = ? and data = ?', [exercicioUid, data]);
        } else {
          await t.rodar(
            'insert into carga_trabalho (exercicio_uid, data, carga) values (?, ?, ?) ' +
              'on conflict (exercicio_uid, data) do update set carga = excluded.carga',
            [exercicioUid, data, carga],
          );
        }
        return this.todasAsCargas(t);
      }),
    );
  }

  // ---- Registros ----

  listar(): Promise<RegistroLocal[]> {
    return this.emFila([], async (b) =>
      (await b.todos<LinhaRegistro>(`select ${COLUNAS} from registro order by rowid`)).map(paraRegistro),
    );
  }

  registrar(dados: DadosRegistro): Promise<RegistroLocal> {
    const semBanco: RegistroLocal = { ...dados, id: '', alteradoEm: '', situacao: 'LOCAL', motivo: null };
    return this.emFila(semBanco, (b) =>
      b.transacao(async (t) => {
        const anterior = await t.primeiro<{ id: string; alterado_em: string }>(
          'select id, alterado_em from registro where plano_versao_id = ? and serie_uid = ? and data = ?',
          [dados.planoVersaoId, dados.serieUid, dados.data],
        );
        const registro: RegistroLocal = {
          ...dados,
          id: anterior?.id ?? this.novoId(),
          alteradoEm: proximoInstante(this.agora(), anterior?.alterado_em),
          situacao: 'LOCAL',
          motivo: null,
        };
        if (anterior) {
          await t.rodar(
            'update registro set sessao_uid = ?, exercicio_uid = ?, exercicio_id = ?, trabalho = ?, carga = ?, ' +
              "repeticoes = ?, concluida = ?, observacao = ?, alterado_em = ?, situacao = 'LOCAL', motivo = null " +
              'where id = ?',
            [
              registro.sessaoUid,
              registro.exercicioUid,
              registro.exercicioId,
              registro.trabalho ? 1 : 0,
              registro.carga,
              registro.repeticoes,
              registro.concluida ? 1 : 0,
              registro.observacao,
              registro.alteradoEm,
              registro.id,
            ],
          );
        } else {
          await t.rodar(INSERIR_REGISTRO, paraLinha(registro));
        }
        return registro;
      }),
    );
  }

  pendentes(limite = 300): Promise<RegistroLocal[]> {
    return this.emFila([], async (b) =>
      (
        await b.todos<LinhaRegistro>(
          `select ${COLUNAS} from registro where situacao = 'LOCAL' order by alterado_em, rowid limit ?`,
          [limite],
        )
      ).map(paraRegistro),
    );
  }

  aplicarResultados(enviados: Pick<RegistroLocal, 'id' | 'alteradoEm'>[], resultados: ResultadoEnvio[]): Promise<void> {
    return this.emFila(undefined, (b) =>
      b.transacao(async (t) => {
        const enviadoEm = new Map(enviados.map((e) => [e.id, e.alteradoEm]));
        for (const r of resultados) {
          const alteradoEm = enviadoEm.get(r.id);
          if (alteradoEm === undefined) continue;
          // Só muda se ainda é o mesmo valor que foi enviado: mudou no meio do envio, continua LOCAL.
          const [situacao, motivo] =
            r.situacao === 'RECUSADO' ? ['FALHOU', r.motivo ?? 'Recusado pelo servidor.'] : ['ENVIADO', null];
          await t.rodar(
            "update registro set situacao = ?, motivo = ? where id = ? and situacao = 'LOCAL' and alterado_em = ?",
            [situacao, motivo, r.id, alteradoEm],
          );
        }
        await t.rodar("delete from registro where situacao = 'ENVIADO' and data < ?", [limiteGuardados(this.agora())]);
      }),
    );
  }

  reenviarFalhas(): Promise<number> {
    return this.emFila(0, async (b) => {
      const { alteradas } = await b.rodar(
        "update registro set situacao = 'LOCAL', motivo = null where situacao = 'FALHOU'",
      );
      return alteradas;
    });
  }

  apagarTudo(): Promise<void> {
    const executar = async () => {
      this.encerrado = true;
      await this.fecharConexao();
      await this.fabrica.apagar(this.nome);
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  /**
   * Tira do banco tudo o que é dado da pessoa, menos os registros. `secure_delete` vai dentro da transação porque o
   * expo-sqlite a roda em outra conexão; ele faz as páginas liberadas serem zeradas, sem resto legível no arquivo.
   */
  private async apagarDadosDaPessoa(t: BancoSql): Promise<void> {
    await t.executar('pragma secure_delete = on');
    await t.rodar('delete from kv');
    await t.rodar('delete from carga_trabalho');
  }

  reterSoAFila(): Promise<number> {
    const executar = async () => {
      if (this.encerrado) return 0;
      const { banco } = await this.abrir();
      const retidos = await banco.transacao(async (t) => {
        await this.apagarDadosDaPessoa(t);
        await t.rodar("delete from registro where situacao <> 'LOCAL'");
        const { n } = (await t.primeiro<{ n: number }>('select count(*) as n from registro')) ?? { n: 0 };
        if (n > 0) await this.gravarDocumento(t, 'filaRetida', { desde: this.agora().toISOString() });
        return n;
      });
      this.encerrado = true;
      // Os dados já saíram na transação; apagar o arquivo (sem fila) é só arrumação, e o `vacuum` encolhe o que sobrou.
      if (retidos === 0) {
        await this.fecharConexao();
        await this.fabrica.apagar(this.nome);
      } else {
        await banco.executar('vacuum').catch(() => undefined);
        await this.fecharConexao();
      }
      return retidos;
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  descartarFilaRetidaVencida(): Promise<SituacaoDaFilaRetida> {
    const executar = async (): Promise<SituacaoDaFilaRetida> => {
      if (this.encerrado) return 'nenhuma';
      const { banco } = await this.abrir();
      const marca = await this.lerDocumento<MarcaDaFilaRetida>(banco, 'filaRetida');
      if (!marca) return 'nenhuma';
      if (!filaRetidaVenceu(marca.desde, this.agora())) return 'retida';
      // Esvazia as tabelas em vez de apagar o arquivo: outra conexão (a varredura do aparelho e o provider do mesmo
      // usuário podem abrir o banco juntos) faria a exclusão do arquivo falhar sem aviso e a fila vencida seria enviada.
      await banco.transacao(async (t) => {
        await this.apagarDadosDaPessoa(t);
        await t.rodar('delete from registro');
      });
      await banco.executar('vacuum').catch(() => undefined);
      return 'vencida';
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  retomarFilaRetida(): Promise<boolean> {
    return this.emFila(false, async (b) => (await b.rodar("delete from kv where chave = 'filaRetida'")).alteradas > 0);
  }

  fechar(): Promise<void> {
    const resultado = this.fila.then(
      () => this.fecharConexao(),
      () => this.fecharConexao(),
    );
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  private async fecharConexao(): Promise<void> {
    const aberta = this.conexao;
    this.conexao = null;
    if (!aberta) return;
    try {
      await (await aberta).fechar();
    } catch {
      // Não chegou a abrir: nada a fechar.
    }
  }
}
