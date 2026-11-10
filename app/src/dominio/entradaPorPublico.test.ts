import { avisoDeEntradaErrada, entradaDoPublico, TEXTOS_DA_ENTRADA } from './entradaPorPublico';

describe('entrada por público', () => {
  it('cada papel tem a própria entrada', () => {
    expect(entradaDoPublico('ALUNO')).toBe('/aluno/entrar');
    expect(entradaDoPublico('TREINADOR')).toBe('/treinador/entrar');
  });

  it('o link da outra entrada aponta para a do outro público', () => {
    expect(TEXTOS_DA_ENTRADA.ALUNO.outra.href).toBe(entradaDoPublico('TREINADOR'));
    expect(TEXTOS_DA_ENTRADA.TREINADOR.outra.href).toBe(entradaDoPublico('ALUNO'));
  });

  it('o convite do aluno e o da equipe são telas diferentes', () => {
    expect(TEXTOS_DA_ENTRADA.ALUNO.convite.href).toBe('/convite');
    expect(TEXTOS_DA_ENTRADA.TREINADOR.convite.href).toBe('/convite-equipe');
  });

  it('só avisa quando o papel da conta não é o da entrada', () => {
    expect(avisoDeEntradaErrada('ALUNO', 'ALUNO')).toBeNull();
    expect(avisoDeEntradaErrada('TREINADOR', 'TREINADOR')).toBeNull();
    expect(avisoDeEntradaErrada('ALUNO', 'TREINADOR')).toBe('Sua conta é do painel da consultoria. Abrimos a área certa.');
    expect(avisoDeEntradaErrada('TREINADOR', 'ALUNO')).toBe('Sua conta é da área do aluno. Abrimos a área certa.');
  });
});
