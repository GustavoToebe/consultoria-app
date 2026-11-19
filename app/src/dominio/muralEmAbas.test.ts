import type { FiltrosDoMural, PaginaDoMural, PostDoMural, TipoDePost } from '../api/comunidadeTipos';
import { MURAL_SEM_FILTRO, TIPOS_DE_POST } from './comunidade';
import {
  ABA_PADRAO_DO_MURAL, abaDoParametro, abaDoTipo, carregarMuralDaAba, filtroNaAba, juntarPaginas, opcoesDoTipoNaAba,
  PARAMETRO_DO_MEU_GRUPO, postAlterado, rascunhoAoAbrir, textoDoVazioDaAba, tiposDaAba, tiposParaBuscar, visaoDoParametro,
} from './muralEmAbas';

const post = (id: string, tipo: TipoDePost, criadoEm: string, fixado = false): PostDoMural => ({
  id, autorId: 'u1', autorNome: 'Pessoa Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: `Post ${id}`, tipo,
  videoUrl: null, capaId: null, fotos: [], enquete: null, respondida: false, fixado, criadoEm, reacoes: {}, podId: null, podNome: null,
  minhasReacoes: [], totalComentarios: 0,
});
const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });

describe('tipos de cada aba', () => {
  it('Avisos = aviso, vídeo e enquete; Alunos = conversa, dúvida e resultado', () => {
    expect(tiposDaAba('avisos')).toEqual(['AVISO', 'VIDEO', 'ENQUETE']);
    expect(tiposDaAba('alunos')).toEqual(['CONVERSA', 'DUVIDA', 'RESULTADO']);
  });

  it('as duas abas juntas cobrem todos os tipos, sem repetir (tipo novo quebra aqui, não some da tela)', () => {
    const juntas = [...tiposDaAba('avisos'), ...tiposDaAba('alunos')];
    expect(new Set(juntas).size).toBe(juntas.length);
    expect([...juntas].sort()).toEqual(TIPOS_DE_POST.map((t) => t.tipo).sort());
  });

  it('cada tipo mora na aba dele', () => {
    for (const t of TIPOS_DE_POST) expect(tiposDaAba(abaDoTipo(t.tipo))).toContain(t.tipo);
  });
});

describe('parâmetros do endereço', () => {
  it('?mural= aceita avisos e alunos; ausente, desconhecido ou repetido = Avisos', () => {
    expect(ABA_PADRAO_DO_MURAL).toBe('avisos');
    expect(abaDoParametro('alunos')).toBe('alunos');
    expect(abaDoParametro('avisos')).toBe('avisos');
    expect(abaDoParametro(undefined)).toBe('avisos');
    expect(abaDoParametro('grupo')).toBe('avisos');
    expect(abaDoParametro('ALUNOS')).toBe('avisos');
    expect(abaDoParametro(['alunos', 'avisos'])).toBe('avisos');
  });

  it('?grupo=meu só vale com o pod que a API mandou; sem pod ou outro valor = Geral', () => {
    expect(PARAMETRO_DO_MEU_GRUPO).toBe('meu');
    expect(visaoDoParametro('meu', true)).toBe('grupo');
    expect(visaoDoParametro('meu', false)).toBe('geral');
    expect(visaoDoParametro(undefined, true)).toBe('geral');
    expect(visaoDoParametro('grupo', true)).toBe('geral');
  });
});

describe('filtro de tipo dentro da aba', () => {
  it('tipo de outra aba não vale (some o chip) e o resto do filtro fica', () => {
    expect(filtroNaAba({ tipo: 'DUVIDA', denunciados: true }, 'avisos')).toEqual({ tipo: null, denunciados: true });
    expect(filtroNaAba({ tipo: 'DUVIDA', denunciados: false }, 'alunos')).toEqual({ tipo: 'DUVIDA', denunciados: false });
    expect(filtroNaAba(MURAL_SEM_FILTRO, 'alunos')).toBe(MURAL_SEM_FILTRO);
  });

  it('o painel lista "Todos" e só os tipos da aba, na ordem da tela', () => {
    expect(opcoesDoTipoNaAba('avisos').map((o) => o.rotulo)).toEqual(['Todos', 'Avisos', 'Vídeos', 'Enquetes']);
    expect(opcoesDoTipoNaAba('alunos').map((o) => o.rotulo)).toEqual(['Todos', 'Dúvidas', 'Resultados', 'Conversas']);
  });

  it('busca um tipo só quando há chip, senão os três da aba', () => {
    expect(tiposParaBuscar({ tipo: null, denunciados: false }, 'avisos')).toEqual(['AVISO', 'VIDEO', 'ENQUETE']);
    expect(tiposParaBuscar({ tipo: 'VIDEO', denunciados: false }, 'avisos')).toEqual(['VIDEO']);
    expect(tiposParaBuscar({ tipo: 'VIDEO', denunciados: false }, 'alunos')).toEqual(['CONVERSA', 'DUVIDA', 'RESULTADO']);
  });
});

