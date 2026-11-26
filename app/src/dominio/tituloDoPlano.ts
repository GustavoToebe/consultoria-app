import type { TipoPlano } from '../api/tipos';
import { tituloDoPlanoDoAluno } from './planoDoAluno';

/**
 * Título que o aluno e o PDF mostram: espelho de `TituloDoPlanoPublicado` (API). A API só limpa na publicação; planos
 * publicados antes da regra, e o rascunho do PDF do treinador, ainda trazem o título técnico. Tira o "(rascunho)" e, se
 * sobrar só o nome padrão da importação (ou nada), usa "Treino de <aluno>" / "Dieta de <aluno>" / "Mobilidade de <aluno>",
 * cortado em 120 como na API. Título que o treinador escolheu fica como está. Casos repetidos em `tituloDoPlano.test.ts`.
 */

const NOME_PADRAO_DA_IMPORTACAO = 'importada da planilha';
const MAXIMO = 120;
const RASCUNHO = /\(\s*rascunho\s*\)/gi;

const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').trim();

export function tituloDoPlano(titulo: string | null | undefined, tipo: TipoPlano, nomeDoAluno: string | null | undefined): string {
  const limpo = normalizar((titulo ?? '').replace(RASCUNHO, ' '));
  if (limpo && limpo.toLowerCase() !== NOME_PADRAO_DA_IMPORTACAO) return limpo;
  return tituloDoPlanoDoAluno(tipo, normalizar(nomeDoAluno ?? '')).slice(0, MAXIMO).trimEnd();
}
