import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio } from '../api/tipos';
import { paraEnvio, type RepositorioLocal } from './repositorioLocal';

export type ResultadoSincronizacao =
  | { tipo: 'ok'; enviados: number }
  /** Sem rede, servidor fora ou erro 5xx: tudo continua LOCAL para a próxima tentativa. */
  | { tipo: 'semConexao' }
  /** O servidor recusou o lote inteiro (4xx): marca para o aluno ver e tentar de novo. */
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'emAndamento' };

/** Espera entre tentativas depois de falha de rede: 5 s, 15 s, 60 s e depois 5 min (seção 11.2). */
export const ESPERAS_MS = [5_000, 15_000, 60_000, 300_000];

const LOTE = 300;

/**
 * Envia os registros LOCAL em lotes de até 300, os mais antigos primeiro, e aplica a resposta: ACEITO e
 * IGNORADO_ANTIGO viram ENVIADO; RECUSADO vira FALHOU com o motivo. Uma sincronização por vez.
 */
export class Sincronizador {
  private rodando: Promise<ResultadoSincronizacao> | null = null;

  constructor(
    private readonly repositorio: RepositorioLocal,
    private readonly enviar: (registros: RegistroEnvio[]) => Promise<LoteResponse>,
  ) {}

  sincronizar(): Promise<ResultadoSincronizacao> {
    if (this.rodando) return this.rodando;
    this.rodando = this.executar().finally(() => {
      this.rodando = null;
    });
    return this.rodando;
  }

  private async executar(): Promise<ResultadoSincronizacao> {
    let enviados = 0;
    // Cada volta pega os mais antigos; para quando não sobra nada ou nada mais anda (evita laço infinito).
    for (let volta = 0; volta < 20; volta++) {
      const pendentes = await this.repositorio.pendentes(LOTE);
      if (pendentes.length === 0) break;
      let resposta: LoteResponse;
      try {
        resposta = await this.enviar(pendentes.map(paraEnvio));
      } catch (erro) {
        if (erro instanceof ErroApi && (erro.semConexao || erro.status >= 500 || erro.status === 401)) {
          return { tipo: 'semConexao' };
        }
        return { tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível enviar.' };
      }
      await this.repositorio.aplicarResultados(pendentes, resposta.resultados);
      enviados += pendentes.length;
      if (pendentes.length < LOTE) break;
    }
    return { tipo: 'ok', enviados };
  }
}
