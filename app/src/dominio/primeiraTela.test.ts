import { primeiraTelaPermitida } from './primeiraTela';
import { TELAS, telasPermitidas } from './telas';

const com = (...codigos: string[]) => telasPermitidas((c) => codigos.includes(c));

describe('primeiraTelaPermitida', () => {
  it('sem o Início, vai para a primeira tela do menu que a pessoa abre', () => {
    expect(primeiraTelaPermitida(com('ALUNO_LER'))).toBe('/treinador/alunos');
    expect(primeiraTelaPermitida(com('BIBLIOTECA_LER'))).toBe('/treinador/biblioteca');
    expect(primeiraTelaPermitida(com('AGENDA_LER'))).toBe('/treinador/agenda');
  });

  it('perfil sem nenhuma tela de trabalho cai nas telas da conta/ajuda, nunca no Início', () => {
    const destino = primeiraTelaPermitida(com());
    expect(destino).toBe('/treinador/ajuda');
    expect(destino).not.toBe('/treinador');
  });

  it('não escolhe ação nem o Início, mesmo com a permissão dele', () => {
    expect(primeiraTelaPermitida(com('PAINEL_VER'))).toBe('/treinador/numeros');
    expect(primeiraTelaPermitida(TELAS.filter((t) => t.acao))).toBeNull();
    expect(primeiraTelaPermitida([])).toBeNull();
  });
});
