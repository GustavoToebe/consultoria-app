import {
  apelidoParaEnviar, COMENTARIO_MAXIMO, comentarioParaEnviar, comentariosDaPrimeiraPagina, comentariosQueFaltam, comComentarioEnviado,
  contadorDoComentario, erroDoComentario, juntarPaginaDeComentarios, MENSAGEM_COMENTARIO_LONGO, MENSAGEM_COMENTARIO_VAZIO,
  proximaPaginaDeComentarios, semOComentario, tamanhoDoComentario,
  curtidoPorMim, EMOJI_DA_CURTIDA, erroDoApelido, MENSAGEM_APELIDO_FORMATO, MENSAGEM_APELIDO_LINK, textoDaPosicao, totalDeCurtidas,
  errosDoPost, MOTIVOS_DE_DENUNCIA, podeAnexarFoto, podePublicar, postParaEnviar, rotuloDoMotivo, rotuloDoTipo, TIPOS_DE_POST,
  tiposParaEscolher, filtrosDoMural, filtrosParaApi, textoDoMuralVazio, textoDasDenuncias, tipoPedido,
  agruparAuloesPorCategoria, buscarAuloes, categoriasDosAuloes, corpoDaAula, errosDaAula, filtrarAuloesPorCategoria,
  filtroDeCategoriaValido, opcoesDoFiltroDeCategoria, RASCUNHO_DA_AULA_VAZIO, rascunhoDaAula, resumoDosAuloes,
} from './comunidade';
import type { AulaDaComunidade } from '../api/comunidadeTipos';

const aula = (id: string, categoria: string | null, extra: Partial<AulaDaComunidade> = {}): AulaDaComunidade => ({
  id, titulo: `Aula ${id}`, descricao: null, videoUrl: 'https://exemplo.com/v', miniaturaUrl: null, categoria,
  ordem: 0, publicada: true, criadaEm: '2026-11-01T10:00:00Z', totalComentarios: 0, ...extra,
});

describe('aulões', () => {
  const aulas = [aula('1', 'Técnica'), aula('2', null), aula('3', 'alimentação'), aula('4', 'Técnica'), aula('5', '  ')];

  it('agrupa em ordem alfabética pt-BR, com Sem categoria por último e a ordem da API dentro de cada uma', () => {
    const grupos = agruparAuloesPorCategoria(aulas);
    expect(grupos.map((g) => g.rotulo)).toEqual(['alimentação', 'Técnica', 'Sem categoria']);
    expect(grupos[1].itens.map((a) => a.id)).toEqual(['1', '4']);
    expect(grupos[2].itens.map((a) => a.id)).toEqual(['2', '5']);
    expect(agruparAuloesPorCategoria([aula('1', 'B')]).map((g) => g.rotulo)).toEqual(['B']);
  });

  it('filtra por todas, sem categoria e por uma categoria', () => {
    expect(filtrarAuloesPorCategoria(aulas, null)).toHaveLength(5);
    expect(filtrarAuloesPorCategoria(aulas, '').map((a) => a.id)).toEqual(['2', '5']);
    expect(filtrarAuloesPorCategoria(aulas, 'Técnica').map((a) => a.id)).toEqual(['1', '4']);
    expect(categoriasDosAuloes(aulas)).toEqual(['alimentação', 'Técnica']);
  });

  it('monta os chips com contagem e volta a Todas quando a categoria some', () => {
    expect(opcoesDoFiltroDeCategoria(aulas)).toEqual([
      { valor: null, rotulo: 'Todas', contagem: 5 },
      { valor: 'alimentação', rotulo: 'alimentação', contagem: 1 },
      { valor: 'Técnica', rotulo: 'Técnica', contagem: 2 },
      { valor: '', rotulo: 'Sem categoria', contagem: 2 },
    ]);
    expect(opcoesDoFiltroDeCategoria([aula('1', 'A')]).map((o) => o.valor)).toEqual([null, 'A']);
    expect(filtroDeCategoriaValido('Técnica', aulas)).toBe('Técnica');
    expect(filtroDeCategoriaValido('Sumiu', aulas)).toBeNull();
    expect(filtroDeCategoriaValido('', [aula('1', 'A')])).toBeNull();
  });

  it('busca no título e na descrição sem acento nem caixa', () => {
    const lista = [aula('1', null, { titulo: 'Técnica do agachamento' }), aula('2', null, { descricao: 'Pauta: PROTEÍNA' })];
    expect(buscarAuloes(lista, 'tecnica').map((a) => a.id)).toEqual(['1']);
    expect(buscarAuloes(lista, 'proteina').map((a) => a.id)).toEqual(['2']);
    expect(buscarAuloes(lista, '  ')).toHaveLength(2);
  });

  it('valida título e link', () => {
    expect(errosDaAula(RASCUNHO_DA_AULA_VAZIO)).toEqual({ titulo: 'Escreva o título.', link: 'Cole o link do vídeo.' });
    expect(errosDaAula({ ...RASCUNHO_DA_AULA_VAZIO, titulo: 'X', link: 'http://exemplo.com' }).link).not.toBeNull();
    expect(errosDaAula({ ...RASCUNHO_DA_AULA_VAZIO, titulo: 'X', link: 'https://exemplo.com/v' })).toEqual({ titulo: null, link: null });
  });

  it('cria só com o que foi preenchido e edita reenviando os sete campos', () => {
    const r = { titulo: ' Novo ', link: 'https://exemplo.com/v', categoria: ' Técnica  de base ', descricao: '' };
    expect(corpoDaAula(r)).toEqual({ titulo: 'Novo', descricao: undefined, videoUrl: 'https://exemplo.com/v', categoria: 'Técnica de base' });
    const original = aula('9', 'Antiga', { publicada: false, ordem: 3, miniaturaUrl: 'https://exemplo.com/m.jpg', descricao: 'Velha' });
    expect(rascunhoDaAula(original)).toEqual({ titulo: 'Aula 9', link: 'https://exemplo.com/v', categoria: 'Antiga', descricao: 'Velha' });
    expect(corpoDaAula({ ...rascunhoDaAula(original), categoria: '', descricao: '' }, original)).toEqual({
      titulo: 'Aula 9', descricao: null, videoUrl: 'https://exemplo.com/v', miniaturaUrl: 'https://exemplo.com/m.jpg',
      categoria: null, ordem: 3, publicada: false,
    });
  });

  it('resume a quantidade', () => {
    expect(resumoDosAuloes(1)).toBe('1 aulão');
    expect(resumoDosAuloes(3)).toBe('3 aulões');
  });
});

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

