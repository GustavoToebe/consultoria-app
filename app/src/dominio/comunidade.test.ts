import {
  apelidoParaEnviar, COMENTARIO_MAXIMO, comentarioParaEnviar, comentariosDaPrimeiraPagina, comentariosQueFaltam, comComentarioEnviado,
  contadorDoComentario, erroDoComentario, juntarPaginaDeComentarios, MENSAGEM_COMENTARIO_LONGO, MENSAGEM_COMENTARIO_VAZIO,
  proximaPaginaDeComentarios, semOComentario, tamanhoDoComentario,
  comReacao, reagiu, REACOES, rotuloDaReacao, totalDaReacao, erroDoApelido, MENSAGEM_APELIDO_FORMATO, MENSAGEM_APELIDO_LINK, textoDaPosicao,
  AVISO_AO_CRIAR_ENQUETE, AVISO_ANTES_DO_VOTO, erroDasOpcoes, erroDoPrazo, MENSAGEM_PRAZO_DA_ENQUETE, nomeDoVotante, percentualDaOpcao,
  prazoDaEnquete, textoDosParticipantes, textoDosVotos, votosAoTocar,
  ATRIBUTOS_DO_PLAYER, htmlDoPlayer, idDoYoutube, navegacaoDoPlayerPermitida, urlDoEmbed, urlNoYoutube,
  errosDoPost, MOTIVOS_DE_DENUNCIA, podeAnexarFoto, podePublicar, podeUsarCapaDoYoutube, postParaEnviar, rotuloDoMotivo, rotuloDoTipo,
  textoDoErroDaCapaDoYoutube, TIPOS_DE_POST,
  tiposParaEscolher, chipsDoMural, MURAL_SEM_FILTRO, opcoesDoTipoDoMural, semOFiltroDoMural, filtrosParaApi, textoDoMuralVazio, textoDasDenuncias, tipoPedido,
  avisoDoPod, AVISO_DO_POD_COM_MENOR, erroDoNomeDoPod, motivoDoGrupoCheio, POD_TETO, MENSAGEM_POD_NOME, nomeDoPodParaEnviar, rotuloDoPost, traduzirErroDoPod,
  agruparPorPlaylist, auloesDaPlaylist, buscarAuloes, buscarAuloesComPlaylist, chipDaPlaylist, corpoDaAula, emLotes, erroDoNomeDaPlaylist,
  errosDaAula, filtrarPorPlaylist, filtroDePlaylistValido, listaVelha, LOTE_MAXIMO, MENSAGEM_LISTA_MUDOU, MENSAGEM_PLAYLIST_NOME,
  moverNaLista, nomeDaPlaylistParaEnviar, numerados, opcoesDoFiltroDePlaylist, playlistsEmOrdem, podeMover, RASCUNHO_DA_AULA_VAZIO,
  rascunhoDaAula, resumoDosAuloes, SEM_COLECAO, traduzirErroDaPlaylist, aulaAlterada,
  aulasParaMover, gruposDaEquipe, reordenados, textoDeExcluirPlaylist, textoDoLoteMovido, textoDosMarcados,
} from './comunidade';
import { ErroApi } from '@plataforma/web';
import type { AulaDaComunidade, PlaylistDaComunidade, PostDoMural } from '../api/comunidadeTipos';

const aula = (id: string, playlistId: string | null, ordem = 0, extra: Partial<AulaDaComunidade> = {}): AulaDaComunidade => ({
  id, titulo: `Aula ${id}`, descricao: null, videoUrl: 'https://exemplo.com/v', capaId: null, playlistId,
  ordem, publicada: true, criadaEm: '2026-11-01T10:00:00Z', totalComentarios: 0, ...extra,
});
const playlist = (id: string, nome: string, ordem: number, totalAulas = 0): PlaylistDaComunidade => ({ id, nome, ordem, totalAulas });

