import type { ConteudoDieta, PainelAluno, RegistroEnvio, VersaoDetalhe } from '../api/tipos';
import type { ChaveValor } from './armazenamento';

/**
 * Dados do aluno no aparelho (seção 11.1), separados por usuário (`treinos:<usuarioId>:`): trocar de conta não
 * mistura nada. Plano = só leitura (pacote baixado); registro de série = escrito aqui e enviado depois.
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
const DIAS_GUARDADOS = 60;

const chaveDoRegistro = (r: Pick<RegistroLocal, 'planoVersaoId' | 'serieUid' | 'data'>) =>
  `${r.planoVersaoId}|${r.serieUid}|${r.data}`;

export class RepositorioLocal {
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: ChaveValor,
    readonly usuarioId: string,
    private readonly novoId: () => string,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  private chave(nome: string) {
    return `treinos:${this.usuarioId}:${nome}`;
  }

  /** Uma operação por vez: ler-alterar-gravar sem pisar em outra (registro durante a sincronização). */
  private emFila<T>(op: () => Promise<T>): Promise<T> {
    const resultado = this.fila.then(op, op);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  private async lerJson<T>(nome: string, padrao: T): Promise<T> {
    const texto = await this.kv.ler(this.chave(nome));
    if (!texto) return padrao;
    try {
      return JSON.parse(texto) as T;
    } catch {
      return padrao;
    }
  }

  private gravarJson(nome: string, valor: unknown) {
    return this.kv.gravar(this.chave(nome), JSON.stringify(valor));
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

  /**
   * Grava a série no aparelho na hora. Mesma série no mesmo dia (mesma versão) mantém o mesmo id e só atualiza os
   * valores: reenviar não duplica no servidor.
   */
  registrar(dados: DadosRegistro): Promise<RegistroLocal> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      const chave = chaveDoRegistro(dados);
      const i = lista.findIndex((r) => chaveDoRegistro(r) === chave);
      const anterior = i >= 0 ? lista[i] : null;
      let instante = this.agora().getTime();
      // Duas mudanças no mesmo milissegundo ainda precisam ficar em ordem.
      if (anterior && instante <= Date.parse(anterior.alteradoEm)) instante = Date.parse(anterior.alteradoEm) + 1;
      const registro: RegistroLocal = {
        ...dados,
        id: anterior?.id ?? this.novoId(),
        alteradoEm: new Date(instante).toISOString(),
        situacao: 'LOCAL',
        motivo: null,
      };
      if (i >= 0) lista[i] = registro;
      else lista.push(registro);
      await this.gravarJson('registros', lista);
      return registro;
    });
  }

  /** Até `limite` pendentes, os mais antigos primeiro. */
  pendentes(limite = 300): Promise<RegistroLocal[]> {
    return this.emFila(async () => {
      const lista = await this.lerJson<RegistroLocal[]>('registros', []);
      return lista
        .filter((r) => r.situacao === 'LOCAL')
        .sort((a, b) => a.alteradoEm.localeCompare(b.alteradoEm))
        .slice(0, limite);
    });
  }

  /**
   * Aplica a resposta do servidor. Se o registro mudou no aparelho depois de enviado (`alteradoEm` diferente),
   * continua LOCAL para ir de novo com o valor novo.
   */
  aplicarResultados(
    enviados: Pick<RegistroLocal, 'id' | 'alteradoEm'>[],
    resultados: { id: string; situacao: 'ACEITO' | 'IGNORADO_ANTIGO' | 'RECUSADO'; motivo: string | null }[],
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
      const limite = new Date(this.agora().getTime() - DIAS_GUARDADOS * 86_400_000).toISOString().slice(0, 10);
      await this.gravarJson(
        'registros',
        lista.filter((r) => r.situacao !== 'ENVIADO' || r.data >= limite),
      );
    });
  }

  /** "Tentar de novo": os que falharam voltam para a fila de envio. */
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

  /** Ao sair da conta: apaga tudo deste usuário no aparelho. */
  apagarTudo(): Promise<void> {
    return this.emFila(async () => {
      const prefixo = `treinos:${this.usuarioId}:`;
      await this.kv.apagar((await this.kv.chaves()).filter((c) => c.startsWith(prefixo)));
    });
  }
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
