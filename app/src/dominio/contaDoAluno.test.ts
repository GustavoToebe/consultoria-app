import {
  contatoDaConsultoriaNaConta, cpfMascarado, envioDoMeuPerfil, existeContratosNaConta, meuPerfilMudou, resumoDoApelido, resumoDoContratoNaConta, resumoDosDados, secoesVisiveis, seloDoPlano,
  SEM_EDICAO_DO_PERFIL,
} from './contaDoAluno';
import type { PreferenciasLidas } from './perfilDaComunidade';

const LIDO: PreferenciasLidas = { perfilReservado: false, reservadoEfetivo: false, destaques: ['A'], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' };

describe('secoesVisiveis', () => {
  it('na ordem de leitura de 28/11, com Perfil, App, Privacidade e Segurança sempre', () => {
    expect(secoesVisiveis({ plano: true, dados: true, convite: true, consultoria: true }).map((s) => s.chave))
      .toEqual(['perfil', 'consultoria', 'app', 'plano', 'convite', 'dados', 'privacidade', 'seguranca']);
    expect(secoesVisiveis({ plano: false, dados: false, convite: false }).map((s) => s.chave))
      .toEqual(['perfil', 'app', 'privacidade', 'seguranca']);
  });

  it('o Perfil preso à primeira coluna e "Sua consultoria", logo depois, à segunda', () => {
    const secoes = secoesVisiveis({ plano: true, dados: true, convite: true, consultoria: true });
    expect(secoes.slice(0, 2).map((s) => [s.chave, s.coluna])).toEqual([['perfil', 0], ['consultoria', 1]]);
    expect(secoes.slice(2).every((s) => s.coluna === undefined)).toBe(true);
  });

  it('"Meus contratos" vem depois de "Meu plano" e só com existe.contratos', () => {
    expect(secoesVisiveis({ plano: true, dados: true, convite: true, contratos: true }).map((s) => s.chave))
      .toEqual(['perfil', 'app', 'plano', 'contratos', 'convite', 'dados', 'privacidade', 'seguranca']);
    expect(secoesVisiveis({ plano: true, dados: true, convite: true, contratos: false }).map((s) => s.chave)).not.toContain('contratos');
    // Ausente = não existe (contratos e "Sua consultoria").
    expect(secoesVisiveis({ plano: true, dados: true, convite: true }).map((s) => s.chave)).not.toContain('contratos');
    expect(secoesVisiveis({ plano: true, dados: true, convite: true }).map((s) => s.chave)).not.toContain('consultoria');
  });
});

describe('contatoDaConsultoriaNaConta', () => {
  it('WhatsApp e redes juntos; cada um sozinho também faz o cartão existir', () => {
    expect(contatoDaConsultoriaNaConta('45999998888', { instagram: 'https://www.instagram.com/ficticia' }))
      .toEqual({ whatsapp: 'https://wa.me/5545999998888', redes: [{ rede: 'instagram', url: 'https://www.instagram.com/ficticia' }] });
    expect(contatoDaConsultoriaNaConta('45999998888', null)).toEqual({ whatsapp: 'https://wa.me/5545999998888', redes: [] });
    expect(contatoDaConsultoriaNaConta(null, { site: 'https://exemplo.test' })?.whatsapp).toBeNull();
  });

  it('sem WhatsApp nem rede segura, o cartão não existe', () => {
    expect(contatoDaConsultoriaNaConta(null, null)).toBeNull();
    expect(contatoDaConsultoriaNaConta(undefined, {})).toBeNull();
    expect(contatoDaConsultoriaNaConta('', { instagram: 'http://inseguro.test', x: '' })).toBeNull();
  });
});

describe('contratos na Conta', () => {
  it('existe com a chave, internet e ao menos um contrato', () => {
    expect(existeContratosNaConta(true, true, [{}])).toBe(true);
    expect(existeContratosNaConta(false, true, [{}])).toBe(false);
    expect(existeContratosNaConta(true, false, [{}])).toBe(false);
    expect(existeContratosNaConta(true, true, [])).toBe(false);
    expect(existeContratosNaConta(true, true, null)).toBe(false);
  });

  it('a linha de cada contrato', () => {
    expect(resumoDoContratoNaConta({ situacao: 'ASSINADO', assinadoEm: '2026-11-27T01:00:00Z', prazoAte: null, vencido: false })).toBe('Assinado em 26/11/2026');
    expect(resumoDoContratoNaConta({ situacao: 'PENDENTE', assinadoEm: null, prazoAte: '2026-11-30T02:59:59Z', vencido: false })).toBe('Para assinar · até 29/11');
    expect(resumoDoContratoNaConta({ situacao: 'PENDENTE', assinadoEm: null, prazoAte: null, vencido: false })).toBe('Para assinar');
    expect(resumoDoContratoNaConta({ situacao: 'PENDENTE', assinadoEm: null, prazoAte: '2026-11-10T02:59:59Z', vencido: true })).toBe('Prazo terminou');
  });
});

describe('cpfMascarado', () => {
  it('mostra só os 6 dígitos do meio, com ou sem pontuação', () => {
    expect(cpfMascarado('123.456.789-09')).toBe('***.456.789-**');
    expect(cpfMascarado('12345678909')).toBe('***.456.789-**');
  });
  it('vazio é nulo; formato estranho não mostra nenhum dígito', () => {
    expect(cpfMascarado(null)).toBeNull();
    expect(cpfMascarado('  ')).toBeNull();
    expect(cpfMascarado('1234')).toBe('****');
  });
});

describe('seloDoPlano', () => {
  it('periodicidade e situação, no tom da situação; sem plano, nada', () => {
    expect(seloDoPlano({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA' })).toEqual({ texto: 'Trimestral · Ativo', tom: 'sucesso' });
    expect(seloDoPlano({ periodicidade: 'MENSAL', situacao: 'PAUSADA' })).toEqual({ texto: 'Mensal · Pausado', tom: 'atencao' });
    expect(seloDoPlano({ periodicidade: 'ANUAL', situacao: 'ENCERRADA' })).toEqual({ texto: 'Anual · Encerrado', tom: 'neutro' });
    expect(seloDoPlano({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', contratoFechado: true })).toEqual({ texto: 'Contrato · Ativo', tom: 'sucesso' });
    expect(seloDoPlano(null)).toBeNull();
  });
});

describe('resumos', () => {
  it('perfil na comunidade: o apelido, ou "Sem apelido"', () => {
    expect(resumoDoApelido('Testinho')).toBe('Testinho');
    expect(resumoDoApelido(' ')).toBe('Sem apelido');
    expect(resumoDoApelido(null)).toBe('Sem apelido');
  });
  it('dados: nome e telefone', () => {
    expect(resumoDosDados('Aluno Teste', '(45) 99999-8888')).toBe('Aluno Teste · (45) 99999-8888');
    expect(resumoDosDados('Aluno Teste', null)).toBe('Aluno Teste · Sem telefone');
  });
});

describe('envioDoMeuPerfil', () => {
  it('sem mexer, nada a mandar', () => {
    expect(envioDoMeuPerfil('Testinho', LIDO, SEM_EDICAO_DO_PERFIL)).toEqual({});
    expect(meuPerfilMudou('Testinho', LIDO, SEM_EDICAO_DO_PERFIL)).toBe(false);
  });
  it('apelido igual ao salvo (com espaços) não manda; vazio apaga; novo manda limpo', () => {
    expect(envioDoMeuPerfil('Testinho', LIDO, { apelido: ' Testinho ', perfil: {} })).toEqual({});
    expect(envioDoMeuPerfil('Testinho', LIDO, { apelido: '', perfil: {} })).toEqual({ apelido: null });
    expect(envioDoMeuPerfil(null, LIDO, { apelido: ' Novo ', perfil: {} })).toEqual({ apelido: 'Novo' });
  });
  it('perfil mudado manda o corpo completo; os dois juntos vão juntos', () => {
    expect(envioDoMeuPerfil(null, LIDO, { apelido: null, perfil: { cor: 'ROXO' } })).toEqual({
      perfil: { perfilReservado: false, destaques: ['A'], cor: 'ROXO', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' },
    });
    expect(Object.keys(envioDoMeuPerfil(null, LIDO, { apelido: 'Novo', perfil: { moldura: 'DUPLA' } }))).toEqual(['apelido', 'perfil']);
  });
});
