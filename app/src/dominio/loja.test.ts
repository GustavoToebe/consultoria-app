import { ErroApi } from '@plataforma/web';

import type { ItemDaLojaPublica, LojaPublica, PaginaDaVitrine } from '../api/vitrineTipos';
import {
  codigoDaLoja, corpoDaPagina, esperaDoRetryAfter, estadoDaLoja, itemDaLojaParaMostrar, linkDaLoja, novoLinkDaPagina,
  textoDaEspera, textoDaPagina, traduzirErroDaPagina,
} from './loja';

const CODIGO = 'AbC_def-1234567890xyzQ';

const item: ItemDaLojaPublica = {
  id: 'i1', nome: 'Fullbody', descricao: ' Planilha de 12 semanas ', precoCentavos: 14900, precoVigenteCentavos: 9900, especialAte: '2026-11-27',
  cupom: ' BLACK ', linkUrl: 'https://loja.exemplo/fullbody', temFoto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z',
};
const loja = (itens: ItemDaLojaPublica[]): LojaPublica => ({
  marca: { nome: 'Time Exemplo', corPrimaria: '#336699', fonteTitulo: 'PADRAO', temaPadrao: 'ESCURO', logoUrl: null }, itens,
});

describe('link e código', () => {
  it('monta APP_URL/loja/<codigo>, com a origem de produção ou a informada (sem barra sobrando)', () => {
    expect(linkDaLoja(CODIGO)).toBe(`https://overtraining.app/loja/${CODIGO}`);
    expect(linkDaLoja(CODIGO, 'https://teste.exemplo/')).toBe(`https://teste.exemplo/loja/${CODIGO}`);
  });

  it('lê o código da rota só no formato do código de inscrição (12 a 64 de A-Z a-z 0-9 _ -)', () => {
    expect(codigoDaLoja(CODIGO)).toBe(CODIGO);
    expect(codigoDaLoja(`  ${CODIGO} `)).toBe(CODIGO);
    for (const ruim of ['', 'curto', 'a'.repeat(65), 'abc def ghi jkl mno', '../../etc/passwd/x', `${CODIGO}%`, undefined, null, [CODIGO]]) {
      expect(codigoDaLoja(ruim as string)).toBeNull();
    }
    expect(codigoDaLoja('a'.repeat(12))).toBe('a'.repeat(12));
    expect(codigoDaLoja('a'.repeat(64))).toBe('a'.repeat(64));
  });
});

describe('o que a página mostra por item e por plataforma (D6)', () => {
  it('web: tudo (preço vigente com o antes e o prazo, cupom aparado, link)', () => {
    expect(itemDaLojaParaMostrar(item, 'web')).toEqual({
      id: 'i1', nome: 'Fullbody', descricao: 'Planilha de 12 semanas', foto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z',
      preco: { atual: 'R$ 99,00', antes: 'R$ 149,00', validade: 'Preço especial até 27/11/2026' }, cupom: 'BLACK', linkUrl: 'https://loja.exemplo/fullbody',
    });
  });

  it.each(['ios', 'android'] as const)('%s: item digital só com foto, nome e descrição (sem preço, cupom nem link)', (plataforma) => {
    expect(itemDaLojaParaMostrar(item, plataforma)).toEqual({
      id: 'i1', nome: 'Fullbody', descricao: 'Planilha de 12 semanas', foto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z', preco: null, cupom: null, linkUrl: null,
    });
  });

  it('web: sem preço, cupom em branco, link http e sem foto não mostram nada (nunca "—")', () => {
    const nu = { ...item, precoCentavos: null, precoVigenteCentavos: null, cupom: '  ', linkUrl: 'http://inseguro.exemplo', temFoto: false, descricao: null };
    expect(itemDaLojaParaMostrar(nu, 'web')).toMatchObject({ preco: null, cupom: null, linkUrl: null, foto: false, descricao: null });
  });
});

