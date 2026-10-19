import { GUIAS } from '../ajuda/conteudo';
import {
  andamentoDoPasseio,
  chavePasseio,
  deveMostrarPasseio,
  larguraDoBalao,
  lembretePodeAbrir,
  passosVisiveis,
  posicaoDoBalao,
  recorteDoDestaque,
  situacaoDoPasseio,
} from './passeio';

describe('passeio pelo menu: quando mostrar', () => {
  it('a chave é por usuário', () => {
    expect(chavePasseio('u1')).toBe('treinos:u1:passeioVisto');
    expect(chavePasseio('u1')).not.toBe(chavePasseio('u2'));
  });

  it('mostra só quando a leitura terminou e a marca não existe', () => {
    expect(deveMostrarPasseio('lendo', 3)).toBe(false);
    expect(deveMostrarPasseio({ valor: null }, 3)).toBe(true);
    expect(deveMostrarPasseio({ valor: '1' }, 3)).toBe(false);
  });

  it('falha ao ler ou ausência de passos não mostra nada', () => {
    expect(deveMostrarPasseio('falhou', 3)).toBe(false);
    expect(deveMostrarPasseio({ valor: null }, 0)).toBe(false);
  });

  it('a situação vai de lendo a aberta ou encerrada, sem passar por "encerrada" antes de ler', () => {
    expect(situacaoDoPasseio('lendo', false, 3)).toBe('lendo');
    expect(situacaoDoPasseio({ valor: null }, false, 3)).toBe('aberta');
    expect(situacaoDoPasseio({ valor: null }, true, 3)).toBe('encerrada'); // pulou, fechou ou chegou ao fim
    expect(situacaoDoPasseio({ valor: '1' }, false, 3)).toBe('encerrada');
    expect(situacaoDoPasseio('falhou', false, 3)).toBe('encerrada');
    expect(situacaoDoPasseio({ valor: null }, false, 0)).toBe('encerrada');
  });

  it('rever na Ajuda abre mesmo com a marca ou com a leitura falha', () => {
    expect(situacaoDoPasseio({ valor: '1' }, true, 3, true)).toBe('aberta');
    expect(situacaoDoPasseio('falhou', false, 3, true)).toBe('aberta');
    expect(situacaoDoPasseio({ valor: '1' }, true, 0, true)).toBe('encerrada');
  });

  it('o lembrete da atualização espera o passeio: só abre quando ele está encerrado', () => {
    expect(lembretePodeAbrir('lendo')).toBe(false);
    expect(lembretePodeAbrir('aberta')).toBe(false);
    expect(lembretePodeAbrir('encerrada')).toBe(true);
  });
});

describe('passeio pelo menu: passos', () => {
  const passos = [{ titulo: 'Oi', texto: '' }, { titulo: 'Alunos', texto: '', alvo: 'menu:/a' }, { titulo: 'Equipe', texto: '', alvo: 'menu:/e' }];

  it('pula o item que não está na tela (sem permissão ou fora desta largura); passo sem alvo sempre fica', () => {
    expect(passosVisiveis(passos, new Set(['menu:/a'])).map((p) => p.titulo)).toEqual(['Oi', 'Alunos']);
    expect(passosVisiveis(passos, new Set()).map((p) => p.titulo)).toEqual(['Oi']);
  });

  it('anda pelos passos e o último vira "Começar"; índice fora da faixa é limitado', () => {
    expect(andamentoDoPasseio(0, 3)).toEqual({ indice: 0, primeiro: true, ultimo: false, rotuloProximo: 'Próximo', progresso: '1 de 3' });
    expect(andamentoDoPasseio(2, 3)).toEqual({ indice: 2, primeiro: false, ultimo: true, rotuloProximo: 'Começar', progresso: '3 de 3' });
    expect(andamentoDoPasseio(9, 3).indice).toBe(2);
    expect(andamentoDoPasseio(-1, 3).indice).toBe(0);
  });

  it('todo alvo dos guias aponta para um item de menu e todo passo tem texto', () => {
    for (const guia of Object.values(GUIAS)) {
      expect(guia.passeio.length).toBeGreaterThan(2);
      for (const p of guia.passeio) {
        expect(p.texto.length).toBeGreaterThan(10);
        if (p.alvo) expect(p.alvo).toMatch(/^menu:\//);
      }
    }
  });
});

describe('passeio pelo menu: onde fica o balão', () => {
  const area = { largura: 1280, altura: 800 };
  const balao = { largura: 340, altura: 160 };

  it('item do menu lateral: balão à direita, na altura do item', () => {
    const p = posicaoDoBalao({ x: 12, y: 200, largura: 216, altura: 44 }, area, balao);
    expect(p.lado).toBe('direita');
    expect(p.x).toBe(12 + 216 + 12);
    expect(p.y).toBe(200 + 22 - 80);
  });

  it('barra de baixo do celular: balão acima, dentro da tela', () => {
    const celular = { largura: 390, altura: 800 };
    const b = { largura: larguraDoBalao(celular), altura: 160 };
    expect(b.largura).toBe(340);
    const ultimoItem = posicaoDoBalao({ x: 312, y: 740, largura: 78, altura: 56 }, celular, b);
    expect(ultimoItem.lado).toBe('acima');
    expect(ultimoItem.y).toBe(740 - 12 - 160);
    expect(ultimoItem.x).toBe(390 - 340 - 12); // não passa da borda direita
    const primeiro = posicaoDoBalao({ x: 0, y: 740, largura: 78, altura: 56 }, celular, b);
    expect(primeiro.x).toBe(12);
  });

  it('sem espaço acima vai para baixo; sem alvo fica no meio', () => {
    expect(posicaoDoBalao({ x: 600, y: 20, largura: 100, altura: 40 }, area, balao).lado).toBe('abaixo');
    expect(posicaoDoBalao(null, area, balao)).toEqual({ x: 470, y: 320, lado: 'centro' });
  });

  it('celular muito estreito: o balão encolhe para caber com margem', () => {
    expect(larguraDoBalao({ largura: 320, altura: 600 })).toBe(296);
  });

  it('o destaque tem folga e não sai da tela', () => {
    expect(recorteDoDestaque({ x: 0, y: 740, largura: 78, altura: 60 }, { largura: 390, altura: 800 })).toEqual({ x: 0, y: 736, largura: 82, altura: 64 });
  });
});
