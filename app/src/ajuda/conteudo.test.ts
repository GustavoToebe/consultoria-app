import { PROTOCOLOS } from '../dominio/cardio';
import { GUIAS, SECAO_CARDIO_E_HIIT, secoesDoGuia, textoDoItem } from './conteudo';

describe('seção Cardio e HIIT', () => {
  it('traz cada protocolo com o mesmo texto do ⓘ do editor (o conteudo.ts não importa nada, então o teste amarra)', () => {
    const secao = GUIAS.treinador.secoes.find((s) => s.id === SECAO_CARDIO_E_HIIT);
    expect(secao?.titulo).toBe('Cardio e HIIT');
    for (const p of PROTOCOLOS) {
      const item = secao?.itens.find((i) => i.titulo === p.rotulo);
      expect(item?.texto.startsWith(p.definicao)).toBe(true);
    }
  });

  it('os guias explicam a folha "Escolher cardio", os blocos, o all-out e o timer do aluno, sem calcular nada de saúde', () => {
    const treinador = textoDoGuia('treinador');
    for (const termo of ['Escolher cardio', 'Cardio · Escada', 'cardio manual', '+ Novo bloco de cardio', 'all-out', 'Timer do aluno']) expect(treinador).toContain(termo);
    const aluno = textoDoGuia('aluno');
    for (const termo of ['Iniciar timer', 'Volta 3 de 10', 'all-out', 'marcar como feito', 'só o "feito" é registrado']) expect(aluno).toContain(termo);
    // O cardio não tem mais a série de antes ("tempo de esforço", "a quantidade" do cardio).
    expect(treinador).not.toMatch(/tempo de esforço|no cardio, a quantidade/);
  });
});

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
    for (const titulo of ['Metodologia e tipos de série', 'Séries', 'Carga e esforço', 'Back off', 'Técnicas dentro da série', 'Grupos de exercícios', 'Cardio']) {
      expect(itens).toContain(titulo);
    }
    const texto = textoDoGuia('treinador');
    expect(texto).toContain('RIR 0 significa até a falha');
    expect(texto).toContain('nunca os dois');
    expect(texto).not.toMatch(/abaixo da referência|acima da anterior|mesma carga da/i);
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

  it('nenhum guia cita a barra superior nem "Todas as telas", que saíram (guia de 11/11)', () => {
    // Tudo o que a Ajuda, o tutorial, o passeio e o PDF mostram, inclusive o que só sai no PDF.
    const tudo = JSON.stringify(GUIAS);
    expect(tudo).not.toMatch(/Todas as telas|barra superior|barra de topo|canto superior direito/i);
    const passeio = GUIAS.treinador.passeio.map((p) => p.alvo);
    expect(passeio).toEqual(expect.arrayContaining(['menu:busca', 'menu:conta']));
  });

  it('cada seção tem um id ASCII, único no guia (índice, rolagem e vídeos)', () => {
    for (const g of Object.values(GUIAS)) {
      const ids = g.secoes.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('os guias do treinador e do aluno explicam Overtraining Pay, homologação, abatimento automático e pagamento no app', () => {
    const treinador = textoDoGuia('treinador');
    expect(treinador).toContain('Overtraining Pay');
    expect(treinador).toContain('Homologação e Conta de Repasse');
    expect(treinador).toContain('R$ 5,00');
    expect(treinador).toContain('abatimento automático pelo Split');
    const aluno = textoDoGuia('aluno');
    expect(aluno).toContain('Overtraining Pay');
    expect(aluno).toContain('Pix na hora, pelo QR Code');
    expect(aluno).not.toContain('QR Code Pix imediato');
    expect(aluno).not.toContain('até 12x');
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
      const ligada = secoesDoGuia(guia, true, true, true, true).map((s) => s.titulo);
      const desligada = secoesDoGuia(guia, false, true, true, true).map((s) => s.titulo);
      const doRetorno = guia.secoes.filter((s) => s.soComRetorno).map((s) => s.titulo);
      expect(doRetorno).toHaveLength(1);
      expect(ligada).toEqual(guia.secoes.map((s) => s.titulo));
      expect(desligada).not.toContain(doRetorno[0]);
      expect(desligada).toHaveLength(guia.secoes.length - 1);
    }
  });
});

describe('seção da página pública da vitrine', () => {
  it('só aparece com a chave da loja ligada, e só no guia do treinador', () => {
    const daLoja = GUIAS.treinador.secoes.filter((s) => s.soComLoja).map((s) => s.titulo);
    expect(daLoja).toHaveLength(1);
    expect(GUIAS.aluno.secoes.filter((s) => s.soComLoja)).toHaveLength(0);
    expect(secoesDoGuia(GUIAS.treinador, true, true, true, true).map((s) => s.titulo)).toContain(daLoja[0]);
    expect(secoesDoGuia(GUIAS.treinador, true, true).map((s) => s.titulo)).not.toContain(daLoja[0]);
  });
});

describe('seções da vitrine', () => {
  it('só aparecem com a chave ligada, nos dois guias', () => {
    for (const guia of [GUIAS.treinador, GUIAS.aluno]) {
      const ligada = secoesDoGuia(guia, true, true, true, true).map((s) => s.titulo);
      const desligada = secoesDoGuia(guia, true, false, true, true).map((s) => s.titulo);
      const daVitrine = guia.secoes.filter((s) => s.soComVitrine).map((s) => s.titulo);
      expect(daVitrine).toHaveLength(1);
      expect(ligada).toEqual(guia.secoes.map((s) => s.titulo));
      expect(desligada).not.toContain(daVitrine[0]);
      expect(desligada).toHaveLength(guia.secoes.length - 1);
    }
  });
});

describe('seções dos contratos', () => {
  it('só aparecem com a chave ligada, uma em cada guia', () => {
    for (const guia of [GUIAS.treinador, GUIAS.aluno]) {
      const ligada = secoesDoGuia(guia, true, true, true, true).map((s) => s.titulo);
      const desligada = secoesDoGuia(guia, true, true, true, false).map((s) => s.titulo);
      const dosContratos = guia.secoes.filter((s) => s.soComContratos).map((s) => s.titulo);
      expect(dosContratos).toHaveLength(1);
      expect(ligada).toEqual(guia.secoes.map((s) => s.titulo));
      expect(desligada).not.toContain(dosContratos[0]);
      expect(desligada).toHaveLength(guia.secoes.length - 1);
    }
  });
});