describe('sair sem salvar no novo vídeo (19/11)', () => {
  it('novo vazio não tem alteração; qualquer campo ou a capa tem', () => {
    expect(aulaAlterada(RASCUNHO_DA_AULA_VAZIO)).toBe(false);
    for (const parte of [{ titulo: 'T' }, { link: 'h' }, { descricao: ' ' }, { playlistId: 'p1' }, { capaId: 'c1' }]) {
      expect(aulaAlterada({ ...RASCUNHO_DA_AULA_VAZIO, ...parte })).toBe(true);
    }
  });

  it('na edição, igual ao original não tem alteração; capa trocada ou removida e coleção trocada têm', () => {
    const original = aula('a1', 'p1', 0, { descricao: 'Pauta', capaId: 'c1' });
    const r = rascunhoDaAula(original);
    expect(aulaAlterada(r, original)).toBe(false);
    expect(aulaAlterada({ ...r, capaId: null }, original)).toBe(true);
    expect(aulaAlterada({ ...r, capaId: 'c2' }, original)).toBe(true);
    expect(aulaAlterada({ ...r, playlistId: null }, original)).toBe(true);
    expect(aulaAlterada({ ...r, titulo: `${r.titulo}!` }, original)).toBe(true);
    // A aula sem descrição nem capa abre com '' e null: reabrir sem mexer continua sem alteração.
    const simples = aula('a2', null);
    expect(aulaAlterada(rascunhoDaAula(simples), simples)).toBe(false);
  });
});

