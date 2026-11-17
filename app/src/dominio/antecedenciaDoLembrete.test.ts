import {
  adicionarLembrete, antecedenciaParaTela, conferirLembretes, errosDosLembretesDaApi, lembretesSaoOPadrao, linhasDosMinutos,
  type LinhaDeLembrete, mascaraDaAntecedencia, minutosDaLinha, MOTIVO_SEM_ADICIONAR, motivoSemAdicionar, mudarLembrete,
  removerLembrete, rotuloDaUnidade,
} from './antecedenciaDoLembrete';

const linha = (id: string, valor: string, unidade: LinhaDeLembrete['unidade'] = 'MINUTOS'): LinhaDeLembrete => ({ id, valor, unidade });

describe('minutos ↔ tela', () => {
  it('usa a maior unidade que divide exato', () => {
    expect(antecedenciaParaTela(1440)).toEqual({ valor: '1', unidade: 'DIAS' });
    expect(antecedenciaParaTela(120)).toEqual({ valor: '2', unidade: 'HORAS' });
    expect(antecedenciaParaTela(90)).toEqual({ valor: '90', unidade: 'MINUTOS' });
    expect(antecedenciaParaTela(30)).toEqual({ valor: '30', unidade: 'MINUTOS' });
    expect(antecedenciaParaTela(40320)).toEqual({ valor: '28', unidade: 'DIAS' });
    expect(antecedenciaParaTela(1500)).toEqual({ valor: '25', unidade: 'HORAS' });
  });

  it('converte a linha em minutos; texto que não é inteiro é nulo', () => {
    expect(minutosDaLinha(linha('n1', '28', 'DIAS'))).toBe(40320);
    expect(minutosDaLinha(linha('n1', '2', 'HORAS'))).toBe(120);
    expect(minutosDaLinha(linha('n1', ''))).toBeNull();
    expect(minutosDaLinha(linha('n1', '1,5', 'HORAS'))).toBeNull();
  });

  it('o campo aceita só dígitos, até cinco', () => {
    expect(mascaraDaAntecedencia('1,5h')).toBe('15');
    expect(mascaraDaAntecedencia('-30')).toBe('30');
    expect(mascaraDaAntecedencia('1234567')).toBe('12345');
  });

  it('o rótulo da unidade concorda com o número', () => {
    expect(rotuloDaUnidade('MINUTOS', '1')).toBe('minuto');
    expect(rotuloDaUnidade('MINUTOS', '30')).toBe('minutos');
    expect(rotuloDaUnidade('HORAS', '1')).toBe('hora');
    expect(rotuloDaUnidade('DIAS', '')).toBe('dias');
  });

  it('as linhas do compromisso gravado mantêm a ordem', () => {
    expect(linhasDosMinutos([1440, 120, 90])).toEqual([linha('n1', '1', 'DIAS'), linha('n2', '2', 'HORAS'), linha('n3', '90')]);
    expect(linhasDosMinutos([])).toEqual([]);
  });
});

