import { GUIAS } from './conteudo';

/** Todo o texto de um guia, num bloco só, para procurar termos. */
const textoDoGuia = (publico: 'treinador' | 'aluno') => {
  const g = GUIAS[publico];
  return [
    g.introducao,
    ...[...g.primeirosPassos, ...g.tutorial, ...g.passeio].flatMap((p) => [p.titulo, p.texto]),
    ...g.secoes.flatMap((s) => [s.titulo, ...s.itens.flatMap((i) => [i.titulo, i.texto])]),
    ...g.perguntas.flatMap((p) => [p.pergunta, p.resposta]),
  ].join('\n');
};

describe('textos da ajuda', () => {
  it('não citam nomes do contrato anterior de séries', () => {
    for (const publico of ['treinador', 'aluno'] as const) {
      const texto = textoDoGuia(publico);
      expect(texto).not.toMatch(/Só técnica/);
      expect(texto).not.toMatch(/juntoComAnterior/);
      expect(texto).not.toMatch(/intensidade/i);
      expect(texto).not.toMatch(/Fazer junto com o anterior/);
    }
  });

  it('o guia do treinador cobre o contrato novo: tipo, técnica na série, carga e esforço, grupos e cardio', () => {
    const itens = GUIAS.treinador.secoes.flatMap((s) => s.itens.map((i) => i.titulo));
    for (const titulo of ['Metodologia e tipos de série', 'Séries', 'Carga e esforço', 'Top set e Back off', 'Técnicas dentro da série', 'Grupos de exercícios', 'Cardio']) {
      expect(itens).toContain(titulo);
    }
    const texto = textoDoGuia('treinador');
    expect(texto).toContain('RIR 0 significa até a falha');
    expect(texto).toContain('nunca os dois');
    expect(texto).toContain('abaixo da referência');
  });

  it('o guia do aluno explica RIR 0, grupos, descanso depois do grupo e cardio', () => {
    const itens = GUIAS.aluno.secoes.flatMap((s) => s.itens.map((i) => i.titulo));
    for (const titulo of ['Tipos de série', 'Carga, esforço e repetições', 'Técnicas na série', 'Grupos de exercícios', 'Cardio']) {
      expect(itens).toContain(titulo);
    }
    const texto = textoDoGuia('aluno');
    expect(texto).toContain('RIR 0 aparece como "até a falha"');
    expect(texto).toContain('cada série mantém o próprio descanso');
  });

  it('nenhum item fica sem título ou sem texto', () => {
    for (const g of Object.values(GUIAS)) {
      for (const s of g.secoes) for (const i of s.itens) expect(i.titulo.trim() && i.texto.trim()).toBeTruthy();
    }
  });
});