describe('juntar as páginas de cada tipo', () => {
  it('fixados primeiro, depois o mais novo, como a API; o fixado fica na aba do tipo dele', () => {
    const aviso = post('a', 'AVISO', '2026-11-01T10:00:00Z', true);
    const video = post('v', 'VIDEO', '2026-11-10T10:00:00Z');
    const enquete = post('e', 'ENQUETE', '2026-11-12T10:00:00Z');
    const junta = juntarPaginas([pagina(aviso), pagina(video), pagina(enquete)]);
    expect(junta.content.map((p) => p.id)).toEqual(['a', 'e', 'v']);
    expect(junta.totalElements).toBe(3);
  });

  it('mesmo instante: desempata pelo id, maior primeiro (a ordem da consulta)', () => {
    const junta = juntarPaginas([pagina(post('a1', 'AVISO', '2026-11-01T10:00:00Z')), pagina(post('b1', 'VIDEO', '2026-11-01T10:00:00Z'))]);
    expect(junta.content.map((p) => p.id)).toEqual(['b1', 'a1']);
  });

  it('o mesmo post em duas páginas aparece uma vez', () => {
    const p = post('x', 'AVISO', '2026-11-01T10:00:00Z');
    expect(juntarPaginas([pagina(p), pagina(p)]).content).toHaveLength(1);
  });

  it('corta no teto da página: os 50 mais recentes da união são exatos', () => {
    const muitos = (tipo: TipoDePost, dia: number) =>
      pagina(...Array.from({ length: 50 }, (_, i) => post(`${tipo}${i}`, tipo, `2026-11-${String(dia).padStart(2, '0')}T${String(23 - (i % 24)).padStart(2, '0')}:00:00Z`)));
    const junta = juntarPaginas([muitos('AVISO', 10), muitos('VIDEO', 5)]);
    expect(junta.content).toHaveLength(50);
    expect(junta.content.every((p) => p.tipo === 'AVISO')).toBe(true);
    expect(junta.totalElements).toBe(100);
  });
});

describe('carregar a aba', () => {
  it('uma chamada por tipo da aba, com o resto dos filtros; o chip de tipo faz uma chamada só', async () => {
    const pedidos: FiltrosDoMural[] = [];
    const listar = async (f: FiltrosDoMural) => { pedidos.push(f); return pagina(post(`p-${f.tipo}`, f.tipo ?? 'AVISO', '2026-11-01T10:00:00Z')); };
    const junta = await carregarMuralDaAba(listar, { busca: 'supino', podId: 'pod-1' }, ['AVISO', 'VIDEO', 'ENQUETE']);
    expect(pedidos).toEqual([
      { busca: 'supino', podId: 'pod-1', tipo: 'AVISO' }, { busca: 'supino', podId: 'pod-1', tipo: 'VIDEO' }, { busca: 'supino', podId: 'pod-1', tipo: 'ENQUETE' },
    ]);
    expect(junta.content).toHaveLength(3);

    pedidos.length = 0;
    await carregarMuralDaAba(listar, { denunciados: true }, ['DUVIDA']);
    expect(pedidos).toEqual([{ denunciados: true, tipo: 'DUVIDA' }]);
  });

  it('a falha de qualquer tipo é a falha da aba (o 404 do grupo chega uma vez a quem chamou)', async () => {
    const erro = new Error('404');
    await expect(carregarMuralDaAba(async (f) => { if (f.tipo === 'VIDEO') throw erro; return pagina(); }, {}, ['AVISO', 'VIDEO'])).rejects.toBe(erro);
  });
});