describe('vídeos e coleções', () => {
  // A resposta vem fora da ordem de propósito: a tela ordena pela `ordem` das coleções e dos vídeos.
  const playlists = [playlist('p2', 'Técnica', 2), playlist('p1', 'Alimentação', 1), playlist('p3', 'Vazia', 3)];
  const aulas = [aula('1', 'p2', 7), aula('2', null), aula('3', 'p1', 1), aula('4', 'p2', 1), aula('5', 'p2', 3), aula('6', null), aula('7', 'sumiu', 1)];

  it('coleções pela ordem, empate pelo nome', () => {
    expect(playlistsEmOrdem(playlists).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(playlistsEmOrdem([playlist('b', 'Bê', 0), playlist('a', 'Á', 0)]).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('vídeos da coleção pela ordem com buracos, empate na ordem que veio, e o número é a posição', () => {
    expect(auloesDaPlaylist(aulas, 'p2').map((a) => a.id)).toEqual(['4', '5', '1']);
    expect(auloesDaPlaylist(aulas, null).map((a) => a.id)).toEqual(['2', '6']);
    expect(auloesDaPlaylist([aula('x', 'p', 2), aula('y', 'p', 2)], 'p').map((a) => a.id)).toEqual(['x', 'y']);
    // ordem 1, 3 e 7: os números são 1, 2 e 3 (nunca ordem + 1).
    expect(numerados(auloesDaPlaylist(aulas, 'p2')).map((n) => [n.item.id, n.numero])).toEqual([['4', 1], ['5', 2], ['1', 3]]);
  });

  it('Subir e Descer devolvem a nova lista; na ponta ou com id ausente, a mesma', () => {
    const ids = ['a', 'b', 'c'];
    expect(moverNaLista(ids, 'b', 'cima')).toEqual(['b', 'a', 'c']);
    expect(moverNaLista(ids, 'b', 'baixo')).toEqual(['a', 'c', 'b']);
    expect(moverNaLista(ids, 'a', 'cima')).toEqual(ids);
    expect(moverNaLista(ids, 'c', 'baixo')).toEqual(ids);
    expect(moverNaLista(ids, 'z', 'cima')).toEqual(ids);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect([podeMover(ids, 'a', 'cima'), podeMover(ids, 'a', 'baixo'), podeMover(ids, 'c', 'baixo'), podeMover(ids, 'z', 'baixo')])
      .toEqual([false, true, false, false]);
  });

  it('agrupa na ordem das coleções, sem as vazias, e Sem coleção por último leva o de coleção desconhecida', () => {
    const grupos = agruparPorPlaylist(aulas, playlists);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Alimentação', 'Técnica', SEM_COLECAO]);
    expect(grupos[1].itens.map((a) => a.id)).toEqual(['4', '5', '1']);
    expect(grupos[2]).toMatchObject({ playlist: null });
    expect(grupos[2].itens.map((a) => a.id)).toEqual(['2', '6', '7']);
    expect(agruparPorPlaylist([aula('1', 'p1')], playlists).map((g) => g.rotulo)).toEqual(['Alimentação']);
    expect(agruparPorPlaylist([], playlists)).toEqual([]);
  });

  it('lista da equipe: todas as coleções em ordem, também a vazia, e Sem coleção por último', () => {
    const grupos = gruposDaEquipe(aulas, playlists);
    expect(grupos.map((g) => [g.rotulo, g.itens.map((a) => a.id)])).toEqual([
      ['Alimentação', ['3']], ['Técnica', ['4', '5', '1']], ['Vazia', []], [SEM_COLECAO, ['2', '6', '7']],
    ]);
    expect(gruposDaEquipe([aula('1', 'p1')], playlists).map((g) => g.rotulo)).toEqual(['Alimentação', 'Técnica', 'Vazia']);
    expect(gruposDaEquipe([aula('1', null)], [])).toEqual([{ playlist: null, rotulo: SEM_COLECAO, itens: [aula('1', null)] }]);
  });

  it('depois do 204 a ordem local segue a lista enviada, sem mexer nos outros', () => {
    const antes = [aula('a', 'p', 5), aula('b', 'p', 9), aula('c', 'q', 2)];
    const depois = reordenados(antes, ['b', 'a']);
    expect(depois.map((a) => [a.id, a.ordem])).toEqual([['a', 1], ['b', 0], ['c', 2]]);
    expect(antes[0].ordem).toBe(5);
  });

  it('lote: ordem da tela, sem os que já estão no destino', () => {
    const naTela = [aula('1', 'p1'), aula('2', null), aula('3', 'p2'), aula('4', 'p1')];
    expect(aulasParaMover(naTela, new Set(['4', '2', '1', '3']), 'p1')).toEqual(['2', '3']);
    expect(aulasParaMover(naTela, new Set(['4', '2']), null)).toEqual(['4']);
    expect(aulasParaMover(naTela, new Set(['x']), 'p1')).toEqual([]);
  });

  it('textos do lote e do excluir', () => {
    expect([textoDosMarcados(0), textoDosMarcados(1), textoDosMarcados(3)]).toEqual(['Nenhum vídeo marcado', '1 vídeo marcado', '3 vídeos marcados']);
    expect(textoDoLoteMovido(1, 'Técnica')).toBe('1 vídeo movido para “Técnica”.');
    expect(textoDoLoteMovido(2, null)).toBe('2 vídeos movidos para “Sem coleção”.');
    expect(textoDeExcluirPlaylist(0)).toBe('A coleção está vazia. Nenhum vídeo muda.');
    expect(textoDeExcluirPlaylist(1)).toContain('Sem coleção');
    expect(textoDeExcluirPlaylist(4)).toBe('Os 4 vídeos dela passam para “Sem coleção”; nenhum vídeo é apagado.');
  });

  it('filtro do treinador: opções com contagem, filtrar, etiqueta e volta a Todas quando a coleção some', () => {
    expect(opcoesDoFiltroDePlaylist(aulas, playlists)).toEqual([
      { valor: null, rotulo: 'Todas', contagem: 7 },
      { valor: 'p1', rotulo: 'Alimentação', contagem: 1 },
      { valor: 'p2', rotulo: 'Técnica', contagem: 3 },
      { valor: '', rotulo: SEM_COLECAO, contagem: 3 },
    ]);
    expect(filtrarPorPlaylist(aulas, null, playlists)).toHaveLength(7);
    expect(filtrarPorPlaylist(aulas, '', playlists).map((a) => a.id)).toEqual(['2', '6', '7']);
    expect(filtrarPorPlaylist(aulas, 'p2', playlists).map((a) => a.id)).toEqual(['1', '4', '5']);
    expect(filtroDePlaylistValido('p2', aulas, playlists)).toBe('p2');
    expect(filtroDePlaylistValido('p3', aulas, playlists)).toBeNull();
    expect(filtroDePlaylistValido('', [aula('1', 'p1')], playlists)).toBeNull();
    expect(chipDaPlaylist(null, playlists)).toEqual([]);
    expect(chipDaPlaylist('p2', playlists)).toEqual([{ chave: 'playlist', texto: 'Coleção: Técnica' }]);
    expect(chipDaPlaylist('', playlists)).toEqual([{ chave: 'playlist', texto: 'Coleção: Sem coleção' }]);
  });

  it('busca no título e na descrição sem acento nem caixa', () => {
    const lista = [aula('1', null, 0, { titulo: 'Técnica do agachamento' }), aula('2', null, 0, { descricao: 'Pauta: PROTEÍNA' })];
    expect(buscarAuloes(lista, 'tecnica').map((a) => a.id)).toEqual(['1']);
    expect(buscarAuloes(lista, 'proteina').map((a) => a.id)).toEqual(['2']);
    expect(buscarAuloes(lista, '  ')).toHaveLength(2);
  });

  it('busca do aluno procura em todos e diz a coleção de cada um', () => {
    const lista = [aula('1', 'p2', 0, { titulo: 'Agachamento' }), aula('2', null, 0, { titulo: 'Agachar bem' }), aula('3', 'sumiu', 0, { titulo: 'Agachamento livre' }),
      aula('4', 'p1', 0, { titulo: 'Proteína' })];
    expect(buscarAuloesComPlaylist(lista, playlists, 'agach').map((r) => [r.aula.id, r.playlist]))
      .toEqual([['1', 'Técnica'], ['2', SEM_COLECAO], ['3', SEM_COLECAO]]);
    expect(buscarAuloesComPlaylist(lista, playlists, 'zzz')).toEqual([]);
  });

  it('valida título e link', () => {
    expect(errosDaAula(RASCUNHO_DA_AULA_VAZIO)).toEqual({ titulo: 'Escreva o título.', link: 'Cole o link do vídeo.' });
    expect(errosDaAula({ ...RASCUNHO_DA_AULA_VAZIO, titulo: 'X', link: 'http://exemplo.com' }).link).not.toBeNull();
    expect(errosDaAula({ ...RASCUNHO_DA_AULA_VAZIO, titulo: 'X', link: 'https://exemplo.com/v' })).toEqual({ titulo: null, link: null });
  });

  it('cria com a coleção sempre no corpo e edita reenviando os seis campos, sem ordem', () => {
    const r = { titulo: ' Novo ', link: 'https://exemplo.com/v', playlistId: 'p1', descricao: '', capaId: null };
    expect(corpoDaAula(r)).toEqual({ titulo: 'Novo', descricao: undefined, videoUrl: 'https://exemplo.com/v', playlistId: 'p1' });
    expect(corpoDaAula({ ...r, playlistId: null })).toHaveProperty('playlistId', null);
    expect(corpoDaAula({ ...r, capaId: 'c1' }).capaId).toBe('c1');
    const original = aula('9', 'p2', 3, { publicada: false, capaId: 'capa-9', descricao: 'Velha' });
    expect(rascunhoDaAula(original)).toEqual({ titulo: 'Aula 9', link: 'https://exemplo.com/v', playlistId: 'p2', descricao: 'Velha', capaId: 'capa-9' });
    expect(corpoDaAula({ ...rascunhoDaAula(original), descricao: '' }, original)).toEqual({
      titulo: 'Aula 9', descricao: null, videoUrl: 'https://exemplo.com/v', capaId: 'capa-9', playlistId: 'p2', publicada: false,
    });
  });

  it('editar sem tocar mantém a coleção e a capa; sem coleção e sem capa vão nulas (o PUT sem elas apagaria)', () => {
    const original = aula('9', 'p1', 2, { capaId: 'capa-9' });
    const editado = corpoDaAula({ ...rascunhoDaAula(original), titulo: 'Outro' }, original);
    expect(editado).toMatchObject({ playlistId: 'p1', capaId: 'capa-9' });
    expect(editado).not.toHaveProperty('ordem');
    const semNada = aula('8', null);
    const corpo = corpoDaAula({ ...rascunhoDaAula(semNada), capaId: null }, semNada);
    expect(corpo).toHaveProperty('playlistId', null);
    expect(corpo).toHaveProperty('capaId', null);
  });

  it('resume a quantidade', () => {
    expect(resumoDosAuloes(1)).toBe('1 vídeo');
    expect(resumoDosAuloes(3)).toBe('3 vídeos');
  });

  it('divide em lotes de 100 (vazia = nenhum lote)', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);
    expect(LOTE_MAXIMO).toBe(100);
    expect(emLotes([])).toEqual([]);
    expect(emLotes(ids(100)).map((l) => l.length)).toEqual([100]);
    expect(emLotes(ids(101)).map((l) => l.length)).toEqual([100, 1]);
    expect(emLotes(ids(101))[1]).toEqual(['a100']);
    expect(emLotes(ids(5), 2).map((l) => l.length)).toEqual([2, 2, 1]);
  });

  it('nome da coleção: espaços repetidos, strip e NFC, de 1 a 60 em UTF-16', () => {
    expect(nomeDaPlaylistParaEnviar('  Técnica   de  base ')).toBe('Técnica de base');
    expect(nomeDaPlaylistParaEnviar('Técnica')).toBe('Técnica');
    expect(erroDoNomeDaPlaylist('   ')).toBe(MENSAGEM_PLAYLIST_NOME);
    expect(erroDoNomeDaPlaylist('a'.repeat(60))).toBeNull();
    expect(erroDoNomeDaPlaylist(` ${'a'.repeat(60)} `)).toBeNull();
    expect(erroDoNomeDaPlaylist('a'.repeat(61))).toBe(MENSAGEM_PLAYLIST_NOME);
    expect(erroDoNomeDaPlaylist(`${'a'.repeat(59)}💪`)).toBe(MENSAGEM_PLAYLIST_NOME);
  });

  it('erro da coleção: nome no campo, lista velha recarrega, o resto em frase fixa', () => {
    expect(traduzirErroDaPlaylist(new ErroApi(422, 'PLAYLIST_INVALIDA', 'Confira a coleção.', [{ field: 'nome', message: 'Use de 1 a 60 caracteres.' }])))
      .toEqual({ mensagem: 'Use de 1 a 60 caracteres.', noCampoNome: true, recarregar: false });
    expect(traduzirErroDaPlaylist(new ErroApi(422, 'PLAYLIST_INVALIDA', 'Confira a coleção.')).mensagem).toBe(MENSAGEM_PLAYLIST_NOME);
    const repetido = traduzirErroDaPlaylist(new ErroApi(409, 'PLAYLIST_NOME_EM_USO', 'texto interno'));
    expect(repetido).toMatchObject({ noCampoNome: true, recarregar: false });
    expect(repetido.mensagem).not.toContain('texto interno');
    for (const erro of [new ErroApi(409, 'CONFLITO_EDICAO', 'x'), new ErroApi(404, 'NAO_ENCONTRADO', 'Coleção não encontrada.')]) {
      expect(listaVelha(erro)).toBe(true);
      expect(traduzirErroDaPlaylist(erro)).toEqual({ mensagem: MENSAGEM_LISTA_MUDOU, noCampoNome: false, recarregar: true });
    }
    expect(listaVelha(new ErroApi(409, 'PLAYLIST_NOME_EM_USO', 'x'))).toBe(false);
    expect(traduzirErroDaPlaylist(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.')).mensagem).toBe('Sem permissão.');
    expect(traduzirErroDaPlaylist(new ErroApi(500, null, 'detalhe interno')).mensagem).toBe('Não foi possível concluir. Tente de novo.');
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
  it('foto: de 0 a 4 sem repetir, para o aluno e para a equipe (C36)', () => {
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'b', 'c', 'd'] }, 'aluno')).toEqual({});
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'b', 'c', 'd', 'e'] }, 'aluno').fotoIds).toBeTruthy();
    expect(errosDoPost({ tipo: 'RESULTADO', texto: 'x', fotoIds: ['a', 'a'] }, 'aluno').fotoIds).toBeTruthy();
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x', fotoIds: [] }, 'equipe')).toEqual({});
    expect(errosDoPost({ tipo: 'AVISO', texto: 'x', fotoIds: ['a'] }, 'equipe')).toEqual({});
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'x', fotoIds: ['a', 'b', 'c', 'd'] }, 'equipe')).toEqual({});
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'x', fotoIds: ['a', 'b', 'c', 'd', 'e'] }, 'equipe').fotoIds).toBeTruthy();
    expect(errosDoPost({ tipo: 'CONVERSA', texto: 'x', fotoIds: ['a', 'a'] }, 'equipe').fotoIds).toBeTruthy();
    expect(postParaEnviar({ tipo: 'AVISO', texto: 'x', fotoIds: ['a'] }).fotoIds).toEqual(['a']);
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

