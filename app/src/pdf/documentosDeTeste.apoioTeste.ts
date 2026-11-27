import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { medidasVazias } from '../dominio/avaliacaoFisica';
import { normalizarMobilidade } from '../dominio/mobilidade';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from './exemplos';
import type { Documento } from './html';
import { documentoAvaliacaoFisica } from './pdfAvaliacaoFisica';
import { documentoCargas } from './pdfCargas';
import { documentoListaDeCompras } from './pdfListaDeCompras';
import { documentoMobilidade } from './pdfMobilidade';

/** Apoio de teste: os seis documentos dos PDFs com dados 100% fictícios, cada um pelo gerador de verdade. */
const emitidoEm = new Date('2026-10-11T19:30:00Z');
const base = { logoDataUri: null, aluno: 'Aluno de Exemplo', titulo: 'Plano', rodapePdf: null, emitidoEm };
const linhaCarga = { data: '2026-10-07', carga: 90, repeticoes: 6, etapas: '4+4 = 8', cargaVariavel: false, volume: { valor: 540, completo: true }, series: 5, semCarga: false, feitoSemCarga: false, observacoes: ['Observação do aluno'] };
const linhaDaLista = { chave: 'a', nome: 'Arroz', unidade: 'g' as const, quantidade: 1225, cru: true, bruto: false, semFator: false, naDieta: 1050, quantidadeCru: 420, fatorCorrecao: null, fatorCoccao: 2.5, grupo: 'Cereais' };
const avaliacao = (id: string, data: string, medidas: Partial<MedidasCorporais>, pesoKg: number | null): AvaliacaoFisica => ({
  id, data, medidas: { ...medidasVazias(), ...medidas }, observacao: 'Observação fictícia', pesoKg, versao: 0, criadoEm: '', alteradoEm: '',
});

export const GERADORES_DE_TESTE: Record<string, (m: Marca) => Documento> = {
  treino: (m) => documentoDeExemploDeTreino(m, emitidoEm),
  dieta: (m) => documentoDeExemploDeDieta(m, emitidoEm),
  mobilidade: (m) =>
    documentoMobilidade({
      ...base, marca: m, versao: 1,
      conteudo: normalizarMobilidade({ secoes: [{ uid: 's', titulo: 'Seção', itens: [{ uid: 'i', nome: 'Gato-camelo', prescricao: '2x30s', videoUrl: 'https://youtu.be/exemplo' }, { uid: 'j', nome: 'Ponte', prescricao: '2x30s', videoUrl: null }] }] }),
    }),
  cargas: (m) =>
    documentoCargas({
      ...base, marca: m, de: '2026-10-01', ate: '2026-10-14',
      divisoes: [{ chave: 'd', nome: 'Pernas', exercicios: [{ chave: 'x', nome: 'Mesa flexora', linhas: [linhaCarga, { ...linhaCarga, data: '2026-10-14' }, { ...linhaCarga, data: '2026-10-15' }] }] }],
    }),
  'lista de compras': (m) =>
    documentoListaDeCompras({ ...base, marca: m, versao: 1, periodo: 'semana', opcoes: ['Café da manhã: opção B'], linhas: [linhaDaLista, { ...linhaDaLista, chave: 'b', nome: 'Feijão' }, { ...linhaDaLista, chave: 'c', nome: 'Aveia' }] }),
  'avaliação física': (m) =>
    documentoAvaliacaoFisica({
      marca: m, logoDataUri: null, aluno: 'Aluno de Exemplo', emitidoEm, escolhidas: ['a', 'b'],
      avaliacoes: [avaliacao('a', '2026-07-01', { cintura: 90, quadril: 100 }, 82), avaliacao('b', '2026-09-01', { cintura: 85.5 }, null)],
    }),
};
