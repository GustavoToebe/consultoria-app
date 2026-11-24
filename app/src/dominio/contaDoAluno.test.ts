import {
  cpfMascarado, envioDoMeuPerfil, meuPerfilMudou, resumoDoPerfil, resumoDosDados, secoesVisiveis, seloDoPlano, SEM_EDICAO_DO_PERFIL,
} from './contaDoAluno';
import type { PreferenciasLidas } from './perfilDaComunidade';

const LIDO: PreferenciasLidas = { perfilReservado: false, reservadoEfetivo: false, destaques: ['A'], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' };

describe('secoesVisiveis', () => {
  it('na ordem do pedido, com Privacidade, Segurança e App sempre', () => {
    expect(secoesVisiveis({ plano: true, perfil: true, dados: true, convite: true }).map((s) => s.chave))
      .toEqual(['plano', 'perfil', 'dados', 'convite', 'privacidade', 'seguranca', 'app']);
    expect(secoesVisiveis({ plano: false, perfil: false, dados: false, convite: false }).map((s) => s.chave))
      .toEqual(['privacidade', 'seguranca', 'app']);
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
  it('perfil: apelido ou "—", plural dos destaques e reservado', () => {
    expect(resumoDoPerfil(null, 2, false)).toBe('Apelido: —, 2 destaques');
    expect(resumoDoPerfil('Testinho', 1, false)).toBe('Apelido: Testinho, 1 destaque');
    expect(resumoDoPerfil(' ', 0, false)).toBe('Apelido: —, sem destaques');
    expect(resumoDoPerfil('Testinho', 3, true)).toBe('Apelido: Testinho, perfil reservado');
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