describe('capa do YouTube (C25)', () => {
  it('o botão só aparece com link do YouTube reconhecido e sem capa', () => {
    expect(podeUsarCapaDoYoutube('https://youtu.be/abcdefghijk', null)).toBe(true);
    expect(podeUsarCapaDoYoutube(' https://www.youtube.com/watch?v=abcdefghijk ', undefined)).toBe(true);
    expect(podeUsarCapaDoYoutube('https://youtu.be/abcdefghijk', 'c1')).toBe(false);
    expect(podeUsarCapaDoYoutube('https://video.exemplo.invalid/aula', null)).toBe(false);
    expect(podeUsarCapaDoYoutube('https://youtu.be/curto', null)).toBe(false);
    expect(podeUsarCapaDoYoutube('', null)).toBe(false);
    expect(podeUsarCapaDoYoutube(undefined, null)).toBe(false);
  });
  it('503 ganha a sugestão de enviar a imagem; o 422 fica com a mensagem da API', () => {
    expect(textoDoErroDaCapaDoYoutube(503, 'Não foi possível buscar a capa agora.')).toBe('Não foi possível buscar a capa agora. Tente enviar a imagem.');
    expect(textoDoErroDaCapaDoYoutube(503, 'Não deu. Tente enviar a imagem.')).toBe('Não deu. Tente enviar a imagem.');
    expect(textoDoErroDaCapaDoYoutube(422, 'Esse vídeo não tem capa.')).toBe('Esse vídeo não tem capa.');
    expect(textoDoErroDaCapaDoYoutube(null, 'Sem conexão.')).toBe('Sem conexão.');
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

describe('pods', () => {
  it('rótulo do post: nome do pod ou "Geral"', () => {
    expect(rotuloDoPost({ podNome: null })).toBe('Geral');
    expect(rotuloDoPost({ podNome: 'Turma das 6h' })).toBe('Turma das 6h');
  });
  it('aviso de menor só com temMenor, sem idade nem nome', () => {
    expect(avisoDoPod({ temMenor: true })).toBe(AVISO_DO_POD_COM_MENOR);
    expect(avisoDoPod({ temMenor: false })).toBeNull();
    expect(avisoDoPod(null)).toBeNull();
    expect(AVISO_DO_POD_COM_MENOR).not.toMatch(/\d/);
  });
  it('nome: 2 a 40 depois do strip e do NFC; o mínimo conta caracteres e o máximo, UTF-16', () => {
    expect(nomeDoPodParaEnviar('  Turma  ')).toBe('Turma');
    expect(nomeDoPodParaEnviar('Café')).toBe('Café');
    expect(erroDoNomeDoPod(' a ')).toBe(MENSAGEM_POD_NOME);
    expect(erroDoNomeDoPod('ab')).toBeNull();
    expect(erroDoNomeDoPod('💪')).toBe(MENSAGEM_POD_NOME);
    expect(erroDoNomeDoPod('💪💪')).toBeNull();
    expect(erroDoNomeDoPod('a'.repeat(40))).toBeNull();
    expect(erroDoNomeDoPod('a'.repeat(41))).toBe(MENSAGEM_POD_NOME);
    expect(erroDoNomeDoPod('💪'.repeat(21))).toBe(MENSAGEM_POD_NOME);
  });
  it('erros de pod em português', () => {
    for (const codigo of ['POD_CHEIO', 'POD_NOME_EM_USO', 'ALUNO_SEM_ACESSO', 'ALUNO_INATIVO', 'ALUNO_ANONIMIZADO']) {
      const r = traduzirErroDoPod(new ErroApi(409, codigo, 'texto interno'));
      expect(r.noCampoNome).toBe(false);
      expect(r.mensagem).not.toBe('texto interno');
      expect(r.mensagem).toMatch(/[a-zç]/i);
    }
    expect(traduzirErroDoPod(new ErroApi(409, 'POD_CHEIO', 'x')).mensagem).toContain('12');
  });
  it('grupo cheio: 12 trava, menos o grupo atual do aluno; 11 não trava', () => {
    expect(POD_TETO).toBe(12);
    expect(motivoDoGrupoCheio({ id: 'a', membros: 11 }, null)).toBeNull();
    expect(motivoDoGrupoCheio({ id: 'a', membros: 12 }, null)).toBe('Grupo cheio: 12 de 12');
    expect(motivoDoGrupoCheio({ id: 'a', membros: 12 }, 'b')).toBe('Grupo cheio: 12 de 12');
    expect(motivoDoGrupoCheio({ id: 'a', membros: 12 }, 'a')).toBeNull();
  });
  it('POD_INVALIDO vai ao campo do nome, com o texto do campo ou o fixo', () => {
    expect(traduzirErroDoPod(new ErroApi(422, 'POD_INVALIDO', 'Confira o pod.', [{ field: 'nome', message: 'Use de 2 a 40 caracteres.' }])))
      .toEqual({ mensagem: 'Use de 2 a 40 caracteres.', noCampoNome: true });
    expect(traduzirErroDoPod(new ErroApi(422, 'POD_INVALIDO', 'Confira o pod.'))).toEqual({ mensagem: MENSAGEM_POD_NOME, noCampoNome: true });
  });
  it('403 e sem conexão mostram o texto da API; o resto, frase fixa', () => {
    expect(traduzirErroDoPod(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.')).mensagem).toBe('Sem permissão.');
    expect(traduzirErroDoPod(new ErroApi(500, null, 'detalhe interno')).mensagem).toBe('Não foi possível concluir. Tente de novo.');
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
  it('o pod entra na query só quando informado', () => {
    expect(filtrosParaApi(MURAL_SEM_FILTRO, '', 'p1')).toEqual({ podId: 'p1' });
    expect(filtrosParaApi({ tipo: 'AVISO', denunciados: false }, ' x ', 'p1')).toEqual({ tipo: 'AVISO', busca: 'x', podId: 'p1' });
    expect(filtrosParaApi(MURAL_SEM_FILTRO, '', null)).toEqual({});
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
