import {
  apelidoParaEnviar, COMENTARIO_MAXIMO, comentarioParaEnviar, comentariosDaPrimeiraPagina, comentariosQueFaltam, comComentarioEnviado,
  contadorDoComentario, erroDoComentario, juntarPaginaDeComentarios, MENSAGEM_COMENTARIO_LONGO, MENSAGEM_COMENTARIO_VAZIO,
  proximaPaginaDeComentarios, semOComentario, tamanhoDoComentario,
  curtidoPorMim, EMOJI_DA_CURTIDA, erroDoApelido, MENSAGEM_APELIDO_FORMATO, MENSAGEM_APELIDO_LINK, textoDaPosicao, totalDeCurtidas,
} from './comunidade';

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

describe('comentário do mural', () => {
  it('envia o texto sem os espaços das pontas; só espaço é nada', () => {
    expect(comentarioParaEnviar('  Boa, time!\n')).toBe('Boa, time!');
    expect(comentarioParaEnviar(' \n\t ')).toBeNull();
    expect(comentarioParaEnviar('')).toBeNull();
  });
  it('vazio pede o texto', () => {
    expect(erroDoComentario('   ')).toBe(MENSAGEM_COMENTARIO_VAZIO);
    expect(erroDoComentario('Oi')).toBeNull();
  });
  it('conta em UTF-16 depois do strip: 280 passa, 281 não', () => {
    expect(COMENTARIO_MAXIMO).toBe(280);
    expect(MENSAGEM_COMENTARIO_LONGO).toBe('Use até 280 caracteres.');
    expect(erroDoComentario(`  ${'a'.repeat(280)}  `)).toBeNull();
    expect(erroDoComentario('a'.repeat(281))).toBe(MENSAGEM_COMENTARIO_LONGO);
    // Igual à API: um emoji conta 2, então 140 emojis cabem; 279 letras e um emoji (281) não.
    expect(tamanhoDoComentario('💪'.repeat(140))).toBe(280);
    expect(erroDoComentario('💪'.repeat(140))).toBeNull();
    expect(erroDoComentario('💪'.repeat(141))).toBe(MENSAGEM_COMENTARIO_LONGO);
    expect(erroDoComentario(`${'a'.repeat(279)}💪`)).toBe(MENSAGEM_COMENTARIO_LONGO);
    expect(erroDoComentario(`${'a'.repeat(278)}💪`)).toBeNull();
  });
});

describe('contador do comentário', () => {
  it('some vazio, mostra o número ao digitar e avisa em texto perto e acima do limite', () => {
    expect(contadorDoComentario('   ')).toBeNull();
    expect(contadorDoComentario('Oi')).toEqual({ texto: '2/280', rotuloAcessivel: '2 de 280 caracteres', tom: 'normal' });
    expect(contadorDoComentario('a'.repeat(259))?.tom).toBe('normal');
    expect(contadorDoComentario('a'.repeat(260))).toEqual({ texto: '260/280 · faltam 20', rotuloAcessivel: '260 de 280 caracteres, faltam 20', tom: 'atencao' });
    expect(contadorDoComentario('a'.repeat(280))).toEqual({ texto: '280/280 · no limite', rotuloAcessivel: '280 de 280 caracteres, no limite', tom: 'atencao' });
    expect(contadorDoComentario(`${'a'.repeat(279)}💪`)).toEqual({ texto: '281/280 · 1 a mais', rotuloAcessivel: '281 de 280 caracteres, 1 a mais', tom: 'perigo' });
  });
});

describe('páginas de comentários', () => {
  const c = (n: number) => ({ id: `c${n}` });
  const faixa = (de: number, ate: number) => Array.from({ length: ate - de }, (_, i) => c(de + i));

  it('junta a próxima página sem perder nem repetir', () => {
    let lidos = comentariosDaPrimeiraPagina({ itens: faixa(0, 30), total: 35 });
    expect(comentariosQueFaltam(lidos)).toBe(5);
    expect(proximaPaginaDeComentarios(lidos)).toBe(1);
    lidos = juntarPaginaDeComentarios(lidos, { itens: faixa(30, 35), total: 35 });
    expect(lidos.itens.map((i) => i.id)).toEqual(faixa(0, 35).map((i) => i.id));
    expect(comentariosQueFaltam(lidos)).toBe(0);
  });

  it('depois de uma remoção pede a página que ainda contém o próximo (não pula ninguém)', () => {
    let lidos = comentariosDaPrimeiraPagina({ itens: faixa(0, 30), total: 35 });
    lidos = semOComentario(lidos, 'c3');
    expect(lidos.total).toBe(34);
    // A API andou uma posição: a página 0 agora termina em c30.
    expect(proximaPaginaDeComentarios(lidos)).toBe(0);
    lidos = juntarPaginaDeComentarios(lidos, { itens: faixa(0, 31).filter((i) => i.id !== 'c3'), total: 34 });
    expect(lidos.itens.at(-1)?.id).toBe('c30');
    expect(proximaPaginaDeComentarios(lidos)).toBe(1);
    lidos = juntarPaginaDeComentarios(lidos, { itens: faixa(31, 35), total: 34 });
    expect(lidos.itens).toHaveLength(34);
    expect(new Set(lidos.itens.map((i) => i.id)).size).toBe(34);
    expect(comentariosQueFaltam(lidos)).toBe(0);
  });

  it('comentário enviado com tudo lido entra no fim; com páginas faltando, vai para os enviados e é absorvido depois', () => {
    const completo = comComentarioEnviado(comentariosDaPrimeiraPagina({ itens: faixa(0, 2), total: 2 }), c(99));
    expect(completo).toEqual({ itens: [c(0), c(1), c(99)], enviados: [], total: 3 });

    let lidos = comComentarioEnviado(comentariosDaPrimeiraPagina({ itens: faixa(0, 30), total: 31 }), c(99));
    expect(lidos.enviados).toEqual([c(99)]);
    expect(lidos.total).toBe(32);
    expect(comentariosQueFaltam(lidos)).toBe(1);
    lidos = juntarPaginaDeComentarios(lidos, { itens: [c(30), c(99)], total: 32 });
    expect(lidos.itens.slice(-2)).toEqual([c(30), c(99)]);
    expect(lidos.enviados).toEqual([]);
    expect(comentariosQueFaltam(lidos)).toBe(0);
    // Reenviar o mesmo id não duplica.
    expect(comComentarioEnviado(lidos, c(99))).toBe(lidos);
  });

  it('página sem nada novo encerra o "Carregar mais"; remover o que não está na tela não mexe no total', () => {
    const lidos = comentariosDaPrimeiraPagina({ itens: faixa(0, 30), total: 40 });
    expect(comentariosQueFaltam(juntarPaginaDeComentarios(lidos, { itens: [], total: 40 }))).toBe(0);
    expect(semOComentario(lidos, 'outro')).toBe(lidos);
  });
});
