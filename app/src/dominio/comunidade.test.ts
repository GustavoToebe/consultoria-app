import { apelidoParaEnviar, curtidoPorMim, EMOJI_DA_CURTIDA, erroDoApelido, MENSAGEM_APELIDO_FORMATO, MENSAGEM_APELIDO_LINK, textoDaPosicao, totalDeCurtidas } from './comunidade';

describe('curtida do mural', () => {
  it('conta só a curtida e ignora as outras reações', () => {
    expect(totalDeCurtidas({ reacoes: { [EMOJI_DA_CURTIDA]: 3, '🔥': 9 } })).toBe(3);
    expect(totalDeCurtidas({ reacoes: { '🔥': 9 } })).toBe(0);
    expect(totalDeCurtidas({ reacoes: {} })).toBe(0);
  });
  it('sabe se a curtida é minha', () => {
    expect(curtidoPorMim({ minhasReacoes: ['🔥', EMOJI_DA_CURTIDA] })).toBe(true);
    expect(curtidoPorMim({ minhasReacoes: ['🔥'] })).toBe(false);
  });
});

describe('textoDaPosicao', () => {
  it('concorda o plural', () => {
    expect(textoDaPosicao(3, 12)).toBe('3º de 12 participantes');
    expect(textoDaPosicao(1, 1)).toBe('1º de 1 participante');
  });
});

describe('apelido da comunidade', () => {
  it('vazio apaga e passa', () => {
    expect(apelidoParaEnviar('   ')).toBeNull();
    expect(erroDoApelido('')).toBeNull();
  });
  it('aceita letras com acento, números, espaço e _ . - entre 2 e 24', () => {
    for (const ok of ['Aninha', 'João_99', 'Zé', 'A.B-C d', 'ç'.repeat(24)]) expect(erroDoApelido(ok)).toBeNull();
    expect(apelidoParaEnviar('  Aninha ')).toBe('Aninha');
  });
  it('recusa curto, longo e símbolo', () => {
    for (const ruim of ['a', 'x'.repeat(25), 'ana@x', 'oi!', 'a/b', '😀😀', '...', '_-', 'a\u3164b']) expect(erroDoApelido(ruim)).toBe(MENSAGEM_APELIDO_FORMATO);
  });
  it('recusa os preenchimentos invisíveis do Hangul e o que não tem letra nem número (igual à API)', () => {
    for (const ruim of ['aᅟb', 'aᅠb', 'aﾠb', 'ㅤㅤ', '..', '--', '_.']) expect(erroDoApelido(ruim)).toBe(MENSAGEM_APELIDO_FORMATO);
  });
  it('conta depois do NFC, por caractere (igual à API)', () => {
    expect(erroDoApelido('é'.repeat(24))).toBeNull(); // 24 "é" decompostos
    expect(erroDoApelido('é'.repeat(25))).toBe(MENSAGEM_APELIDO_FORMATO);
    expect(erroDoApelido('Zé')).toBeNull();
  });
  it('recusa link', () => {
    for (const link of ['www.ana', 'httpana', 'site.com', 'loja.BR', 'meu.gg', 'ｗｗｗ.ana', 'ana.co', '𝐰𝐰𝐰.x.𝐜𝐨𝐦']) expect(erroDoApelido(link)).toBe(MENSAGEM_APELIDO_LINK);
    expect(erroDoApelido('ana.costa')).toBeNull();
  });
});