describe('tipos de publicação', () => {
  it('lista os cinco tipos com rótulo em português', () => {
    expect(TIPOS_DE_POST.map((t) => t.tipo)).toEqual(['AVISO', 'VIDEO', 'DUVIDA', 'RESULTADO', 'CONVERSA']);
    expect(rotuloDoTipo('DUVIDA')).toBe('Dúvida');
  });
  it('o aluno escolhe só conversa, dúvida e resultado; a equipe, todos', () => {
    expect(tiposParaEscolher('aluno').map((t) => t.tipo)).toEqual(['DUVIDA', 'RESULTADO', 'CONVERSA']);
    expect(tiposParaEscolher('equipe')).toHaveLength(5);
  });
});

describe('validação da publicação', () => {
  it('conversa com texto passa; texto em branco ou longo demais não', () => {
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'Bom treino, time!' }, 'aluno')).toEqual({});
    expect(errosDoPost({ tipo: 'CONVERSA', texto: '   ' }, 'aluno').texto).toBeTruthy();
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'a'.repeat(2000) }, 'aluno')).toEqual({});
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'a'.repeat(2001) }, 'aluno').texto).toBeTruthy();
  });
  it('aluno não publica aviso nem vídeo', () => {
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x' }, 'aluno').tipo).toBeTruthy();
    expect(errosDoPost({ tipo: 'VIDEO', texto: 'x', videoUrl: 'https://youtu.be/abc' }, 'aluno').tipo).toBeTruthy();
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x' }, 'equipe')).toEqual({});
  });
  it('vídeo exige link https e só ele leva link', () => {
    expect(errosDoPost({ tipo: 'VIDEO', texto: 'Aula', videoUrl: '' }, 'equipe').videoUrl).toBeTruthy();
    expect(errosDoPost({ tipo: 'VIDEO', texto: 'Aula', videoUrl: 'http://youtu.be/abc' }, 'equipe').videoUrl).toBeTruthy();
    expect(errosDoPost({ tipo: 'VIDEO', texto: 'Aula', videoUrl: 'https://youtu.be/abc' }, 'equipe')).toEqual({});
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x', videoUrl: 'https://youtu.be/abc' }, 'equipe').videoUrl).toBeTruthy();
  });
  it('foto: de 1 a 4 sem repetir, e só do aluno', () => {
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'b', 'c', 'd'] }, 'aluno')).toEqual({});
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'b', 'c', 'd', 'e'] }, 'aluno').fotoIds).toBeTruthy();
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'a'] }, 'aluno').fotoIds).toBeTruthy();
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'x', fotoIds: ['a'] }, 'equipe').fotoIds).toBeTruthy();
  });
  it('o corpo do envio tem strip e só leva link e fotos quando valem', () => {
    expect(postParaEnviar({ tipo: 'CONVERSA', texto: '  oi  ', videoUrl: 'https://x.com/a', fotoIds: [] })).toEqual({ tipo: 'CONVERSA', texto: 'oi' });
    expect(postParaEnviar({ tipo: 'VIDEO', texto: 'Aula', videoUrl: ' https://youtu.be/abc ' })).toEqual({ tipo: 'VIDEO', texto: 'Aula', videoUrl: 'https://youtu.be/abc' });
    expect(postParaEnviar({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a'] }).fotoIds).toEqual(['a']);
  });
});

describe('quem pode publicar e anexar', () => {
  it('sem a configuração ou com a chave desligada, o aluno não publica', () => {
    expect(podePublicar(null)).toBe(false);
    expect(podePublicar({ alunosPublicam: false })).toBe(false);
    expect(podePublicar({ alunosPublicam: true })).toBe(true);
  });
  it('foto só com a chave de publicar ligada e a API liberando', () => {
    expect(podeAnexarFoto({ alunosPublicam: true, podeAnexarFoto: true })).toBe(true);
    expect(podeAnexarFoto({ alunosPublicam: true, podeAnexarFoto: false })).toBe(false);
    expect(podeAnexarFoto({ alunosPublicam: false, podeAnexarFoto: true })).toBe(false);
    expect(podeAnexarFoto(null)).toBe(false);
  });
});

describe('motivos de denúncia', () => {
  it('lista fechada com rótulo', () => {
    expect(MOTIVOS_DE_DENUNCIA.map((m) => m.motivo)).toEqual(['OFENSIVO', 'SPAM', 'IMPROPRIO', 'OUTRO']);
    expect(rotuloDoMotivo('IMPROPRIO')).toBe('Conteúdo impróprio');
  });
});

describe('filtros do mural', () => {
  it('chips no plural, "Denunciados" só para quem modera', () => {
    expect(filtrosDoMural(false).map((f) => f.rotulo)).toEqual(['Todos', 'Avisos', 'Vídeos', 'Dúvidas', 'Resultados', 'Conversas']);
    expect(filtrosDoMural(true).at(-1)).toEqual({ valor: 'DENUNCIADOS', rotulo: 'Denunciados' });
  });
  it('vira a query da API: tipo, denunciados e busca com strip', () => {
    expect(filtrosParaApi(null, '  ')).toEqual({});
    expect(filtrosParaApi('DUVIDA', ' supino ')).toEqual({ tipo: 'DUVIDA', busca: 'supino' });
    expect(filtrosParaApi('DENUNCIADOS', '')).toEqual({ denunciados: true });
  });
  it('vazio com e sem filtro', () => {
    expect(textoDoMuralVazio(null, '')).toBe('Nenhuma publicação no mural ainda.');
    expect(textoDoMuralVazio('AVISO', '')).toBe('Nenhuma publicação encontrada com esse filtro.');
    expect(textoDoMuralVazio(null, 'x')).toBe('Nenhuma publicação encontrada com esse filtro.');
  });
  it('denúncias no singular e no plural', () => {
    expect(textoDasDenuncias(1)).toBe('1 denúncia');
    expect(textoDasDenuncias(3)).toBe('3 denúncias');
  });
  it('tipo pedido pelo endereço só vale se o papel pode escolher', () => {
    expect(tipoPedido('RESULTADO', 'aluno')).toBe('RESULTADO');
    expect(tipoPedido('AVISO', 'aluno')).toBeNull();
    expect(tipoPedido(undefined, 'aluno')).toBeNull();
    expect(tipoPedido('AVISO', 'equipe')).toBe('AVISO');
  });
});
