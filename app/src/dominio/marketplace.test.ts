import { ErroApi } from '@plataforma/web';

import type { ItemDoMarketplace, LojaDoMarketplace, PaginaDaVitrine } from '../api/vitrineTipos';
import { NAO_ENCONTRADA } from './loja';
import {
  AVISO_DE_DEMORA_NA_LISTA, caminhoDaLoja, estadoDaLista, interruptorDaListaDaConsultoria, interruptorDoItemNaLista, itemDoMarketplaceParaMostrar,
  lojaDoMarketplaceParaMostrar, proximaPaginaDaLista, ROTULO_DA_LISTA,
} from './marketplace';
import { MOTIVO_SO_DIGITAL_NA_LISTA, rascunhoVazio } from './vitrine';

const CODIGO = 'AbC_def-1234567890xyzQ';

const item: ItemDoMarketplace = {
  id: 'i1', nome: 'Fullbody', descricao: ' Planilha de 12 semanas ', tipo: 'DIGITAL', precoVigenteCentavos: 9900, temFoto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z',
};
const loja = (itens: ItemDoMarketplace[] = [item]): LojaDoMarketplace => ({
  marca: { nome: 'Time Exemplo', corPrimaria: '#336699', fonteTitulo: 'PADRAO', temaPadrao: 'ESCURO', logoUrl: null }, codigo: CODIGO, itens,
});

describe('caminho e paginação', () => {
  it('o caminho da página da consultoria é /loja/<codigo>', () => {
    expect(caminhoDaLoja(CODIGO)).toBe(`/loja/${CODIGO}`);
  });

  it('próxima página: só enquanto faltar consultoria e página', () => {
    expect(proximaPaginaDaLista({ total: 70, pagina: 0, tamanho: 30, carregadas: 30 })).toBe(1);
    expect(proximaPaginaDaLista({ total: 70, pagina: 1, tamanho: 30, carregadas: 60 })).toBe(2);
    expect(proximaPaginaDaLista({ total: 70, pagina: 2, tamanho: 30, carregadas: 70 })).toBeNull();
    expect(proximaPaginaDaLista({ total: 60, pagina: 1, tamanho: 30, carregadas: 60 })).toBeNull();
    expect(proximaPaginaDaLista({ total: 0, pagina: 0, tamanho: 30, carregadas: 0 })).toBeNull();
  });

  it('página vazia com total maior (cache) não faz o botão repetir a mesma; tamanho inválido não pagina', () => {
    expect(proximaPaginaDaLista({ total: 70, pagina: 2, tamanho: 30, carregadas: 60 })).toBeNull();
    expect(proximaPaginaDaLista({ total: 70, pagina: 0, tamanho: 0, carregadas: 0 })).toBeNull();
    expect(proximaPaginaDaLista({ total: 70, pagina: 0, tamanho: Number.NaN, carregadas: 0 })).toBeNull();
  });
});

describe('o que a lista mostra por item e por plataforma (D6)', () => {
  it('web: nome, descrição aparada, foto e o preço vigente', () => {
    expect(itemDoMarketplaceParaMostrar(item, 'web')).toEqual({
      id: 'i1', nome: 'Fullbody', descricao: 'Planilha de 12 semanas', foto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z', preco: 'R$ 99,00',
    });
  });

  it.each(['ios', 'android'] as const)('%s: item digital só com foto, nome e descrição (sem preço)', (plataforma) => {
    expect(itemDoMarketplaceParaMostrar(item, plataforma)).toEqual({
      id: 'i1', nome: 'Fullbody', descricao: 'Planilha de 12 semanas', foto: true, fotoAtualizadaEm: '2026-11-16T03:00:00Z', preco: null,
    });
  });

  it('sem preço, descrição em branco e sem foto: nada na tela (nunca "—", zero nem "grátis")', () => {
    const nu = { ...item, precoVigenteCentavos: null, descricao: '  ', temFoto: false, fotoAtualizadaEm: null };
    expect(itemDoMarketplaceParaMostrar(nu, 'web')).toMatchObject({ preco: null, descricao: null, foto: false });
  });

  it('a consultoria leva o nome da marca, o código, o caminho e os itens já no formato da plataforma', () => {
    const l = lojaDoMarketplaceParaMostrar(loja(), 'android');
    expect(l).toMatchObject({ codigo: CODIGO, nome: 'Time Exemplo', caminho: `/loja/${CODIGO}` });
    expect(l.itens).toEqual([itemDoMarketplaceParaMostrar(item, 'android')]);
  });
});

