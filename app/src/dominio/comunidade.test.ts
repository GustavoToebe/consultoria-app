import {
  apelidoParaEnviar, COMENTARIO_MAXIMO, comentarioParaEnviar, comentariosDaPrimeiraPagina, comentariosQueFaltam, comComentarioEnviado,
  contadorDoComentario, erroDoComentario, juntarPaginaDeComentarios, MENSAGEM_COMENTARIO_LONGO, MENSAGEM_COMENTARIO_VAZIO,
  proximaPaginaDeComentarios, semOComentario, tamanhoDoComentario,
  comReacao, reagiu, REACOES, rotuloDaReacao, totalDaReacao, erroDoApelido, MENSAGEM_APELIDO_FORMATO, MENSAGEM_APELIDO_LINK, textoDaPosicao,
  AVISO_AO_CRIAR_ENQUETE, AVISO_ANTES_DO_VOTO, erroDasOpcoes, erroDoPrazo, MENSAGEM_PRAZO_DA_ENQUETE, nomeDoVotante, percentualDaOpcao,
  prazoDaEnquete, textoDosParticipantes, textoDosVotos, votosAoTocar,
  ATRIBUTOS_DO_PLAYER, htmlDoPlayer, idDoYoutube, navegacaoDoPlayerPermitida, urlDoEmbed, urlNoYoutube,
  errosDoPost, MOTIVOS_DE_DENUNCIA, podeAnexarFoto, podePublicar, postParaEnviar, rotuloDoMotivo, rotuloDoTipo, TIPOS_DE_POST,
  tiposParaEscolher, chipsDoMural, MURAL_SEM_FILTRO, opcoesDoTipoDoMural, semOFiltroDoMural, filtrosParaApi, textoDoMuralVazio, textoDasDenuncias, tipoPedido,
  agruparAuloesPorCategoria, buscarAuloes, categoriasDosAuloes, corpoDaAula, errosDaAula, filtrarAuloesPorCategoria,
  chipDaCategoria, filtroDeCategoriaValido, opcoesDoFiltroDeCategoria, RASCUNHO_DA_AULA_VAZIO, rascunhoDaAula, resumoDosAuloes,
} from './comunidade';
import type { AulaDaComunidade, PostDoMural } from '../api/comunidadeTipos';

const aula = (id: string, categoria: string | null, extra: Partial<AulaDaComunidade> = {}): AulaDaComunidade => ({
  id, titulo: `Aula ${id}`, descricao: null, videoUrl: 'https://exemplo.com/v', capaId: null, categoria,
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
    expect(chipDaCategoria(null)).toEqual([]);
    expect(chipDaCategoria('Técnica')).toEqual([{ chave: 'categoria', texto: 'Categoria: Técnica' }]);
    expect(chipDaCategoria('')).toEqual([{ chave: 'categoria', texto: 'Categoria: Sem categoria' }]);
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
    const r = { titulo: ' Novo ', link: 'https://exemplo.com/v', categoria: ' Técnica  de base ', descricao: '', capaId: null };
    expect(corpoDaAula(r)).toEqual({ titulo: 'Novo', descricao: undefined, videoUrl: 'https://exemplo.com/v', categoria: 'Técnica de base' });
    expect(corpoDaAula({ ...r, capaId: 'c1' }).capaId).toBe('c1');
    const original = aula('9', 'Antiga', { publicada: false, ordem: 3, capaId: 'capa-9', descricao: 'Velha' });
    expect(rascunhoDaAula(original)).toEqual({ titulo: 'Aula 9', link: 'https://exemplo.com/v', categoria: 'Antiga', descricao: 'Velha', capaId: 'capa-9' });
    expect(corpoDaAula({ ...rascunhoDaAula(original), categoria: '', descricao: '' }, original)).toEqual({
      titulo: 'Aula 9', descricao: null, videoUrl: 'https://exemplo.com/v', capaId: 'capa-9',
      categoria: null, ordem: 3, publicada: false,
    });
  });

  it('editar sem tocar na capa mantém a capa; remover manda nulo (o PUT sem capaId apagaria)', () => {
    const original = aula('9', null, { capaId: 'capa-9' });
    expect(corpoDaAula({ ...rascunhoDaAula(original), titulo: 'Outro' }, original).capaId).toBe('capa-9');
    const semCapa = corpoDaAula({ ...rascunhoDaAula(original), capaId: null }, original);
    expect(semCapa).toHaveProperty('capaId', null);
  });

  it('resume a quantidade', () => {
    expect(resumoDosAuloes(1)).toBe('1 aulão');
    expect(resumoDosAuloes(3)).toBe('3 aulões');
  });
});

