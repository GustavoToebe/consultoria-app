import type { Atualizacao, RespostasAtualizacao, ConteudoDieta, DiaDeTreino, PainelAluno, RegistroEnvio, VersaoDetalhe } from '../api/tipos';
import type { ChaveValor } from './armazenamento';

/**
 * Dados do aluno no aparelho (seção 11.1), separados por usuário: trocar de conta não mistura nada.
 * Plano = só leitura (pacote baixado); registro de série = escrito aqui e enviado depois.
 *
 * Duas implementações com o mesmo contrato (os testes rodam a mesma bateria nas duas):
 * - `RepositorioSqlite` (celular): um banco SQLite por usuário, registro em tabela com chave única.
 * - `RepositorioChaveValor` (web): AsyncStorage/localStorage com prefixo `treinos:<usuarioId>:`. O SQLite na web
 *   exige cabeçalhos COOP/COEP e WASM (seção 20 do plano), por isso fica só no celular.
 */

/** LOCAL = no aparelho, aguardando envio; ENVIADO = o servidor aceitou; FALHOU = recusado (com motivo). */
export type SituacaoLocal = 'LOCAL' | 'ENVIADO' | 'FALHOU';

export interface RegistroLocal {
  id: string;
  planoVersaoId: string;
  sessaoUid: string;
  exercicioUid: string;
  serieUid: string;
  /** Exercício da biblioteca (para sugerir a carga da próxima vez). */
  exercicioId: string | null;
  /** Série de carga de trabalho (WS). */
  trabalho: boolean;
  data: string;
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  observacao: string | null;
  /** Instante da última mudança no aparelho (ISO); é o que decide o mais novo no servidor. */
  alteradoEm: string;
  situacao: SituacaoLocal;
  motivo: string | null;
}

export type DadosRegistro = Omit<RegistroLocal, 'id' | 'alteradoEm' | 'situacao' | 'motivo'>;

export interface PacoteSalvo {
  pacote: PainelAluno;
  salvoEm: string;
}

/** Registros enviados há mais de 60 dias saem do aparelho (o servidor também não aceita mais tão antigos). */
export const DIAS_GUARDADOS = 60;

export interface ResultadoEnvio {
  id: string;
  situacao: 'ACEITO' | 'IGNORADO_ANTIGO' | 'RECUSADO';
  motivo: string | null;
}

export interface HistoricoSemanaSalvo { versaoId: string; inicio: string; dias: DiaDeTreino[] }

export interface RepositorioLocal {
  lerAtualizacao(): Promise<Atualizacao | null>;
  salvarAtualizacao(atualizacao: Atualizacao): Promise<void>;
  lerRascunhoAtualizacao(pastaId: string): Promise<RascunhoAtualizacao | null>;
  salvarRascunhoAtualizacao(pastaId: string, rascunho: RascunhoAtualizacao): Promise<void>;
  apagarRascunhoAtualizacao(pastaId: string): Promise<void>;
  lerHistoricoSemana(): Promise<HistoricoSemanaSalvo | null>;
  salvarHistoricoSemana(historico: HistoricoSemanaSalvo): Promise<void>;
  readonly usuarioId: string;
  lerPacote(): Promise<PacoteSalvo | null>;
  salvarPacote(pacote: PainelAluno): Promise<void>;
  lerDieta(): Promise<VersaoDetalhe<ConteudoDieta> | null>;
  salvarDieta(dieta: VersaoDetalhe<ConteudoDieta> | null): Promise<void>;
  /** Por `exercicioUid|data`. */
  lerCargasDeTrabalho(): Promise<Record<string, number>>;
  salvarCargaDeTrabalho(exercicioUid: string, data: string, carga: number | null): Promise<Record<string, number>>;
  /** Na ordem em que foram criados. */
  listar(): Promise<RegistroLocal[]>;
  /**
   * Grava a série no aparelho na hora. Mesma série no mesmo dia (mesma versão) mantém o mesmo id e só atualiza os
   * valores: reenviar não duplica no servidor.
   */
  registrar(dados: DadosRegistro): Promise<RegistroLocal>;
  /** Até `limite` pendentes (LOCAL), os mais antigos primeiro. */
  pendentes(limite?: number): Promise<RegistroLocal[]>;
  /**
   * Aplica a resposta do servidor. Se o registro mudou no aparelho depois de enviado (`alteradoEm` diferente),
   * continua LOCAL para ir de novo com o valor novo. Enviados há mais de 60 dias saem do aparelho.
   */
  aplicarResultados(enviados: Pick<RegistroLocal, 'id' | 'alteradoEm'>[], resultados: ResultadoEnvio[]): Promise<void>;
  /** "Tentar de novo": os que falharam voltam para a fila de envio. Devolve quantos. */
  reenviarFalhas(): Promise<number>;
  /** Ao sair da conta: apaga tudo deste usuário no aparelho. Depois disso o repositório não grava mais nada. */
  apagarTudo(): Promise<void>;
  /** Libera recursos (conexão do banco). Pode voltar a ser usado depois: reabre sozinho. */
  fechar(): Promise<void>;
}

