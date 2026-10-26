import {
  linhaDaAnamnese, mostrarCartaoAnamnese, notaDoCadastro, permissaoDeLeituraDoDestino, permissaoDoDestino, respostasIniciais, seloDaAlteracao, seloDaAnamnese, temPendente, textoDoValor, textoParaRevisar,
} from './anamnese';

describe('anamnese', () => {
  it('selo com cor de significado, diferente para o aluno e para a equipe', () => {
    expect(seloDaAnamnese('PENDENTE')).toEqual({ texto: 'Aguardando o aluno', tipo: 'atencao' });
    expect(seloDaAnamnese('PENDENTE', true)).toEqual({ texto: 'Para responder', tipo: 'atencao' });
    expect(seloDaAnamnese('ENVIADA')).toEqual({ texto: 'Para revisar', tipo: 'atencao' });
    expect(seloDaAnamnese('ENVIADA', true).tipo).toBe('sucesso');
    expect(seloDaAnamnese('REVISADA').tipo).toBe('sucesso');
    expect(seloDaAnamnese('DISPENSADA').tipo).toBe('neutro');
  });
  it('uma pendente por aluno', () => {
    expect(temPendente([{ situacao: 'ENVIADA' }, { situacao: 'DISPENSADA' }])).toBe(false);
    expect(temPendente([{ situacao: 'PENDENTE' }])).toBe(true);
  });
  it('linha de datas mostra o último marco', () => {
    const base = { atribuidaEm: '2026-10-01T12:00:00Z', enviadaEm: '2026-10-03T12:00:00Z', revisadaEm: '2026-10-04T12:00:00Z', dispensadaEm: null };
    expect(linhaDaAnamnese({ ...base, situacao: 'PENDENTE' })).toBe('Enviada ao aluno em 01/10/2026');
    expect(linhaDaAnamnese({ ...base, situacao: 'REVISADA' })).toBe('Respondida em 03/10/2026 · revisada em 04/10/2026');
    expect(linhaDaAnamnese({ ...base, situacao: 'DISPENSADA' })).toBe('Dispensada em —');
  });
  it('cartão do início só com pendente', () => {
    expect(mostrarCartaoAnamnese({ situacao: 'PENDENTE' })).toBe(true);
    expect(mostrarCartaoAnamnese({ situacao: 'ENVIADA' })).toBe(false);
    expect(mostrarCartaoAnamnese(null)).toBe(false);
  });
  it('o rascunho só vale para a mesma versão; enviada abre com as enviadas', () => {
    const a = { situacao: 'PENDENTE' as const, questionarioVersaoId: 'v1', respostas: {} };
    const rascunho = { questionarioVersaoId: 'v1', respostas: { x: 'fictício' }, fotosLocais: { f: ['a.jpg'] } };
    expect(respostasIniciais(a, rascunho)).toEqual({ respostas: { x: 'fictício' }, locais: { f: ['a.jpg'] }, secao: 0 });
    expect(respostasIniciais(a, { ...rascunho, secao: 3 }).secao).toBe(3);
    expect(respostasIniciais(a, { ...rascunho, secao: -1 }).secao).toBe(0);
    expect(respostasIniciais(a, { ...rascunho, questionarioVersaoId: 'v2', secao: 3 })).toEqual({ respostas: {}, locais: {}, secao: 0 });
    expect(respostasIniciais({ ...a, situacao: 'ENVIADA', respostas: { y: true } }, rascunho)).toEqual({ respostas: { y: true }, locais: {}, secao: 0 });
  });

  describe('respostas que alimentam o cadastro', () => {
    const modelo = { secoes: [{ titulo: 'A', perguntas: [{ id: 'pesagem', tipo: 'DATA' as const, rotulo: ' Data da pesagem ', obrigatoria: false }] }] };
    it('a tela diz qual data vale para o peso', () => {
      expect(notaDoCadastro({ tipo: 'PESO', destino: 'PESO', destinoData: 'pesagem' }, modelo))
        .toBe('Este peso vai para o seu histórico com a data respondida em “Data da pesagem” (sem ela, a data do envio).');
      expect(notaDoCadastro({ tipo: 'PESO', destino: 'PESO' }, modelo)).toBe('Este peso vai para o seu histórico com a data do envio.');
      // Data indicada que não existe mais no modelo: vale a do envio, e a tela diz isso.
      expect(notaDoCadastro({ tipo: 'PESO', destino: 'PESO', destinoData: 'fantasma' }, modelo)).toBe('Este peso vai para o seu histórico com a data do envio.');
      expect(notaDoCadastro({ tipo: 'TEXTO', destino: 'OBJETIVO' }, modelo)).toBe('Esta resposta vai para o objetivo do seu cadastro.');
      expect(notaDoCadastro({ tipo: 'PESO' }, modelo)).toBeNull();
      expect(notaDoCadastro({ tipo: 'TEXTO_LONGO', destino: 'OBJETIVO' }, modelo)).toBeNull();
      expect(notaDoCadastro({ tipo: 'TEXTO', destino: 'CPF' }, modelo)).toBe('Esta resposta vai para o CPF do seu cadastro.');
      expect(notaDoCadastro({ tipo: 'TELEFONE', destino: 'TELEFONE' }, modelo)).toBe('Esta resposta vai para o telefone do seu cadastro.');
      expect(notaDoCadastro({ tipo: 'ENDERECO', destino: 'ENDERECO' }, modelo)).toBe('Esta resposta vai para o endereço do seu cadastro.');
      expect(notaDoCadastro({ tipo: 'TEXTO', destino: 'ENDERECO' }, modelo)).toBeNull();
    });
    it('valor em texto, "—" sem dado', () => {
      expect(textoDoValor('PESO', { pesoKg: 80.5, data: '2026-01-10' })).toBe('80,5 kg em 10/01/2026');
      expect(textoDoValor('OBJETIVO', { texto: ' Objetivo fictício ' })).toBe('Objetivo fictício');
      expect(textoDoValor('OBJETIVO', null)).toBe('—');
      expect(textoDoValor('PESO', {})).toBe('—');
      expect(textoDoValor('CPF', { texto: '529.982.247-25' })).toBe('529.982.247-25');
      expect(textoDoValor('TELEFONE', { texto: '(45) 99999-8888' })).toBe('(45) 99999-8888');
      expect(textoDoValor('ENDERECO', { endereco: { cep: '01310-100', logradouro: 'Rua Exemplo', numero: '100', complemento: null, bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'SP' } }))
        .toBe('Rua Exemplo, 100 - Centro · Cidade Exemplo/SP - 01310-100');
      expect(textoDoValor('ENDERECO', {})).toBe('—');
      expect(textoDoValor('CPF', null)).toBe('—');
    });
    it('selo e contagem das alterações', () => {
      expect(seloDaAlteracao({ situacao: 'PENDENTE', automatica: false })).toEqual({ texto: 'Para revisar', tipo: 'atencao' });
      expect(seloDaAlteracao({ situacao: 'APLICADA', automatica: true }).texto).toBe('Preenchido no envio');
      expect(seloDaAlteracao({ situacao: 'APLICADA', automatica: false }).texto).toBe('Aplicada');
      expect(seloDaAlteracao({ situacao: 'DESCARTADA', automatica: false }).tipo).toBe('neutro');
      expect(textoParaRevisar(0)).toBeNull();
      expect(textoParaRevisar(1)).toBe('1 alteração do cadastro para revisar');
      expect(textoParaRevisar(2)).toBe('2 alterações do cadastro para revisar');
    });
  });
});

describe('permissão por destino (igual a DestinoNoPerfil.permissao() na API)', () => {
  it('telefone é contato (ALUNO_ALTERAR/ALUNO_LER); os demais são dado sensível', () => {
    expect(permissaoDoDestino('TELEFONE')).toBe('ALUNO_ALTERAR');
    expect(permissaoDoDestino('SEXO')).toBe('ALUNO_ALTERAR');
    expect(permissaoDeLeituraDoDestino('TELEFONE')).toBe('ALUNO_LER');
    expect(permissaoDeLeituraDoDestino('SEXO')).toBe('ALUNO_LER');
    for (const d of ['PESO', 'OBJETIVO', 'CPF', 'ENDERECO'] as const) {
      expect(permissaoDoDestino(d)).toBe('ALUNO_SENSIVEL_ALTERAR');
      expect(permissaoDeLeituraDoDestino(d)).toBe('ALUNO_SENSIVEL_LER');
    }
  });
});
