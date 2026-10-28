import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { comparar, medidasVazias } from '../dominio/avaliacaoFisica';
import { documentoAvaliacaoFisica } from './pdfAvaliacaoFisica';

const marca = { nome: 'Consultoria <Fictícia>', corPrimaria: '#123456' } as unknown as Marca;

function avaliacao(id: string, data: string, parcial: Partial<MedidasCorporais>, pesoKg: number | null, observacao: string | null = null): AvaliacaoFisica {
  return { id, data, medidas: { ...medidasVazias(), ...parcial }, observacao, pesoKg, versao: 0, criadoEm: '', alteradoEm: '' };
}

const todas = [
  avaliacao('a', '2026-07-01', { cintura: 90, quadril: 100 }, 82, 'Medida <b>fictícia</b>'),
  avaliacao('b', '2026-09-01', { cintura: 85.5 }, null),
];

function gerar() {
  return documentoAvaliacaoFisica({
    marca,
    logoDataUri: null,
    aluno: 'Aluno <script>alert(1)</script>',
    comparacao: comparar(todas, ['b', 'a']),
    observacoes: todas.map((a) => ({ data: a.data, texto: a.observacao ?? '' })),
    emitidoEm: new Date('2026-10-28T12:00:00Z'),
  });
}

describe('PDF da avaliação física', () => {
  it('tabela medida × data em ordem cronológica, diferença com sinal e "—" no que falta', () => {
    const { corpo, titulo } = gerar();
    expect(corpo.indexOf('01/07/2026')).toBeLessThan(corpo.indexOf('01/09/2026'));
    expect(corpo).toContain('90,0 cm');
    expect(corpo).toContain('85,5 cm');
    expect(corpo).toContain('−4,5 cm');
    // Quadril só na primeira data e peso só na primeira: aparecem, sem diferença.
    expect(corpo).toMatch(/Quadril.*100,0 cm.*—.*—/s);
    expect(corpo).toContain('82 kg');
    // Nada de interpretação.
    expect(corpo.toLowerCase()).not.toMatch(/gordura|melhor|pior|ótimo|bom resultado/);
    expect(titulo).toContain('Avaliação física');
  });

  it('escapa nome, marca e observação', () => {
    const { corpo, titulo } = gerar();
    expect(corpo).not.toContain('<script>');
    expect(corpo).not.toContain('<b>fictícia</b>');
    expect(corpo).toContain('&lt;b&gt;fictícia&lt;/b&gt;');
    expect(titulo).toContain('<script>'); // o título vai escapado por documentoCompleto
  });
});