/** Instante da nova mudança: o relógio, mas sempre depois da mudança anterior (mesmo milissegundo ainda fica em ordem). */
export function proximoInstante(agora: Date, anterior: string | null | undefined): string {
  let instante = agora.getTime();
  if (anterior && instante <= Date.parse(anterior)) instante = Date.parse(anterior) + 1;
  return new Date(instante).toISOString();
}

/** Data (AAAA-MM-DD) a partir da qual registros já enviados ainda ficam no aparelho. */
export function limiteGuardados(agora: Date): string {
  return new Date(agora.getTime() - DIAS_GUARDADOS * 86_400_000).toISOString().slice(0, 10);
}

const chaveDoRegistro = (r: Pick<RegistroLocal, 'planoVersaoId' | 'serieUid' | 'data'>) =>
  `${r.planoVersaoId}|${r.serieUid}|${r.data}`;

export class RepositorioChaveValor implements RepositorioLocal {
  lerAtualizacao(): Promise<Atualizacao | null> { return this.emFila(() => this.lerJson('atualizacao', null)); }
  salvarAtualizacao(atualizacao: Atualizacao): Promise<void> { return this.emFila(() => this.gravarJson('atualizacao', atualizacao)); }
  lerRascunhoAtualizacao(pastaId: string): Promise<RascunhoAtualizacao | null> {
    return this.emFila(() => this.lerJson(`atualizacao:rascunho:${pastaId}`,null));
  }
  salvarRascunhoAtualizacao(pastaId: string, rascunho: RascunhoAtualizacao): Promise<void> {
    return this.emFila(() => this.gravarJson(`atualizacao:rascunho:${pastaId}`,rascunho));
  }
  apagarRascunhoAtualizacao(pastaId: string): Promise<void> {
    return this.emFila(async () => { if (!this.encerrado) await this.kv.apagar([this.chave(`atualizacao:rascunho:${pastaId}`)]); });
  }
  private fila: Promise<unknown> = Promise.resolve();
  private encerrado = false;

