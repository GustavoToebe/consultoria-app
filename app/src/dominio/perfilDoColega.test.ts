import { ErroApi } from '@plataforma/web';

import type { ColegaDaLista } from '../api/comunidadeTipos';
import {
  buscarFotoDoColega, colegasDaPrimeiraPagina, COLEGAS_POR_PAGINA, erroDaLeitura, gradeDaAtividade, haMaisColegas, juntarPaginaDeColegas,
  proximaPaginaDeColegas, rotuloDoColega, soONome, textoDoNivel, textoDosTreinos,
} from './perfilDoColega';

const colega = (i: number): ColegaDaLista => ({ autorId: `u${i}`, nome: `Colega ${i}`, apelido: null, nivel: 1, temFoto: false });
const varios = (de: number, ate: number) => Array.from({ length: ate - de }, (_, i) => colega(de + i));

describe('lista de colegas', () => {
  it('"Ver mais" só enquanto a API tem mais do que a tela mostra', () => {
    expect(haMaisColegas(colegasDaPrimeiraPagina({ itens: varios(0, 30), total: 31 }))).toBe(true);
    expect(haMaisColegas({ itens: varios(0, 3), total: 3 })).toBe(false);
    expect(haMaisColegas({ itens: [], total: 0 })).toBe(false);
  });

  it('pede a página que contém o próximo colega', () => {
    expect(proximaPaginaDeColegas({ itens: varios(0, COLEGAS_POR_PAGINA), total: 70 })).toBe(1);
    expect(proximaPaginaDeColegas({ itens: varios(0, 60), total: 70 })).toBe(2);
    // Alguém reservou: a lista andou para trás e a página 1 repete um; juntar por id não repete nem pula.
    expect(proximaPaginaDeColegas({ itens: varios(0, 59), total: 69 })).toBe(1);
  });

  it('junta sem repetir e encerra quando a página não traz ninguém novo', () => {
    const lidos = { itens: varios(0, 30), total: 45 };
    const juntos = juntarPaginaDeColegas(lidos, { itens: varios(29, 45), total: 45 });
    expect(juntos.itens.map((c) => c.autorId)).toEqual(varios(0, 45).map((c) => c.autorId));
    expect(haMaisColegas(juntos)).toBe(false);
    const parado = juntarPaginaDeColegas(lidos, { itens: varios(10, 30), total: 45 });
    expect(parado.itens).toHaveLength(30);
    expect(haMaisColegas(parado)).toBe(false);
  });

  it('rótulo da linha com nome, apelido e nível', () => {
    expect(rotuloDoColega({ nome: 'Ana Teste', apelido: 'Aninha', nivel: 3 })).toBe('Ana Teste, apelido Aninha, Nível 3');
    expect(rotuloDoColega({ nome: 'Ana Teste', apelido: null, nivel: 1 })).toBe('Ana Teste, Nível 1');
  });
});

describe('perfil do colega', () => {
  it('404 é um só, 429 tem o texto fixo e o resto tenta de novo', () => {
    expect(erroDaLeitura(new ErroApi(404, 'Perfil não encontrado.', 'NAO_ENCONTRADO'))).toBe('nao-encontrado');
    expect(erroDaLeitura(new ErroApi(429, 'Muitas.', 'LIMITE'))).toBe('limite');
    expect(erroDaLeitura(new ErroApi(503, 'Fora.', 'FORA'))).toBe('outro');
    expect(erroDaLeitura(new Error('rede'))).toBe('outro');
  });

  it('reservado e visto por outro mostra só o nome; o próprio vê tudo', () => {
    expect(soONome({ reservado: true, ehVoce: false })).toBe(true);
    expect(soONome({ reservado: true, ehVoce: true })).toBe(false);
    expect(soONome({ reservado: false, ehVoce: false })).toBe(false);
  });

  it('busca a foto só com `temFoto` e perfil aberto', () => {
    expect(buscarFotoDoColega({ reservado: false, ehVoce: false, temFoto: true })).toBe(true);
    expect(buscarFotoDoColega({ reservado: false, ehVoce: false, temFoto: false })).toBe(false);
    expect(buscarFotoDoColega({ reservado: false, ehVoce: false })).toBe(false);
    expect(buscarFotoDoColega({ reservado: true, ehVoce: false, temFoto: true })).toBe(false);
    expect(buscarFotoDoColega({ reservado: true, ehVoce: true, temFoto: true })).toBe(true);
  });

  it('textos de nível e treinos', () => {
    expect(textoDoNivel(2)).toBe('Nível 2');
    expect(textoDosTreinos(1)).toBe('1 treino concluído');
    expect(textoDosTreinos(0)).toBe('0 treinos concluídos');
  });
});

describe('gradeDaAtividade', () => {
  // 10/11/2026 é uma terça; a janela começa em 12/10/2026, uma segunda.
  const HOJE = '2026-11-10';

  it('30 dias em semanas de domingo a sábado, com o vazio antes do primeiro e depois de hoje', () => {
    const g = gradeDaAtividade([], HOJE);
    const dias = g.semanas.flat();
    expect(g.semanas.every((s) => s.length === 7)).toBe(true);
    expect(dias.filter(Boolean)).toHaveLength(30);
    expect(dias[0]).toBeNull();
    expect(dias[1]).toEqual({ data: '2026-10-12', treinou: false, hoje: false });
    const ultimo = dias.filter(Boolean).at(-1);
    expect(ultimo).toEqual({ data: HOJE, treinou: false, hoje: true });
    expect(g.resumo).toBe('Nenhum dia com treino nos últimos 30 dias, de 12/10/2026 a 10/11/2026.');
  });

  it('marca os dias treinados, ignora os de fora da janela e repetidos e concorda o plural', () => {
    const g = gradeDaAtividade(['2026-10-11', '2026-10-12', '2026-11-10', '2026-11-10', '2026-11-11'], HOJE);
    expect(g.treinados).toBe(2);
    expect(g.semanas.flat().filter((d) => d?.treinou).map((d) => d?.data)).toEqual(['2026-10-12', '2026-11-10']);
    expect(g.resumo).toBe('Treinou em 2 dias dos últimos 30, de 12/10/2026 a 10/11/2026.');
    expect(gradeDaAtividade(['2026-11-01'], HOJE).resumo).toBe('Treinou em 1 dia dos últimos 30, de 12/10/2026 a 10/11/2026.');
  });

  it('janela que atravessa o ano', () => {
    const g = gradeDaAtividade(['2025-12-31'], '2026-01-05');
    expect(g.semanas.flat().find(Boolean)?.data).toBe('2025-12-07');
    expect(g.treinados).toBe(1);
  });
});