describe('reações do mural', () => {
  it('cinco códigos na ordem da API, cada um com emoji e rótulo', () => {
    expect(REACOES.map((r) => r.codigo)).toEqual(['CURTIR', 'FORCA', 'FOGO', 'PALMAS', 'RISO']);
    expect(REACOES.map((r) => r.emoji).join('')).toBe('❤️💪🔥👏😂');
  });
  it('conta e reconhece a minha por código', () => {
    expect(totalDaReacao({ reacoes: { CURTIR: 3, FOGO: 9 } }, 'CURTIR')).toBe(3);
    expect(totalDaReacao({ reacoes: {} }, 'RISO')).toBe(0);
    expect(reagiu({ minhasReacoes: ['FOGO', 'CURTIR'] }, 'CURTIR')).toBe(true);
    expect(reagiu({ minhasReacoes: ['FOGO'] }, 'CURTIR')).toBe(false);
  });
  it('ligar e desligar mexem na contagem e na marca, na ordem da API; repetir não muda nada', () => {
    const p = { reacoes: { FOGO: 2 }, minhasReacoes: ['FOGO' as const] };
    const ligado = comReacao(p, 'CURTIR', true);
    expect(ligado).toEqual({ reacoes: { FOGO: 2, CURTIR: 1 }, minhasReacoes: ['CURTIR', 'FOGO'] });
    expect(comReacao(ligado, 'CURTIR', true)).toBe(ligado);
    expect(comReacao(ligado, 'FOGO', false)).toEqual({ reacoes: { FOGO: 1, CURTIR: 1 }, minhasReacoes: ['CURTIR'] });
    const soRiso: Pick<PostDoMural, 'reacoes' | 'minhasReacoes'> = { reacoes: {}, minhasReacoes: ['RISO'] };
    expect(comReacao(soRiso, 'RISO', false).reacoes.RISO).toBe(0);
  });
  it('o nome acessível começa pelo rótulo e diz se a pessoa reagiu', () => {
    expect(rotuloDaReacao('Curtir', 1, true)).toBe('Curtir, 1 reação, você reagiu');
    expect(rotuloDaReacao('Fogo', 0, false)).toBe('Fogo, 0 reações');
  });
});