describe('estados da tela pública', () => {
  const rede = new ErroApi(0, 'SEM_CONEXAO', 'x');

  it('carregando enquanto nada chegou nem falhou', () => {
    expect(estadoDaLista({ lojas: undefined })).toMatchObject({ tipo: 'carregando' });
    expect(estadoDaLista({ lojas: null })).toMatchObject({ tipo: 'carregando' });
  });

  it('vazia e pronta', () => {
    expect(estadoDaLista({ lojas: [] })).toMatchObject({ tipo: 'vazia', titulo: 'Nenhuma consultoria por aqui ainda' });
    expect(estadoDaLista({ lojas: [loja()] })).toEqual({ tipo: 'pronta', lojas: [loja()], falhaAoCarregarMais: null });
  });

  it('404 e 503 MARKETPLACE_INDISPONIVEL: o mesmo "Página não encontrada." da loja', () => {
    for (const erro of [new ErroApi(404, 'NAO_ENCONTRADO', 'x'), new ErroApi(503, 'MARKETPLACE_INDISPONIVEL', 'x')]) {
      expect(estadoDaLista({ lojas: undefined, erro })).toEqual({ tipo: 'indisponivel', ...NAO_ENCONTRADA });
    }
    expect(NAO_ENCONTRADA.titulo).toBe('Página não encontrada.');
    expect(estadoDaLista({ lojas: undefined, erro: new ErroApi(503, null, 'x') }).tipo).toBe('erro');
  });

  it('429: muitas tentativas, com o Retry-After quando houver, senão "em instantes"', () => {
    const erro = new ErroApi(429, 'LOGIN_LIMITADO', 'x');
    expect(estadoDaLista({ lojas: undefined, erro, esperaSegundos: 30 })).toMatchObject({
      tipo: 'muitas_tentativas', esperaSegundos: 30, texto: 'Tente de novo em 30 segundos.', podeTentarDeNovo: true,
    });
    expect(estadoDaLista({ lojas: undefined, erro })).toMatchObject({ esperaSegundos: null, texto: 'Tente de novo em instantes.' });
  });

  it('sem conexão e erro do servidor são estados diferentes, os dois com "tentar de novo"', () => {
    expect(estadoDaLista({ lojas: undefined, erro: rede })).toMatchObject({ tipo: 'erro_de_rede', podeTentarDeNovo: true });
    expect(estadoDaLista({ lojas: undefined, erro: new ErroApi(500, null, 'x') })).toMatchObject({ tipo: 'erro', podeTentarDeNovo: true });
    expect(estadoDaLista({ lojas: [], erro: new Error('qualquer') })).toMatchObject({ tipo: 'erro' });
  });

  it('erro ao carregar mais não derruba a lista que já veio; lista que virou "não encontrada" sim', () => {
    expect(estadoDaLista({ lojas: [loja()], erro: rede })).toMatchObject({ tipo: 'pronta', falhaAoCarregarMais: { tipo: 'erro_de_rede', podeTentarDeNovo: true } });
    expect(estadoDaLista({ lojas: [loja()], erro: new ErroApi(429, 'x', 'x'), esperaSegundos: 5 })).toMatchObject({ falhaAoCarregarMais: { tipo: 'muitas_tentativas', esperaSegundos: 5 } });
    expect(estadoDaLista({ lojas: [loja()], erro: new ErroApi(503, 'MARKETPLACE_INDISPONIVEL', 'x') }).tipo).toBe('indisponivel');
  });
});

