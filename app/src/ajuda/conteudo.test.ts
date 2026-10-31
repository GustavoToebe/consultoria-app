import { GUIAS, secoesDoGuia, textoDoItem } from './conteudo';

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

  it('os guias usam os rótulos novos e explicam a ordem de renovar a pasta', () => {
    const treinador = textoDoGuia('treinador');
    expect(treinador).toContain('Observação desta série');
    expect(treinador).not.toMatch(/alvo extra/i);
    expect(treinador).toContain('Finalizar não publica nada');
    expect(treinador).toContain('para um novo período, renove a pasta');
    const aluno = textoDoGuia('aluno');
    expect(aluno).toContain('"Último registro"');
    expect(aluno).not.toMatch(/alvo extra/i);
    expect(aluno).toContain('80% da WS registrada nesta sessão');
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

describe('frase do ciclo no guia', () => {
  const itemDoSexo = GUIAS.treinador.secoes.flatMap((s) => s.itens).find((i) => i.titulo === 'Pergunta de sexo');

  it('o guia do treinador tem a frase, e a tela a tira com o ciclo desligado', () => {
    expect(itemDoSexo?.texto).toContain('desliga o acompanhamento do ciclo');
    expect(textoDoItem(itemDoSexo?.texto ?? '', true)).toBe(itemDoSexo?.texto);
    const sem = textoDoItem(itemDoSexo?.texto ?? '', false);
    expect(sem).not.toMatch(/ciclo/i);
    expect(sem.endsWith('Aplicar pede a permissão de alterar o aluno.')).toBe(true);
  });

  it('texto sem a frase não muda', () => {
    expect(textoDoItem('Outro texto.', false)).toBe('Outro texto.');
  });
});

describe('seções do retorno imediato', () => {
  it('só aparecem com a chave ligada, nos dois guias', () => {
    for (const guia of [GUIAS.treinador, GUIAS.aluno]) {
      const ligada = secoesDoGuia(guia, true).map((s) => s.titulo);
      const desligada = secoesDoGuia(guia, false).map((s) => s.titulo);
      const doRetorno = guia.secoes.filter((s) => s.soComRetorno).map((s) => s.titulo);
      expect(doRetorno).toHaveLength(1);
      expect(ligada).toEqual(guia.secoes.map((s) => s.titulo));
      expect(desligada).not.toContain(doRetorno[0]);
      expect(desligada).toHaveLength(guia.secoes.length - 1);
    }
  });
});
