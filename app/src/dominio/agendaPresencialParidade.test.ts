import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALUNOS_MAXIMO, LIMITES_COMPROMISSO, OCORRENCIAS_MAXIMO, OCORRENCIAS_MINIMO } from './agendaPresencial';

/**
 * Paridade com o Java: lê as constantes públicas de `AgendaDtos` (a API é quem decide) e confere os espelhos do app. Nada
 * de fixture própria: se a API mudar o limite, este teste falha até o app acompanhar.
 */
const java = readFileSync(resolve(__dirname, '../../../api/src/main/java/br/com/treinos/api/agenda/AgendaDtos.java'), 'utf8');
const constante = (nome: string): number => {
  const m = new RegExp(`public static final int ${nome} = (\\d+);`).exec(java);
  if (!m) throw new Error(`Constante ${nome} não encontrada em AgendaDtos.java`);
  return Number(m[1]);
};

describe('limites iguais aos da API (AgendaDtos)', () => {
  it('alunos por compromisso e ocorrências por série', () => {
    expect(ALUNOS_MAXIMO).toBe(constante('ALUNOS_MAXIMO'));
    expect(OCORRENCIAS_MAXIMO).toBe(constante('OCORRENCIAS_MAXIMO'));
    expect(OCORRENCIAS_MINIMO).toBe(constante('OCORRENCIAS_MINIMO'));
  });

  it('duração, local e observação', () => {
    expect(LIMITES_COMPROMISSO).toMatchObject({
      duracaoMinima: constante('DURACAO_MINIMA'), duracaoMaxima: constante('DURACAO_MAXIMA'),
      local: constante('LOCAL_MAXIMO'), observacao: constante('OBSERVACAO_MAXIMA'),
      alunos: constante('ALUNOS_MAXIMO'), ocorrenciasMaximo: constante('OCORRENCIAS_MAXIMO'), ocorrenciasMinimo: constante('OCORRENCIAS_MINIMO'),
    });
  });
});