describe('adicionar, remover e mudar', () => {
  it('a nova linha vem com a primeira sugestão livre e nunca repete', () => {
    let lista = linhasDosMinutos([30]);
    lista = adicionarLembrete(lista);
    expect(lista[1]).toEqual(linha('n2', '10'));
    lista = adicionarLembrete(lista);
    expect(lista[2]).toEqual(linha('n3', '1', 'HORAS'));
    lista = adicionarLembrete(adicionarLembrete(lista));
    expect(lista.map(minutosDaLinha)).toEqual([30, 10, 60, 120, 1440]);
    expect(conferirLembretes(lista).minutos).toEqual([30, 10, 60, 120, 1440]);
  });

  it('com cinco não adiciona e diz por quê', () => {
    const cinco = linhasDosMinutos([1, 2, 3, 4, 5]);
    expect(motivoSemAdicionar(cinco)).toBe(MOTIVO_SEM_ADICIONAR);
    expect(MOTIVO_SEM_ADICIONAR).toBe('Máximo de 5 notificações.');
    expect(adicionarLembrete(cinco)).toHaveLength(5);
    expect(motivoSemAdicionar(cinco.slice(1))).toBeNull();
  });

  it('o id da nova linha não colide depois de remover', () => {
    const lista = removerLembrete(linhasDosMinutos([30, 10, 60]), 'n1');
    expect(lista.map((l) => l.id)).toEqual(['n2', 'n3']);
    expect(adicionarLembrete(lista)[2].id).toBe('n4');
  });

  it('remover todas deixa a lista vazia (= sem lembrete), que é válida', () => {
    const vazia = removerLembrete(linhasDosMinutos([30]), 'n1');
    expect(vazia).toEqual([]);
    expect(conferirLembretes(vazia)).toEqual({ porLinha: {}, minutos: [] });
    expect(adicionarLembrete(vazia)).toEqual([linha('n1', '10')]);
  });

  it('trocar a unidade mantém o número; digitar passa pela máscara', () => {
    const lista = linhasDosMinutos([30]);
    expect(mudarLembrete(lista, 'n1', { unidade: 'DIAS' })).toEqual([linha('n1', '30', 'DIAS')]);
    expect(mudarLembrete(lista, 'n1', { valor: '4a5' })).toEqual([linha('n1', '45')]);
    expect(mudarLembrete(lista, 'outra', { valor: '1' })).toEqual(lista);
  });

  it('a padrão é uma de 30 minutos, em qualquer unidade equivalente', () => {
    expect(lembretesSaoOPadrao(linhasDosMinutos([30]))).toBe(true);
    expect(lembretesSaoOPadrao([])).toBe(false);
    expect(lembretesSaoOPadrao(linhasDosMinutos([30, 10]))).toBe(false);
    expect(lembretesSaoOPadrao([linha('n1', '')])).toBe(false);
  });
});

describe('conferir', () => {
  it('limites 1 e 40320 depois de converter: 28 dias vale, 29 não', () => {
    expect(conferirLembretes([linha('n1', '1'), linha('n2', '28', 'DIAS')]).minutos).toEqual([1, 40320]);
    expect(conferirLembretes([linha('n1', '29', 'DIAS')])).toEqual({ porLinha: { n1: 'De 1 minuto a 28 dias antes.' }, minutos: null });
    expect(conferirLembretes([linha('n1', '0')]).porLinha).toEqual({ n1: 'De 1 minuto a 28 dias antes.' });
    expect(conferirLembretes([linha('n1', '40321')]).porLinha).toEqual({ n1: 'De 1 minuto a 28 dias antes.' });
    expect(conferirLembretes([linha('n1', '673', 'HORAS')]).porLinha).toEqual({ n1: 'De 1 minuto a 28 dias antes.' });
  });

  it('vazia pede a antecedência; a mensagem nunca repete o valor', () => {
    const { porLinha } = conferirLembretes([linha('n1', ' '), linha('n2', '99999', 'DIAS')]);
    expect(porLinha).toEqual({ n1: 'Informe a antecedência.', n2: 'De 1 minuto a 28 dias antes.' });
    expect(porLinha.n2).not.toContain('99999');
  });

  it('repetida pela quantidade em minutos: o erro fica na que vem depois', () => {
    const r = conferirLembretes([linha('n1', '60'), linha('n2', '1', 'HORAS'), linha('n3', '2', 'HORAS')]);
    expect(r).toEqual({ porLinha: { n2: 'Igual a outra notificação. Mude ou remova esta.' }, minutos: null });
  });

  it('mais de cinco é erro da lista (só se a tela recebesse assim)', () => {
    expect(conferirLembretes(linhasDosMinutos([1, 2, 3, 4, 5, 6]))).toEqual({ porLinha: {}, lista: 'Até 5 notificações.', minutos: null });
  });
});

describe('422 da API', () => {
  const enviadas = linhasDosMinutos([30, 10]);

  it('lembretesMinutos[i] vai para a linha i e lembretesMinutos, para a lista', () => {
    expect(errosDosLembretesDaApi({ 'lembretesMinutos[1]': 'Fora da faixa.', lembretesMinutos: 'Repetidos.', data: 'Outra coisa.' }, enviadas))
      .toEqual({ porLinha: { n2: 'Fora da faixa.' }, lista: 'Repetidos.' });
  });

  it('sem erro dos lembretes, vazio; índice que a tela não tem vai para a lista', () => {
    expect(errosDosLembretesDaApi({ data: 'Outra coisa.' }, enviadas)).toEqual({ porLinha: {} });
    expect(errosDosLembretesDaApi({ 'lembretesMinutos[7]': 'Fora da faixa.' }, enviadas)).toEqual({ porLinha: {}, lista: 'Fora da faixa.' });
  });
});
