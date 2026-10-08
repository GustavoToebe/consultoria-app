import type { ConteudoDieta, PainelAluno, VersaoDetalhe } from '../api/tipos';
import type { ChaveValor } from './armazenamento';
import { nomeDoBanco, prepararEsquema, type BancoSql, type ConexaoSql, type FabricaBanco, type ValorSql } from './banco';
import {
  apagarChavesDoUsuario,
  limiteGuardados,
  prefixoDoUsuario,
  proximoInstante,
  type DadosRegistro,
  type PacoteSalvo,
  type RegistroLocal,
  type RepositorioLocal,
  type ResultadoEnvio,
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
 *
 * Na primeira abertura, traz o que estiver no AsyncStorage da versão anterior do app (`migrarDe`) e apaga de lá:
 * registro pendente nunca se perde na troca.
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
    private readonly migrarDe: ChaveValor | null = null,
  ) {}

  private get nome() {
    return nomeDoBanco(this.usuarioId);
  }

  private abrir(): Promise<ConexaoSql> {
    if (!this.conexao) {
      const abrindo = (async () => {
        const conexao = await this.fabrica.abrir(this.nome);
        await prepararEsquema(conexao.banco);
        if (this.migrarDe) {
          // Migração que falhar não pode travar o app: as chaves antigas ficam e ela tenta de novo na próxima abertura.
          await migrarDoChaveValor(conexao.banco, this.migrarDe, this.usuarioId).catch(() => undefined);
        }
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
      if (this.migrarDe) await apagarChavesDoUsuario(this.migrarDe, this.usuarioId);
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
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

/**
 * Traz para o SQLite o que a versão anterior do app guardou no AsyncStorage (prefixo `treinos:<usuarioId>:`) e
 * apaga de lá. Não sobrescreve o que já está no SQLite (`insert or ignore`): rodar de novo não muda nada.
 * As chaves antigas só saem depois da transação confirmada.
 */
export async function migrarDoChaveValor(banco: BancoSql, kv: ChaveValor, usuarioId: string): Promise<void> {
  const prefixo = prefixoDoUsuario(usuarioId);
  const chaves = (await kv.chaves()).filter((c) => c.startsWith(prefixo));
  if (chaves.length === 0) return;
  const ler = async <T>(nome: string): Promise<T | null> => {
    const texto = await kv.ler(prefixo + nome);
    if (!texto) return null;
    try {
      return JSON.parse(texto) as T;
    } catch {
      return null;
    }
  };
  const pacote = await ler<PacoteSalvo>('pacote');
  const dieta = await ler<VersaoDetalhe<ConteudoDieta>>('dieta');
  const cargas = (await ler<Record<string, number>>('cargas')) ?? {};
  const registros = (await ler<RegistroLocal[]>('registros')) ?? [];

  await banco.transacao(async (t) => {
    for (const [chave, valor] of [
      ['pacote', pacote],
      ['dieta', dieta],
    ] as const) {
      if (valor !== null) {
        await t.rodar('insert or ignore into kv (chave, valor) values (?, ?)', [chave, JSON.stringify(valor)]);
      }
    }
    for (const [chave, carga] of Object.entries(cargas)) {
      const separador = chave.lastIndexOf('|');
      if (separador < 0 || typeof carga !== 'number') continue;
      await t.rodar('insert or ignore into carga_trabalho (exercicio_uid, data, carga) values (?, ?, ?)', [
        chave.slice(0, separador),
        chave.slice(separador + 1),
        carga,
      ]);
    }
    for (const r of registros.filter(registroCompleto)) {
      await t.rodar(INSERIR_REGISTRO.replace('insert into', 'insert or ignore into'), paraLinha(r));
    }
  });
  await kv.apagar(chaves);
}

const SITUACOES = new Set<string>(['LOCAL', 'ENVIADO', 'FALHOU']);

/** Registro antigo sem algum campo obrigatório fica de fora (o servidor também o recusaria). */
function registroCompleto(r: RegistroLocal): boolean {
  return (
    [r.id, r.planoVersaoId, r.sessaoUid, r.exercicioUid, r.serieUid, r.data, r.alteradoEm].every(
      (v) => typeof v === 'string' && v.length > 0,
    ) && SITUACOES.has(r.situacao)
  );
}