describe('nova publicação abre com o tipo da aba', () => {
  it('rascunho intocado: Aviso na aba Avisos para a equipe, Conversa no resto', () => {
    const vazio = { tipo: 'CONVERSA' as const, texto: '' };
    expect(rascunhoAoAbrir(vazio, 'avisos', 'equipe').tipo).toBe('AVISO');
    expect(rascunhoAoAbrir({ tipo: 'AVISO', texto: '' }, 'alunos', 'equipe').tipo).toBe('CONVERSA');
    expect(rascunhoAoAbrir(vazio, 'avisos', 'aluno').tipo).toBe('CONVERSA');
  });

  it('rascunho começado não muda (nada digitado se perde)', () => {
    const comTexto = { tipo: 'CONVERSA' as const, texto: 'Recado começado' };
    expect(rascunhoAoAbrir(comTexto, 'avisos', 'equipe')).toBe(comTexto);
    const enquete = { tipo: 'ENQUETE' as const, texto: '', opcoes: ['Manhã', ''] };
    expect(rascunhoAoAbrir(enquete, 'alunos', 'equipe')).toBe(enquete);
    const video = { tipo: 'VIDEO' as const, texto: '', videoUrl: 'https://exemplo.test/v' };
    expect(rascunhoAoAbrir(video, 'alunos', 'equipe')).toBe(video);
  });

  it('enquete com as duas opções vazias ainda conta como intocada', () => {
    expect(rascunhoAoAbrir({ tipo: 'ENQUETE', texto: '', opcoes: ['', ''] }, 'alunos', 'equipe')).toEqual({ tipo: 'CONVERSA', texto: '' });
  });
});

describe('sair sem salvar na nova publicação (19/11)', () => {
  const inicial = { tipo: 'AVISO' as const, texto: '' };
  it('como abriu não tem alteração; texto, link, foto, capa, opção, prazo, várias respostas ou outro tipo têm', () => {
    expect(postAlterado(inicial, inicial)).toBe(false);
    expect(postAlterado({ ...inicial, texto: '   ' }, inicial)).toBe(false);
    for (const r of [
      { ...inicial, texto: 'Recado' }, { tipo: 'VIDEO' as const, texto: '', videoUrl: 'https://exemplo.test/v' },
      { ...inicial, fotoIds: ['f1'] }, { ...inicial, capaId: 'c1' }, { tipo: 'ENQUETE' as const, texto: '', opcoes: ['Manhã', ''] },
      { ...inicial, encerraEm: '01/12/2026' }, { ...inicial, variasRespostas: true }, { tipo: 'CONVERSA' as const, texto: '' },
    ]) expect(postAlterado(r, inicial)).toBe(true);
  });

  it('sair sem salvar no aluno (19/11): o texto pronto do "Bom trabalho!" não é alteração; mudá-lo ou apagá-lo é', () => {
    const pronto = { tipo: 'RESULTADO' as const, texto: 'Treino concluído: Treino A.' };
    expect(postAlterado(pronto, pronto)).toBe(false);
    expect(postAlterado({ ...pronto, texto: 'Treino concluído: Treino A. ' }, pronto)).toBe(false);
    expect(postAlterado({ ...pronto, texto: 'Treino concluído: Treino A. Bora!' }, pronto)).toBe(true);
    expect(postAlterado({ ...pronto, texto: '' }, pronto)).toBe(true);
    expect(postAlterado({ ...pronto, fotoIds: ['f1'] }, pronto)).toBe(true);
  });
});

describe('vazio da aba', () => {
  it('sem filtro diz o que falta na aba, no grupo quando há', () => {
    expect(textoDoVazioDaAba('avisos', MURAL_SEM_FILTRO, '')).toBe('Nenhum aviso, vídeo ou enquete ainda.');
    expect(textoDoVazioDaAba('alunos', MURAL_SEM_FILTRO, ' ')).toBe('Nenhuma conversa, dúvida ou resultado ainda.');
    expect(textoDoVazioDaAba('alunos', MURAL_SEM_FILTRO, '', 'Força')).toBe('Nenhuma conversa, dúvida ou resultado no grupo Força ainda.');
  });

  it('com tipo ou busca, o texto do filtro; só denunciadas diz a aba', () => {
    expect(textoDoVazioDaAba('alunos', { tipo: 'DUVIDA', denunciados: false }, '')).toBe('Nenhuma publicação encontrada com esse filtro.');
    expect(textoDoVazioDaAba('avisos', MURAL_SEM_FILTRO, 'supino')).toBe('Nenhuma publicação encontrada com esse filtro.');
    expect(textoDoVazioDaAba('avisos', { tipo: null, denunciados: true }, '')).toBe('Nenhuma publicação denunciada em Avisos.');
  });
});
