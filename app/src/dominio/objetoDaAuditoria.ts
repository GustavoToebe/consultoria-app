/**
 * O objeto afetado por um evento da Auditoria (27/11): o rótulo do tipo (`entidade` da API) e, quando existe uma tela
 * para ele, a rota que o abre. O nome vem pronto da API (`objetoNome`, sem o tipo). Funções puras.
 */
interface Tipo { rotulo: string; /** Nome de pessoa ou texto que já se explica: sem aspas. */ semAspas?: boolean; rota?: (id: string) => string }

const TIPOS: Record<string, Tipo> = {
  ALUNO: { rotulo: 'Aluno', semAspas: true, rota: (id) => `/treinador/alunos/${id}` },
  USUARIO: { rotulo: 'Membro', semAspas: true },
  COBRANCA: { rotulo: 'Cobrança', semAspas: true },
  QUESTIONARIO: { rotulo: 'Questionário', rota: (id) => `/treinador/planejamento/questionario/${id}` },
  // O `entidadeId` do publicar e do copiar é o id do plano (`Auditoria.idDoResultado`), o mesmo das rotas dos editores.
  TREINO: { rotulo: 'Treino', rota: (id) => `/treinador/treinos/${id}` },
  DIETA: { rotulo: 'Dieta', rota: (id) => `/treinador/dietas/${id}` },
  MOBILIDADE: { rotulo: 'Mobilidade', rota: (id) => `/treinador/mobilidades/${id}` },
  PLANO: { rotulo: 'Plano' },
  PASTA: { rotulo: 'Pasta' },
  PERFIL: { rotulo: 'Perfil' },
  INSCRICAO: { rotulo: 'Inscrição' },
  INSCRICAO_MODELO: { rotulo: 'Resposta pronta' },
  PLANO_COMERCIAL: { rotulo: 'Plano comercial' },
  CONTRATACAO: { rotulo: 'Contratação' },
  LANCAMENTO_FINANCEIRO: { rotulo: 'Lançamento' },
  ACORDO: { rotulo: 'Acordo' },
  CONTRATO: { rotulo: 'Contrato' },
  CONTRATO_MODELO: { rotulo: 'Modelo de contrato' },
  COMPROMISSO: { rotulo: 'Compromisso' },
  EVENTO_AGENDA: { rotulo: 'Evento' },
  AGENDA_PESSOAL: { rotulo: 'Agenda' },
  AVALIACAO_FISICA: { rotulo: 'Avaliação física' },
  ANAMNESE: { rotulo: 'Anamnese' },
  LESAO: { rotulo: 'Lesão' },
  EXERCICIO: { rotulo: 'Exercício' },
  CONSULTORIA: { rotulo: 'Consultoria' },
};

const tipoDe = (entidade: string | null | undefined): Tipo | null => (entidade ? TIPOS[entidade.toUpperCase()] ?? null : null);

/** O rótulo do tipo do objeto ("Aluno", "Questionário"); tipo desconhecido = `null`. */
export function rotuloDoTipo(entidade: string | null | undefined): string | null {
  return tipoDe(entidade)?.rotulo ?? null;
}

interface EventoComObjeto { entidade: string; entidadeId: string | null; objetoNome?: string | null }

/**
 * "Aluno Vitor Luiz Santos", "Cobrança 11/2026 de R$ 997,00", "Questionário “Padrão”": pessoa e cobrança sem aspas, o
 * resto com aspas (é um nome dado pela equipe). Tipo desconhecido fica só com o nome. Sem objeto = `null`.
 */
export function textoDoObjeto(e: EventoComObjeto): string | null {
  const nome = e.objetoNome?.trim();
  if (!nome) return null;
  const tipo = tipoDe(e.entidade);
  if (!tipo) return nome;
  return tipo.semAspas ? `${tipo.rotulo} ${nome}` : `${tipo.rotulo} “${nome}”`;
}

/** A rota que abre o objeto: só com nome (nulo = apagado ou não resolvido), id e uma tela para o tipo. */
export function rotaDoObjeto(e: EventoComObjeto): string | null {
  const rota = tipoDe(e.entidade)?.rota;
  return rota && e.entidadeId && e.objetoNome?.trim() ? rota(e.entidadeId) : null;
}