describe('enquete', () => {
  const agora = new Date('2026-11-13T15:00:00Z');
  it('avisos fixos do plano', () => {
    expect(AVISO_AO_CRIAR_ENQUETE).toBe('O voto é identificado: não pergunte sobre saúde, lesão, peso ou dieta.');
    expect(AVISO_ANTES_DO_VOTO).toBe('Seu nome, suas escolhas e o horário do voto ficam visíveis para quem tem acesso a esta enquete.');
  });
  it('opções: 2 a 6, 1 a 80 depois do strip, sem repetir ignorando maiúsculas', () => {
    expect(erroDasOpcoes(['Sim', 'Não'])).toBeNull();
    expect(erroDasOpcoes(['Sim'])).toBe('Use de 2 a 6 opções.');
    expect(erroDasOpcoes(['1', '2', '3', '4', '5', '6', '7'])).toBe('Use de 2 a 6 opções.');
    expect(erroDasOpcoes(['Sim', '   '])).toBe('Cada opção tem de 1 a 80 caracteres.');
    expect(erroDasOpcoes(['a'.repeat(80), ` ${'b'.repeat(80)} `])).toBeNull();
    expect(erroDasOpcoes(['a'.repeat(81), 'b'])).toBe('Cada opção tem de 1 a 80 caracteres.');
    expect(erroDasOpcoes(['Manhã', ' manhã '])).toBe('Não repita opções.');
  });
  it('prazo: fim do dia em Brasília, futuro e em até 1 ano', () => {
    expect(prazoDaEnquete('')).toBeNull();
    expect(prazoDaEnquete('31/02/2026')).toBeUndefined();
    expect(prazoDaEnquete('20/11/2026')).toBe('2026-11-21T02:59:59.000Z');
    expect(erroDoPrazo('', agora)).toBeNull();
    expect(erroDoPrazo('13/11/2026', agora)).toBeNull();
    expect(erroDoPrazo('12/11/2026', agora)).toBe(MENSAGEM_PRAZO_DA_ENQUETE);
    expect(erroDoPrazo('12/11/2027', agora)).toBeNull();
    expect(erroDoPrazo('14/11/2027', agora)).toBe(MENSAGEM_PRAZO_DA_ENQUETE);
    expect(erroDoPrazo('1/1', agora)).toBe('Data inválida. Use DD/MM/AAAA.');
  });
  it('a enquete passa pela validação do post e vira o corpo da API', () => {
    const r = { tipo: 'ENQUETE' as const, texto: ' Melhor horário? ', opcoes: [' Manhã ', 'Noite'], variasRespostas: true, encerraEm: '20/11/2026' };
    expect(errosDoPost(r, 'equipe', agora)).toEqual({});
    expect(errosDoPost(r, 'aluno', agora).tipo).toBeTruthy();
    expect(errosDoPost({ ...r, texto: ' ' }, 'equipe', agora).texto).toBe('Escreva a pergunta.');
    expect(errosDoPost({ ...r, opcoes: ['Só uma'] }, 'equipe', agora).opcoes).toBeTruthy();
    expect(errosDoPost({ ...r, encerraEm: '01/01/2020' }, 'equipe', agora).encerraEm).toBe(MENSAGEM_PRAZO_DA_ENQUETE);
    expect(errosDoPost({ ...r, videoUrl: 'https://youtu.be/abcdefghijk' }, 'equipe', agora).videoUrl).toBeTruthy();
    expect(postParaEnviar(r)).toEqual({
      tipo: 'ENQUETE', texto: 'Melhor horário?', opcoes: ['Manhã', 'Noite'], variasRespostas: true, encerraEm: '2026-11-21T02:59:59.000Z',
    });
    expect(postParaEnviar({ ...r, variasRespostas: undefined, encerraEm: '' })).toEqual({
      tipo: 'ENQUETE', texto: 'Melhor horário?', opcoes: ['Manhã', 'Noite'], variasRespostas: false,
    });
  });
  it('tocar numa opção: única troca ou retira; várias liga e desliga só a tocada', () => {
    expect(votosAoTocar({ variasRespostas: false, meusVotos: [] }, 'a')).toEqual(['a']);
    expect(votosAoTocar({ variasRespostas: false, meusVotos: ['a'] }, 'b')).toEqual(['b']);
    expect(votosAoTocar({ variasRespostas: false, meusVotos: ['a'] }, 'a')).toEqual([]);
    expect(votosAoTocar({ variasRespostas: true, meusVotos: ['a'] }, 'b')).toEqual(['a', 'b']);
    expect(votosAoTocar({ variasRespostas: true, meusVotos: ['a', 'b'] }, 'a')).toEqual(['b']);
  });
  it('percentual sobre as pessoas, sem NaN e sem passar de 100', () => {
    expect(percentualDaOpcao(0, 0)).toBe(0);
    expect(percentualDaOpcao(1, 3)).toBe(33);
    expect(percentualDaOpcao(3, 3)).toBe(100);
    expect(percentualDaOpcao(4, 3)).toBe(100);
  });
  it('textos de votos, participantes e votante', () => {
    expect(textoDosVotos(1)).toBe('1 voto');
    expect(textoDosVotos(0)).toBe('0 votos');
    expect(textoDosParticipantes(0)).toBe('Ninguém votou ainda');
    expect(textoDosParticipantes(1)).toBe('1 pessoa votou');
    expect(textoDosParticipantes(5)).toBe('5 pessoas votaram');
    expect(nomeDoVotante({ nome: 'Ana Souza', ehVoce: true })).toBe('Você');
    expect(nomeDoVotante({ nome: 'Ana Souza', apelido: 'Aninha' })).toBe('Ana Souza (Aninha)');
    expect(nomeDoVotante({ nome: 'Ana Souza' })).toBe('Ana Souza');
  });
});

