import type { ItemDeAtividade } from '../api/tipos';
import {
  ABAS_DA_FICHA, abaDaUrl, abaParaEditar, abaParaPasta, abasVisiveis, avisoDeLesoes, blocosDaAba, blocoVisivel, destinoDoEvento,
  mostraMobilidade, textoDoEvento, ultimoPeso, type ContextoDaFicha,
} from './fichaDoAluno';

const contexto = (permissoes: string[], extra: Partial<Omit<ContextoDaFicha, 'pode'>> = {}): ContextoDaFicha => ({
  pode: (c) => permissoes.includes(c), pagamentosHabilitados: false, retornoHabilitado: false, ...extra,
});
const TUDO = ['ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER', 'REGISTRO_LER', 'TREINO_LER', 'ANAMNESE_LER', 'FINANCEIRO_LER'];

describe('abas da ficha', () => {
  it('as cinco abas, na ordem, com rótulo', () => {
    expect(ABAS_DA_FICHA.map((a) => a.valor)).toEqual(['resumo', 'planos', 'acompanhamento', 'evolucao', 'ficha']);
    expect(ABAS_DA_FICHA.map((a) => a.rotulo)).toEqual(['Resumo', 'Planos', 'Acompanhamento', 'Evolução', 'Ficha do aluno']);
  });

  it('só com ALUNO_LER: Resumo, Planos e Ficha (Acompanhamento e Evolução somem sem bloco permitido)', () => {
    expect(abasVisiveis(contexto(['ALUNO_LER']))).toEqual(['resumo', 'planos', 'ficha']);
  });

  it('REGISTRO_LER abre Acompanhamento e Evolução (frequência e progresso)', () => {
    const c = contexto(['ALUNO_LER', 'REGISTRO_LER']);
    expect(abasVisiveis(c)).toEqual(['resumo', 'planos', 'acompanhamento', 'evolucao', 'ficha']);
    expect(blocosDaAba('acompanhamento', c)).toEqual(['frequencia']);
    expect(blocosDaAba('evolucao', c)).toEqual(['progresso']);
  });

  it('ALUNO_SENSIVEL_LER sozinho abre Evolução (peso e avaliação física), mas não Acompanhamento', () => {
    const c = contexto(['ALUNO_LER', 'ALUNO_SENSIVEL_LER']);
    expect(abasVisiveis(c)).toEqual(['resumo', 'planos', 'evolucao', 'ficha']);
    expect(blocosDaAba('evolucao', c)).toEqual(['peso', 'avaliacaoFisica']);
  });

  it('evolução das respostas (Acompanhamento) pede ATUALIZACAO_LER e ALUNO_SENSIVEL_LER; as fotos (Evolução), as mesmas', () => {
    const c = contexto(['ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER']);
    expect(abasVisiveis(c)).toContain('acompanhamento');
    expect(blocosDaAba('acompanhamento', c)).toEqual(['evolucaoDasRespostas']);
    expect(blocoVisivel('fotos', c)).toBe(true);
    expect(blocoVisivel('fotos', contexto(['ALUNO_LER', 'ATUALIZACAO_LER']))).toBe(false);
  });

  it('a linha da mobilidade (dentro do resumo de frequência) e a água pedem TREINO_LER e ALUNO_SENSIVEL_LER além de REGISTRO_LER', () => {
    expect(mostraMobilidade(contexto(['REGISTRO_LER']))).toBe(false);
    expect(mostraMobilidade(contexto(['REGISTRO_LER', 'TREINO_LER']))).toBe(true);
    expect(mostraMobilidade(contexto(['TREINO_LER']))).toBe(false);
    expect(blocoVisivel('agua', contexto(['REGISTRO_LER']))).toBe(false);
    expect(blocoVisivel('agua', contexto(['REGISTRO_LER', 'ALUNO_SENSIVEL_LER']))).toBe(true);
  });

  it('treinos concluídos e recordes da semana só com o retorno habilitado e REGISTRO_LER', () => {
    expect(blocoVisivel('treinosConcluidos', contexto(['REGISTRO_LER']))).toBe(false);
    expect(blocoVisivel('treinosConcluidos', contexto(['REGISTRO_LER'], { retornoHabilitado: true }))).toBe(true);
    expect(blocoVisivel('recordesDaSemana', contexto([], { retornoHabilitado: true }))).toBe(false);
    expect(blocoVisivel('recordesDaSemana', contexto(['REGISTRO_LER'], { retornoHabilitado: true }))).toBe(true);
  });

  it('plano contratado pede o financeiro ligado e FINANCEIRO_LER; anamnese e lesões, as sensíveis; a Ficha nunca some', () => {
    expect(blocoVisivel('planoContratado', contexto(['FINANCEIRO_LER']))).toBe(false);
    expect(blocoVisivel('planoContratado', contexto([], { pagamentosHabilitados: true }))).toBe(false);
    expect(blocoVisivel('planoContratado', contexto(['FINANCEIRO_LER'], { pagamentosHabilitados: true }))).toBe(true);
    expect(blocoVisivel('anamnese', contexto(['ANAMNESE_LER']))).toBe(false);
    expect(blocoVisivel('anamnese', contexto(['ANAMNESE_LER', 'ALUNO_SENSIVEL_LER']))).toBe(true);
    expect(blocoVisivel('lesoes', contexto([]))).toBe(false);
    expect(blocoVisivel('lesoes', contexto(['ALUNO_SENSIVEL_LER']))).toBe(true);
    expect(blocosDaAba('ficha', contexto([]))).toEqual(['dadosDoAluno', 'acessoAoApp']);
    expect(abasVisiveis(contexto([]))).toEqual(['resumo', 'planos', 'ficha']);
  });

  it('com tudo liberado as cinco abas aparecem e cada bloco cai na aba da decisão 1', () => {
    const c = contexto(TUDO, { pagamentosHabilitados: true, retornoHabilitado: true });
    expect(abasVisiveis(c)).toEqual(['resumo', 'planos', 'acompanhamento', 'evolucao', 'ficha']);
    expect(blocosDaAba('planos', c)).toEqual(['pastas']);
    expect(blocosDaAba('acompanhamento', c)).toEqual(['frequencia', 'agua','treinosConcluidos', 'recordesDaSemana', 'evolucaoDasRespostas']);
    expect(blocosDaAba('evolucao', c)).toEqual(['peso', 'progresso', 'avaliacaoFisica', 'fotos']);
    expect(blocosDaAba('ficha', c)).toEqual(['dadosDoAluno', 'acessoAoApp', 'planoContratado', 'anamnese', 'lesoes']);
  });
});

