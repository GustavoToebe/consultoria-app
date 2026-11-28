import { blocosDoTexto, frasesDoTexto, idDoTopico, paragrafosPorFrase, semMarcacao, trechosDoTexto } from './blocos';
import { GUIAS } from './conteudo';

describe('trechosDoTexto', () => {
  it('marca o negrito e deixa o resto como texto', () => {
    expect(trechosDoTexto('Toque em **Editar** e depois **Salvar**.')).toEqual([
      { texto: 'Toque em ' }, { texto: 'Editar', negrito: true }, { texto: ' e depois ' }, { texto: 'Salvar', negrito: true }, { texto: '.' },
    ]);
    expect(trechosDoTexto('Sem par ** aqui')).toEqual([{ texto: 'Sem par ** aqui' }]);
  });
  it('a máscara do CPF (asteriscos colados) é texto, não negrito', () => {
    const cpf = 'só os seis dígitos do meio (***.456.789-**), para diferenciar';
    expect(trechosDoTexto(cpf)).toEqual([{ texto: cpf }]);
    expect(semMarcacao(cpf)).toBe(cpf);
    // O negrito de verdade na mesma frase continua valendo.
    expect(trechosDoTexto('Veja **Cobranças**: ***.456.789-**')).toEqual([
      { texto: 'Veja ' }, { texto: 'Cobranças', negrito: true }, { texto: ': ***.456.789-**' },
    ]);
  });
});

describe('frasesDoTexto', () => {
  it('não quebra em abreviação, número, sigla, parênteses nem aspas', () => {
    expect(frasesDoTexto('Veja a pág. 3 do guia. Depois volte.')).toEqual(['Veja a pág. 3 do guia.', 'Depois volte.']);
    expect(frasesDoTexto('São 1.500 kcal. Pronto.')).toEqual(['São 1.500 kcal.', 'Pronto.']);
    expect(frasesDoTexto('Use o Ctrl+K (ou Cmd+K. No Mac) para buscar. Fim.')).toEqual(['Use o Ctrl+K (ou Cmd+K. No Mac) para buscar.', 'Fim.']);
    expect(frasesDoTexto('Ele diz "Pronto. Tudo certo." na tela. Depois some.')).toEqual(['Ele diz "Pronto. Tudo certo." na tela.', 'Depois some.']);
    expect(frasesDoTexto('Feito por J. Silva hoje. Ok.')).toEqual(['Feito por J. Silva hoje.', 'Ok.']);
    expect(frasesDoTexto('termina em minúscula. e segue')).toEqual(['termina em minúscula. e segue']);
    expect(frasesDoTexto('Siga as etapas. 1. Destino: escolha. 2. Envie.')).toEqual(['Siga as etapas.', '1. Destino: escolha.', '2. Envie.']);
  });

  it('ponto depois das aspas fecha a frase; dentro delas, não', () => {
    expect(frasesDoTexto('O título diz "Só os meus". Depois muda.')).toEqual(['O título diz "Só os meus".', 'Depois muda.']);
    expect(frasesDoTexto('O título diz "Só os meus." Depois muda.')).toEqual(['O título diz "Só os meus." Depois muda.']);
  });
});

describe('paragrafosPorFrase', () => {
  const frase = (n: number) => `Esta é a frase número ${n} do parágrafo, com algumas palavras a mais para dar corpo ao texto.`;
  const longo = Array.from({ length: 9 }, (_, i) => frase(i + 1)).join(' ');

  it('texto curto fica inteiro', () => {
    expect(paragrafosPorFrase('Uma frase. Outra frase.')).toEqual(['Uma frase. Outra frase.']);
  });

  it('texto longo vira parágrafos de 2 ou 3 frases, sem mudar uma letra', () => {
    const partes = paragrafosPorFrase(longo);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.join(' ')).toBe(longo);
    for (const p of partes) {
      const n = frasesDoTexto(p).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('preserva o texto de todos os itens do guia', () => {
    for (const guia of Object.values(GUIAS)) {
      for (const s of guia.secoes) for (const i of s.itens) {
        if (i.texto.includes('\n')) continue;
        expect(paragrafosPorFrase(i.texto).join(' ')).toBe(i.texto);
      }
    }
  });
});

describe('blocosDoTexto', () => {
  it('texto antigo é parágrafo', () => {
    expect(blocosDoTexto('Só um parágrafo.')).toEqual([{ tipo: 'p', trechos: [{ texto: 'Só um parágrafo.' }] }]);
  });

  it('lê parágrafos, passos, marcadores e nota', () => {
    const texto = 'Abra o **Início**.\n\n1. Toque em **Editar**.\n2. Arraste o bloco.\n\n- Atualizações\n- Alunos\n\n! Precisa de internet.';
    expect(blocosDoTexto(texto)).toEqual([
      { tipo: 'p', trechos: [{ texto: 'Abra o ' }, { texto: 'Início', negrito: true }, { texto: '.' }] },
      { tipo: 'passos', itens: [[{ texto: 'Toque em ' }, { texto: 'Editar', negrito: true }, { texto: '.' }], [{ texto: 'Arraste o bloco.' }]] },
      { tipo: 'lista', itens: [[{ texto: 'Atualizações' }], [{ texto: 'Alunos' }]] },
      { tipo: 'nota', trechos: [{ texto: 'Precisa de internet.' }] },
    ]);
  });

  it('linha em branco separa duas listas', () => {
    expect(blocosDoTexto('- a\n\n- b').map((b) => b.tipo)).toEqual(['lista', 'lista']);
  });
});

describe('semMarcacao e idDoTopico', () => {
  it('tira a marcação para a busca', () => {
    expect(semMarcacao('Abra o **Início**.\n\n1. Toque em **Editar**.\n- Item\n! Nota.')).toBe('Abra o Início. Toque em Editar. Item Nota.');
  });

  it('âncora sem acento, só letras, números e hífen', () => {
    expect(idDoTopico('Todos ou Meus')).toBe('todos-ou-meus');
    expect(idDoTopico('Planilha completa: uma aba por aluno')).toBe('planilha-completa-uma-aba-por-aluno');
    expect(idDoTopico('Bom trabalho!')).toBe('bom-trabalho');
  });
});