  constructor(
    private readonly kv: ChaveValor,
    readonly usuarioId: string,
    private readonly novoId: () => string,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  private chave(nome: string) {
    return `${prefixoDoUsuario(this.usuarioId)}${nome}`;
  }

  /**
   * Uma operação por vez: ler-alterar-gravar sem pisar em outra (registro durante a sincronização). Depois de
   * `apagarTudo` (sair da conta) não grava mais: `lerJson` devolve vazio e `gravarJson` ignora.
   */
  private emFila<T>(op: () => Promise<T>): Promise<T> {
    const resultado = this.fila.then(op, op);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  private async lerJson<T>(nome: string, padrao: T): Promise<T> {
    if (this.encerrado) return padrao;
    const texto = await this.kv.ler(this.chave(nome));
    if (!texto) return padrao;
    try {
      return JSON.parse(texto) as T;
    } catch {
      return padrao;
    }
  }

  private async gravarJson(nome: string, valor: unknown) {
    if (this.encerrado) return;
    await this.kv.gravar(this.chave(nome), JSON.stringify(valor));
  }

  // ---- Pacote (plano publicado, marca, últimas cargas) ----

  lerPacote(): Promise<PacoteSalvo | null> {
    return this.emFila(() => this.lerJson<PacoteSalvo | null>('pacote', null));
  }

  salvarPacote(pacote: PainelAluno): Promise<void> {
    return this.emFila(() => this.gravarJson('pacote', { pacote, salvoEm: this.agora().toISOString() }));
  }

  // ---- Dieta (só leitura, cache da última vista online) ----

  lerDieta(): Promise<VersaoDetalhe<ConteudoDieta> | null> {
    return this.emFila(() => this.lerJson<VersaoDetalhe<ConteudoDieta> | null>('dieta', null));
  }

  salvarDieta(dieta: VersaoDetalhe<ConteudoDieta> | null): Promise<void> {
    return this.emFila(() => this.gravarJson('dieta', dieta));
  }

  lerHistoricoSemana(): Promise<HistoricoSemanaSalvo | null> {
    return this.emFila(() => this.lerJson<HistoricoSemanaSalvo | null>('historicoSemana', null));
  }
  salvarHistoricoSemana(historico: HistoricoSemanaSalvo): Promise<void> {
    return this.emFila(() => this.gravarJson('historicoSemana', historico));
  }

  // ---- Carga de trabalho do dia, por exercício do plano ----

  lerCargasDeTrabalho(): Promise<Record<string, number>> {
    return this.emFila(() => this.lerJson<Record<string, number>>('cargas', {}));
  }

  salvarCargaDeTrabalho(exercicioUid: string, data: string, carga: number | null): Promise<Record<string, number>> {
    return this.emFila(async () => {
      const cargas = await this.lerJson<Record<string, number>>('cargas', {});
      const chave = `${exercicioUid}|${data}`;
      if (carga === null) delete cargas[chave];
      else cargas[chave] = carga;
      await this.gravarJson('cargas', cargas);
      return cargas;
    });
  }

  // ---- Registros ----

  listar(): Promise<RegistroLocal[]> {
    return this.emFila(() => this.lerJson<RegistroLocal[]>('registros', []));
  }

  registrar(dados: DadosRegistro): Promise<RegistroLocal> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      const chave = chaveDoRegistro(dados);
      const i = lista.findIndex((r) => chaveDoRegistro(r) === chave);
      const anterior = i >= 0 ? lista[i] : null;
      const registro: RegistroLocal = {
        ...dados,
        id: anterior?.id ?? this.novoId(),
        alteradoEm: proximoInstante(this.agora(), anterior?.alteradoEm),
        situacao: 'LOCAL',
        motivo: null,
      };
      if (i >= 0) lista[i] = registro;
      else lista.push(registro);
      await this.gravarJson('registros', lista);
      return registro;
    });
  }

  pendentes(limite = 300): Promise<RegistroLocal[]> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      return lista
        .filter((r) => r.situacao === 'LOCAL')
        .sort((a, b) => a.alteradoEm.localeCompare(b.alteradoEm))
        .slice(0, limite);
    });
  }

  aplicarResultados(
    enviados: Pick<RegistroLocal, 'id' | 'alteradoEm'>[],
    resultados: ResultadoEnvio[],
  ): Promise<void> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      const enviadoEm = new Map(enviados.map((e) => [e.id, e.alteradoEm]));
      const porId = new Map(resultados.map((r) => [r.id, r]));
      for (const r of lista) {
        const resultado = porId.get(r.id);
        if (!resultado || r.situacao !== 'LOCAL' || enviadoEm.get(r.id) !== r.alteradoEm) continue;
        if (resultado.situacao === 'RECUSADO') {
          r.situacao = 'FALHOU';
          r.motivo = resultado.motivo ?? 'Recusado pelo servidor.';
        } else {
          r.situacao = 'ENVIADO';
          r.motivo = null;
        }
      }
      const limite = limiteGuardados(this.agora());
      await this.gravarJson(
        'registros',
        lista.filter((r) => r.situacao !== 'ENVIADO' || r.data >= limite),
      );
    });
  }

  reenviarFalhas(): Promise<number> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      let n = 0;
      for (const r of lista) {
        if (r.situacao === 'FALHOU') {
          r.situacao = 'LOCAL';
          r.motivo = null;
          n++;
        }
      }
      await this.gravarJson('registros', lista);
      return n;
    });
  }

  apagarTudo(): Promise<void> {
    return this.emFila(() => {
      this.encerrado = true;
      return apagarChavesDoUsuario(this.kv, this.usuarioId);
    });
  }

  async fechar(): Promise<void> {
    // Nada aberto: o AsyncStorage não tem conexão.
  }
}

export interface RascunhoAtualizacao { modeloVersao: number; respostas: RespostasAtualizacao }

/** Chaves que o repositório chave-valor usa para um usuário (também lidas na migração para o SQLite). */
export const prefixoDoUsuario = (usuarioId: string) => `treinos:${usuarioId}:`;

export async function apagarChavesDoUsuario(kv: ChaveValor, usuarioId: string): Promise<void> {
  const prefixo = prefixoDoUsuario(usuarioId);
  await kv.apagar((await kv.chaves()).filter((c) => c.startsWith(prefixo)));
}

export function paraEnvio(r: RegistroLocal): RegistroEnvio {
  return {
    id: r.id,
    planoVersaoId: r.planoVersaoId,
    sessaoUid: r.sessaoUid,
    exercicioUid: r.exercicioUid,
    serieUid: r.serieUid,
    data: r.data,
    carga: r.carga,
    repeticoes: r.repeticoes,
    concluida: r.concluida,
    observacao: r.observacao,
    alteradoNoAparelhoEm: r.alteradoEm,
  };
}