describe('endereço da ficha', () => {
  it('?aba= valor válido abre a aba; inválido, de lista ou ausente abre o Resumo', () => {
    expect(abaDaUrl('evolucao')).toBe('evolucao');
    expect(abaDaUrl('ficha')).toBe('ficha');
    expect(abaDaUrl('qualquer')).toBe('resumo');
    expect(abaDaUrl('')).toBe('resumo');
    expect(abaDaUrl(undefined)).toBe('resumo');
    expect(abaDaUrl(['planos', 'ficha'])).toBe('planos');
    expect(abaDaUrl([])).toBe('resumo');
  });

  it('com as abas permitidas, aba que o perfil não vê abre o Resumo', () => {
    const permitidas = abasVisiveis(contexto(['ALUNO_LER']));
    expect(abaDaUrl('evolucao', permitidas)).toBe('resumo');
    expect(abaDaUrl('planos', permitidas)).toBe('planos');
  });

  it('?pastaId= leva aos Planos e ?editar=1 à Ficha; o resto não diz nada', () => {
    expect(abaParaPasta('p1')).toBe('planos');
    expect(abaParaPasta(['p1'])).toBe('planos');
    expect(abaParaPasta('')).toBeNull();
    expect(abaParaPasta(undefined)).toBeNull();
    expect(abaParaEditar('1')).toBe('ficha');
    expect(abaParaEditar(['1'])).toBe('ficha');
    expect(abaParaEditar('0')).toBeNull();
    expect(abaParaEditar('true')).toBeNull();
    expect(abaParaEditar(undefined)).toBeNull();
  });
});

