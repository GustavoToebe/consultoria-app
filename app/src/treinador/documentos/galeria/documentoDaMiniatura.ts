import type { Marca } from '../../../api/tipos';
import type { ModeloPdf } from '../../../dominio/configuracaoPdf';
import { normalizarTreino } from '../../../dominio/editorTreino';
import type { Documento } from '../../../pdf/html';
import { documentoTreino } from '../../../pdf/pdfTreino';

/**
 * Exemplo curto da miniatura (D-F4): o gerador real do treino com a marca da consultoria e o modelo puro (sem as
 * personalizações), mas só com o que o recorte do topo mostra (cabeçalho e a tabela da semana). Dados 100% fictícios.
 */
const CONTEUDO = normalizarTreino({
  sessoes: [
    { uid: 'mini-a', nome: 'Treino A - Peito e tríceps', diaSemana: 1, exercicios: [], grupos: [] },
    { uid: 'mini-b', nome: 'Treino B - Costas e bíceps', diaSemana: 3, exercicios: [], grupos: [] },
    { uid: 'mini-c', nome: 'Treino C - Pernas', diaSemana: 5, exercicios: [], grupos: [] },
  ],
});

export function documentoDaMiniatura(marca: Marca, modelo: ModeloPdf, emitidoEm: Date, logoDataUri: string | null): Documento {
  return documentoTreino({
    marca: { ...marca, temaPdf: modelo, opcoesPdf: {} },
    logoDataUri,
    aluno: 'Aluno de Exemplo',
    titulo: 'Plano de Exemplo',
    inicio: '2026-01-05',
    fim: '2026-02-01',
    versao: 1,
    conteudo: CONTEUDO,
    instrucoesTreino: null,
    rodapePdf: null,
    emitidoEm,
  });
}