describe('vídeo do YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  it('aceita só os hosts e caminhos conhecidos, com id de 11', () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=10`, `https://m.youtube.com/watch?feature=x&v=${id}`,
      `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abc`, `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}`, `https://www.youtube.com:443/watch?v=${id}`,
      `  https://youtu.be/${id}  `,
    ]) expect(idDoYoutube(url)).toBe(id);
  });
  it('recusa outro domínio, usuário, http, outra porta e id de tamanho errado', () => {
    for (const url of [
      `https://youtube.com.evil.com/watch?v=${id}`, `https://youtube.com@evil.com/watch?v=${id}`,
      `https://evil.com/youtube.com/watch?v=${id}`, `http://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com:8443/watch?v=${id}`, 'https://youtu.be/dQw4w9WgXc', 'https://youtu.be/dQw4w9WgXcQQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXc!', 'https://vimeo.com/123', `https://www.youtube-nocookie.com/embed/${id}`,
      'javascript:alert(1)', '', null, undefined,
    ]) expect(idDoYoutube(url)).toBeNull();
  });
  it('o player e o botão externo saem de moldes fixos pelo id', () => {
    expect(urlDoEmbed(id)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(urlNoYoutube(id)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(ATRIBUTOS_DO_PLAYER).toEqual({
      referrerpolicy: 'strict-origin-when-cross-origin', allow: 'fullscreen; picture-in-picture; encrypted-media',
      sandbox: 'allow-scripts allow-same-origin allow-presentation', loading: 'lazy',
    });
    const html = htmlDoPlayer(id, 'Aula "boa" <b>');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('title="Aula &#34;boa&#34; &#60;b&#62;"');
    expect(html).not.toContain('autoplay');
  });
  it('o WebView só navega na própria página e no youtube-nocookie', () => {
    const origem = 'https://overtraining.app';
    expect(navegacaoDoPlayerPermitida(`https://www.youtube-nocookie.com/embed/${id}`, origem)).toBe(true);
    expect(navegacaoDoPlayerPermitida(origem, origem)).toBe(true);
    expect(navegacaoDoPlayerPermitida('about:blank', origem)).toBe(true);
    expect(navegacaoDoPlayerPermitida(`https://www.youtube.com/watch?v=${id}`, origem)).toBe(false);
    expect(navegacaoDoPlayerPermitida('https://www.youtube-nocookie.com.evil.com/', origem)).toBe(false);
    expect(navegacaoDoPlayerPermitida('https://www.youtube-nocookie.com@evil.com/', origem)).toBe(false);
    expect(navegacaoDoPlayerPermitida('https://overtraining.app/aluno', origem)).toBe(false);
    expect(navegacaoDoPlayerPermitida(undefined, origem)).toBe(false);
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
  it('lista os seis tipos com rótulo em português', () => {
    expect(TIPOS_DE_POST.map((t) => t.tipo)).toEqual(['AVISO', 'VIDEO', 'ENQUETE', 'DUVIDA', 'RESULTADO', 'CONVERSA']);
    expect(rotuloDoTipo('DUVIDA')).toBe('Dúvida');
  });
  it('o aluno escolhe só conversa, dúvida e resultado; a equipe, todos', () => {
    expect(tiposParaEscolher('aluno').map((t) => t.tipo)).toEqual(['DUVIDA', 'RESULTADO', 'CONVERSA']);
    expect(tiposParaEscolher('equipe')).toHaveLength(6);
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
  it('capa só no vídeo, e vai no corpo junto com o link', () => {
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x', capaId: 'c1' }, 'equipe').capaId).toBeTruthy();
    expect(postParaEnviar({ tipo: 'VIDEO', texto: 'Aula', videoUrl: 'https://youtu.be/abc', capaId: 'c1' }).capaId).toBe('c1');
    expect(postParaEnviar({ tipo: 'VIDEO', texto: 'Aula', videoUrl: 'https://youtu.be/abc', capaId: null })).not.toHaveProperty('capaId');
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
  it('tipos no plural; etiquetas do tipo e das denunciadas', () => {
    expect(opcoesDoTipoDoMural().map((f) => f.rotulo)).toEqual(['Todos', 'Avisos', 'Vídeos', 'Enquetes', 'Dúvidas', 'Resultados', 'Conversas']);
    expect(chipsDoMural(MURAL_SEM_FILTRO)).toEqual([]);
    expect(chipsDoMural({ tipo: 'DUVIDA', denunciados: true })).toEqual([
      { chave: 'tipo', texto: 'Tipo: Dúvidas' }, { chave: 'denunciados', texto: 'Só denunciadas' },
    ]);
    expect(semOFiltroDoMural({ tipo: 'DUVIDA', denunciados: true }, 'tipo')).toEqual({ tipo: null, denunciados: true });
    expect(semOFiltroDoMural({ tipo: 'DUVIDA', denunciados: true }, 'denunciados')).toEqual({ tipo: 'DUVIDA', denunciados: false });
  });
  it('vira a query da API: tipo e denunciados combinam, busca com strip', () => {
    expect(filtrosParaApi(MURAL_SEM_FILTRO, '  ')).toEqual({});
    expect(filtrosParaApi({ tipo: 'DUVIDA', denunciados: false }, ' supino ')).toEqual({ tipo: 'DUVIDA', busca: 'supino' });
    expect(filtrosParaApi({ tipo: null, denunciados: true }, '')).toEqual({ denunciados: true });
    expect(filtrosParaApi({ tipo: 'CONVERSA', denunciados: true }, '')).toEqual({ tipo: 'CONVERSA', denunciados: true });
  });
  it('vazio com e sem filtro', () => {
    expect(textoDoMuralVazio(MURAL_SEM_FILTRO, '')).toBe('Nenhuma publicação no mural ainda.');
    expect(textoDoMuralVazio({ tipo: 'AVISO', denunciados: false }, '')).toBe('Nenhuma publicação encontrada com esse filtro.');
    expect(textoDoMuralVazio(MURAL_SEM_FILTRO, 'x')).toBe('Nenhuma publicação encontrada com esse filtro.');
    expect(textoDoMuralVazio({ tipo: null, denunciados: true }, '')).toBe('Nenhuma publicação denunciada.');
    expect(textoDoMuralVazio({ tipo: 'AVISO', denunciados: true }, '')).toBe('Nenhuma publicação encontrada com esse filtro.');
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