describe('textos do treinador', () => {
  const pagina = (extra: Partial<PaginaDaVitrine> = {}): PaginaDaVitrine => ({ paginaLigada: true, codigo: CODIGO, noMarketplace: false, versao: 1, ...extra });
  const textos = (...partes: (string | null)[]) => partes.filter((p): p is string => p !== null).join(' ');

  it('nenhum texto de tela diz "marketplace"; o nome vem da constante', () => {
    const todos = textos(
      ROTULO_DA_LISTA, AVISO_DE_DEMORA_NA_LISTA, MOTIVO_SO_DIGITAL_NA_LISTA,
      ...Object.values(interruptorDaListaDaConsultoria(pagina({ noMarketplace: true, paginaLigada: false }), true)).filter((v): v is string => typeof v === 'string'),
      ...Object.values(interruptorDoItemNaLista({ ...rascunhoVazio(), tipo: 'FISICO' }, true, true)).filter((v): v is string => typeof v === 'string'),
    );
    expect(todos).not.toMatch(/marketplace/i);
    expect(ROTULO_DA_LISTA).toBe('Aparece na vitrine de consultorias');
  });

  it('consultoria: visível só com a chave; explica a regra e a demora; nunca travado', () => {
    const i = interruptorDaListaDaConsultoria(pagina(), true);
    expect(i).toMatchObject({ visivel: true, habilitado: true, motivo: null, rotulo: ROTULO_DA_LISTA, semEfeito: null });
    expect(i.explicacao).toContain('página pública ligada');
    expect(i.explicacao).toContain('até 1 minuto');
    expect(interruptorDaListaDaConsultoria(pagina(), false).visivel).toBe(false);
  });

  it('consultoria: marcada com a página desligada ou sem código fica "sem efeito"; desmarcada ou carregando, não avisa', () => {
    expect(interruptorDaListaDaConsultoria(pagina({ noMarketplace: true }), true).semEfeito).toBeNull();
    expect(interruptorDaListaDaConsultoria(pagina({ noMarketplace: true, paginaLigada: false }), true).semEfeito).toBe('Sem efeito enquanto a página pública estiver desligada.');
    expect(interruptorDaListaDaConsultoria(pagina({ noMarketplace: true, codigo: null }), true).semEfeito).not.toBeNull();
    expect(interruptorDaListaDaConsultoria(pagina({ paginaLigada: false }), true).semEfeito).toBeNull();
    expect(interruptorDaListaDaConsultoria(null, true)).toMatchObject({ visivel: true, semEfeito: null });
  });

  it('item: habilitado só se digital, com o motivo; visível só com a chave', () => {
    expect(interruptorDoItemNaLista(rascunhoVazio(), true, true)).toMatchObject({ visivel: true, habilitado: true, motivo: null });
    expect(interruptorDoItemNaLista({ ...rascunhoVazio(), tipo: 'FISICO' }, true, true)).toMatchObject({ habilitado: false, motivo: MOTIVO_SO_DIGITAL_NA_LISTA });
    expect(interruptorDoItemNaLista(rascunhoVazio(), false, true).visivel).toBe(false);
    expect(interruptorDoItemNaLista(rascunhoVazio(), true, true).explicacao).toMatch(/digital.*ativo.*página pública.*até 1 minuto/);
  });

  it('item marcado: sem efeito se inativo, fora da página pública ou com a consultoria fora da lista; senão aparece', () => {
    const marcado = { ...rascunhoVazio(), noMarketplace: true, naPaginaPublica: true };
    expect(interruptorDoItemNaLista(marcado, true, true).semEfeito).toBeNull();
    expect(interruptorDoItemNaLista({ ...marcado, ativo: false }, true, true).semEfeito).toBe('Sem efeito enquanto o item estiver inativo.');
    expect(interruptorDoItemNaLista({ ...marcado, naPaginaPublica: false }, true, true).semEfeito).toBe('Sem efeito enquanto o item não aparecer na página pública.');
    expect(interruptorDoItemNaLista(marcado, true, false).semEfeito).toBe('Sem efeito enquanto a consultoria não aparecer na vitrine de consultorias.');
  });

  it('item não marcado não leva aviso de "sem efeito"', () => {
    expect(interruptorDoItemNaLista({ ...rascunhoVazio(), ativo: false }, true, false).semEfeito).toBeNull();
  });
});
