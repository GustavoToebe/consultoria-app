import {
  avisoDoPlanoDoAluno,
  AVISO_DO_MODELO,
  mensagemCopiaCriada,
  rotuloEditarPlano,
  tituloDoModelo,
  tituloDoPlanoDoAluno,
} from './planoDoAluno';

describe('tituloDoPlanoDoAluno', () => {
  it('usa o nome do aluno', () => {
    expect(tituloDoPlanoDoAluno('treino', 'Ana Souza')).toBe('Treino de Ana Souza');
    expect(tituloDoPlanoDoAluno('dieta', 'Ana Souza')).toBe('Dieta de Ana Souza');
    expect(tituloDoPlanoDoAluno('mobilidade', 'Ana Souza')).toBe('Mobilidade de Ana Souza');
  });
  it('sem nome à mão, cai no genérico', () => {
    expect(tituloDoPlanoDoAluno('treino', null)).toBe('Treino do aluno');
    expect(tituloDoPlanoDoAluno('dieta', undefined)).toBe('Dieta do aluno');
    expect(tituloDoPlanoDoAluno('mobilidade', '   ')).toBe('Mobilidade do aluno');
  });
});

describe('avisos de plano do aluno e de modelo', () => {
  it('concorda o gênero e diz que o modelo não muda', () => {
    expect(avisoDoPlanoDoAluno('treino')).toBe('Este treino é só deste aluno. Mudar aqui não altera o modelo do Planejamento.');
    expect(avisoDoPlanoDoAluno('dieta')).toBe('Esta dieta é só deste aluno. Mudar aqui não altera o modelo do Planejamento.');
    expect(avisoDoPlanoDoAluno('mobilidade')).toBe('Esta mobilidade é só deste aluno. Mudar aqui não altera o modelo do Planejamento.');
  });
  it('o aviso do modelo fala das cópias já entregues', () => {
    expect(AVISO_DO_MODELO).toContain('não altera os alunos que já receberam uma cópia');
  });
});

describe('tituloDoModelo', () => {
  it('nomeia o tipo', () => {
    expect(tituloDoModelo('PLANO_TREINO')).toBe('Modelo: semana de treino');
    expect(tituloDoModelo('PLANO_DIETA')).toBe('Modelo: dieta');
    expect(tituloDoModelo('PASTA_PLANO')).toBe('Modelo: pacote de planos');
  });
});

describe('rotuloEditarPlano', () => {
  it('deixa claro que o que abre é o plano do aluno', () => {
    expect(rotuloEditarPlano('treino')).toBe('Editar treino do aluno');
    expect(rotuloEditarPlano('dieta')).toBe('Editar dieta do aluno');
    expect(rotuloEditarPlano('mobilidade')).toBe('Editar mobilidade do aluno');
  });
});

describe('mensagemCopiaCriada', () => {
  it('cita o aluno e diz que o modelo continua igual', () => {
    expect(mensagemCopiaCriada('Ana')).toBe('Cópia criada para Ana. O modelo continua igual.');
  });
  it('sem nome, fala "o aluno"', () => {
    expect(mensagemCopiaCriada(null)).toBe('Cópia criada para o aluno. O modelo continua igual.');
  });
});