describe('atividade recente', () => {
  const item = (parcial: Partial<ItemDeAtividade>): ItemDeAtividade =>
    ({ tipo: 'TREINO_CONCLUIDO', titulo: 'Treino concluído', quando: '2026-11-10T12:00:00Z', destino: null, ...parcial });

  it('o texto é o título fixo da API; sem título, o do tipo; tipo novo ganha um genérico', () => {
    expect(textoDoEvento(item({ tipo: 'PLANO_PUBLICADO', titulo: 'Dieta publicada' }))).toBe('Dieta publicada');
    expect(textoDoEvento(item({ tipo: 'PESO_REGISTRADO', titulo: '  ' }))).toBe('Peso registrado');
    expect(textoDoEvento(item({ tipo: 'OUTRO' as ItemDeAtividade['tipo'], titulo: '' }))).toBe('Atividade registrada');
  });

  it('o destino da atualização é a rota dela (id codificado) e o da pasta abre a Folha da própria ficha', () => {
    expect(destinoDoEvento(item({ destino: { tipo: 'ATUALIZACAO', id: 'a1' } }))).toEqual({ tipo: 'rota', href: '/treinador/atualizacoes/a1' });
    expect(destinoDoEvento(item({ destino: { tipo: 'ATUALIZACAO', id: '../x' } }))).toEqual({ tipo: 'rota', href: '/treinador/atualizacoes/..%2Fx' });
    expect(destinoDoEvento(item({ destino: { tipo: 'PASTA', id: 'p1' } }))).toEqual({ tipo: 'pasta', pastaId: 'p1' });
  });

  it('sem destino, ou destino desconhecido ou sem id, não há tela: nulo', () => {
    expect(destinoDoEvento(item({}))).toBeNull();
    expect(destinoDoEvento(item({ destino: { tipo: 'ATUALIZACAO', id: '' } }))).toBeNull();
    expect(destinoDoEvento(item({ destino: { tipo: 'FUTURO' as 'PASTA', id: 'x' } }))).toBeNull();
  });
});

describe('aviso de lesões', () => {
  const lesao = (situacao: 'ATIVA' | 'EM_RECUPERACAO' | 'RECUPERADA' | null) => ({ situacao });

  it('sem ALUNO_SENSIVEL_LER ou sem lesões: nada', () => {
    expect(avisoDeLesoes([lesao('ATIVA')], false)).toBeNull();
    expect(avisoDeLesoes([], true)).toBeNull();
  });

  it('com situação em todas, conta só as que não estão recuperadas e diz "ativas"', () => {
    expect(avisoDeLesoes([lesao('ATIVA'), lesao('EM_RECUPERACAO'), lesao('RECUPERADA')], true)).toBe('2 lesões ativas');
    expect(avisoDeLesoes([lesao('ATIVA'), lesao('RECUPERADA')], true)).toBe('1 lesão ativa');
  });

  it('todas recuperadas: nenhum aviso', () => {
    expect(avisoDeLesoes([lesao('RECUPERADA'), lesao('RECUPERADA')], true)).toBeNull();
  });

  it('sem situação (ou só em parte): "registradas", sem presumir que continuam ativas', () => {
    expect(avisoDeLesoes([lesao(null), lesao(null)], true)).toBe('2 lesões registradas');
    expect(avisoDeLesoes([lesao('RECUPERADA'), lesao(null)], true)).toBe('2 lesões registradas');
    expect(avisoDeLesoes([lesao(null)], true)).toBe('1 lesão registrada');
  });

  it('nunca vaza o texto da lesão', () => {
    const comTexto = [{ situacao: 'ATIVA' as const, regiao: 'Ombro direito', descricao: 'Dor fictícia', observacao: 'Obs fictícia' }];
    expect(avisoDeLesoes(comTexto, true)).toBe('1 lesão ativa');
  });
});

describe('último peso', () => {
  it('pega a data mais recente, em qualquer ordem, e null sem registros', () => {
    expect(ultimoPeso([])).toBeNull();
    expect(ultimoPeso([{ data: '2026-10-01', pesoKg: 80 }, { data: '2026-11-02', pesoKg: 79 }, { data: '2026-10-20', pesoKg: 79.5 }]))
      .toEqual({ data: '2026-11-02', pesoKg: 79 });
  });
});
