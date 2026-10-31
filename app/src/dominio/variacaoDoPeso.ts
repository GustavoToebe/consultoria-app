import type { RegistroPeso } from '../api/tipos';
import { dataCurta, numeroParaTela } from './formatos';

/**
 * Variação do peso para o cartão do aluno e do treinador (A11 da reunião de 30/10: "+1,2 kg" sem dizer contra quando).
 *
 * O número é o que a API manda (`PesoService.listar`): peso do registro menos o do registro IMEDIATAMENTE anterior por
 * data, de todos os registros do aluno (a rota não tem período), já com sinal, e nulo no primeiro. Aqui nada é recalculado
 * nem inventado: a data do "desde" só aparece quando esse registro anterior está na lista que a tela recebeu e a conta
 * `peso − anterior` confere com a variação da API. Lista por período que cortou o anterior = sem "desde".
 * Só direção: nenhuma cor de julgamento ("aumentou" não é bom nem ruim); o sistema não interpreta o peso.
 */

export type SetaDoPeso = 'sobe' | 'desce' | 'igual';

export interface VariacaoDoPeso {
  /**
   * Com sinal sempre explícito: "+1,2 kg", "−0,7 kg" (sinal de menos tipográfico), "0 kg". O número segue o resto do app
   * (`numeroParaTela`: até duas casas, sem zero sobrando), igual à coluna do peso ("80 kg", então "+1 kg", não "+1,0 kg").
   */
  texto: string;
  seta: SetaDoPeso;
  /** Dia e mês do registro de comparação ("12/10"); `null` quando ele não está na lista recebida. */
  desde: string | null;
}

/** O peso tem duas casas (`numeric(5,2)`): é a diferença entre dois deles que a API devolve. */
const TOLERANCIA_KG = 0.005 + 1e-9;

function formatar(variacao: number): { texto: string; seta: SetaDoPeso } {
  const d = Math.round(variacao * 100) / 100;
  const seta: SetaDoPeso = d > 0 ? 'sobe' : d < 0 ? 'desce' : 'igual';
  const sinal = seta === 'sobe' ? '+' : seta === 'desce' ? '−' : '';
  return { texto: `${sinal}${numeroParaTela(Math.abs(d))} kg`, seta };
}

/** O registro de data imediatamente anterior à do `registro`, na lista recebida (em qualquer ordem). */
function anteriorNaLista(registro: RegistroPeso, registros: readonly RegistroPeso[]): RegistroPeso | null {
  let achado: RegistroPeso | null = null;
  for (const r of registros) {
    if (r.data < registro.data && (!achado || r.data > achado.data)) achado = r;
  }
  return achado;
}

/**
 * Variação de um registro. `null` sem dado: o primeiro registro do aluno (a API manda `variacao` nula) ou número que não
 * é número. `registros` é a lista que a tela mostra; serve só para achar a data do "desde".
 */
export function variacaoDoPeso(registro: RegistroPeso, registros: readonly RegistroPeso[] = []): VariacaoDoPeso | null {
  const { variacao } = registro;
  if (variacao === null || variacao === undefined || !Number.isFinite(variacao)) return null;
  const anterior = anteriorNaLista(registro, registros);
  const confere = anterior !== null && Math.abs(registro.pesoKg - anterior.pesoKg - variacao) <= TOLERANCIA_KG;
  return { ...formatar(variacao), desde: confere && anterior ? dataCurta(anterior.data) : null };
}

/** A variação de cada registro da lista, por `id` (a lista pode vir em qualquer ordem). */
export function variacoesDoPeso(registros: readonly RegistroPeso[]): Record<string, VariacaoDoPeso | null> {
  const porId: Record<string, VariacaoDoPeso | null> = {};
  for (const r of registros) porId[r.id] = variacaoDoPeso(r, registros);
  return porId;
}