describe('estados da página', () => {
  const rede = new ErroApi(0, 'SEM_CONEXAO', 'x');

  it('código malformado: não encontrada, sem esperar requisição', () => {
    expect(estadoDaLoja({ codigo: null, loja: undefined })).toMatchObject({ tipo: 'nao_encontrada', titulo: 'Página não encontrada.' });
  });

  it('carregando enquanto não há loja nem erro', () => {
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined })).toMatchObject({ tipo: 'carregando' });
  });

  it('404: não encontrada, com o mesmo texto do código malformado', () => {
    const a = estadoDaLoja({ codigo: null, loja: undefined });
    const b = estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: new ErroApi(404, 'NAO_ENCONTRADO', 'Página não encontrada.') });
    expect(b).toEqual(a);
  });

  it('429: muitas tentativas, com o Retry-After quando houver', () => {
    const erro = new ErroApi(429, 'LIMITE', 'x');
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro, esperaSegundos: 30 })).toMatchObject({
      tipo: 'muitas_tentativas', esperaSegundos: 30, texto: 'Tente de novo em 30 segundos.', podeTentarDeNovo: true,
    });
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro })).toMatchObject({ esperaSegundos: null, texto: 'Tente de novo em instantes.' });
  });

  it('sem conexão e erro do servidor são estados diferentes, os dois com "tentar de novo"', () => {
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: rede })).toMatchObject({ tipo: 'erro_de_rede', podeTentarDeNovo: true });
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: new ErroApi(500, null, 'x') })).toMatchObject({ tipo: 'erro', podeTentarDeNovo: true });
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: new Error('qualquer') })).toMatchObject({ tipo: 'erro' });
  });

  it('503 LOJA_INDISPONIVEL (chave desligada) também é "não encontrada", igual ao 404', () => {
    const a = estadoDaLoja({ codigo: null, loja: undefined });
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: new ErroApi(503, 'LOJA_INDISPONIVEL', 'x') })).toEqual(a);
    expect(estadoDaLoja({ codigo: CODIGO, loja: undefined, erro: new ErroApi(503, null, 'x') }).tipo).toBe('erro');
  });

  it('lista vazia e lista pronta', () => {
    expect(estadoDaLoja({ codigo: CODIGO, loja: loja([]) })).toMatchObject({ tipo: 'vazia', texto: 'Esta página ainda não tem itens.' });
    expect(estadoDaLoja({ codigo: CODIGO, loja: loja([item]) }).tipo).toBe('pronta');
  });

  it('erro novo vale mais que a lista antiga (a página pode ter sido desligada)', () => {
    expect(estadoDaLoja({ codigo: CODIGO, loja: loja([item]), erro: new ErroApi(404, 'NAO_ENCONTRADO', 'x') }).tipo).toBe('nao_encontrada');
  });

  it('Retry-After: segundos, data HTTP, ausente e ilegível', () => {
    expect(esperaDoRetryAfter('45')).toBe(45);
    expect(esperaDoRetryAfter('0')).toBe(1);
    expect(esperaDoRetryAfter('Mon, 16 Nov 2026 12:01:30 GMT', Date.parse('Mon, 16 Nov 2026 12:00:00 GMT'))).toBe(90);
    expect(esperaDoRetryAfter(null)).toBeNull();
    expect(esperaDoRetryAfter('logo')).toBeNull();
    expect(textoDaEspera(1)).toBe('Tente de novo em 1 segundo.');
    expect(textoDaEspera(90)).toBe('Tente de novo em 2 minutos.');
    expect(textoDaEspera(60)).toBe('Tente de novo em 1 minuto.');
  });
});

describe('configuração da página (treinador)', () => {
  const ligada: PaginaDaVitrine = { paginaLigada: true, codigo: CODIGO, versao: 3 };

  it('textos do estado: sem link, desligada e ligada', () => {
    expect(textoDaPagina(null)).toMatchObject({ situacao: 'SEM_LINK', link: null });
    expect(textoDaPagina({ paginaLigada: false, codigo: null, versao: null })).toMatchObject({ situacao: 'SEM_LINK', link: null });
    expect(textoDaPagina({ ...ligada, paginaLigada: false })).toMatchObject({ situacao: 'DESLIGADA', rotulo: 'Desligada', link: `https://overtraining.app/loja/${CODIGO}` });
    expect(textoDaPagina(ligada)).toMatchObject({ situacao: 'LIGADA', rotulo: 'Ligada', link: `https://overtraining.app/loja/${CODIGO}` });
  });

  it('versão a enviar: a lida, ou nula enquanto não há configuração', () => {
    expect(corpoDaPagina(true, ligada)).toEqual({ paginaLigada: true, versao: 3 });
    expect(corpoDaPagina(true, null)).toEqual({ paginaLigada: true, versao: null });
    expect(corpoDaPagina(false, { paginaLigada: false, codigo: null, versao: null })).toEqual({ paginaLigada: false, versao: null });
  });

  it('novo link só com configuração gravada', () => {
    expect(novoLinkDaPagina(ligada)).toEqual({ pode: true, versao: 3, motivo: null });
    expect(novoLinkDaPagina(null).pode).toBe(false);
    expect(novoLinkDaPagina({ paginaLigada: false, codigo: null, versao: null })).toMatchObject({ pode: false, versao: null });
  });

  it('409 recarrega com aviso; 422 mostra o campo; 503 da vitrine, sem conexão e 403 mostram a API; o resto é a frase padrão', () => {
    expect(traduzirErroDaPagina(new ErroApi(409, 'CONFLITO_EDICAO', 'x'))).toEqual({ mensagem: 'A página foi alterada em outro lugar. Recarregamos para você conferir.', recarregar: true });
    expect(traduzirErroDaPagina(new ErroApi(422, 'VITRINE_PAGINA_INVALIDA', 'Confira os dados da página.', [{ field: 'paginaLigada', message: 'Informe se a página fica ligada.' }])))
      .toEqual({ mensagem: 'Informe se a página fica ligada.', recarregar: false });
    expect(traduzirErroDaPagina(new ErroApi(422, 'VITRINE_PAGINA_INVALIDA', 'Confira os dados da página.')).mensagem).toBe('Confira os dados da página.');
    expect(traduzirErroDaPagina(new ErroApi(503, 'VITRINE_INDISPONIVEL', 'A vitrine não está disponível.')).mensagem).toBe('A vitrine não está disponível.');
    expect(traduzirErroDaPagina(new ErroApi(503, 'LOJA_INDISPONIVEL', 'A página pública não está disponível.')).mensagem).toBe('A página pública não está disponível.');
    expect(traduzirErroDaPagina(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.')).mensagem).toBe('Sem permissão.');
    expect(traduzirErroDaPagina(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor.')).mensagem).toBe('Sem conexão com o servidor.');
    expect(traduzirErroDaPagina(new ErroApi(500, null, 'detalhe técnico'))).toEqual({ mensagem: 'Não foi possível salvar a página. Tente de novo.', recarregar: false });
    expect(traduzirErroDaPagina(new Error('x')).mensagem).toBe('Não foi possível salvar a página. Tente de novo.');
  });
});
