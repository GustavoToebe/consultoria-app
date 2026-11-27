import type { EventoAuditoria } from '../api/equipeTipos';
import { rotaDoObjeto, rotuloDoTipo, textoDoObjeto } from './objetoDaAuditoria';
import {
  agruparPorDia, diaEmBrasilia, horaEmBrasilia, juntarPaginas, quandoCompleto, resumoDaLinha, textoDaContagem, tituloDoDia,
} from './resumoDeAuditoria';

const ev = (extra: Partial<EventoAuditoria>): EventoAuditoria => ({
  id: 'e1', usuarioId: 'u1', nomeUsuario: 'Ana Fictícia', acao: 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: 'a1',
  resumo: 'Cadastrou um aluno.', criadoEm: '2026-11-27T17:05:09Z', objetoNome: null, origem: null, ...extra,
});

describe('datas de Brasília', () => {
  it('a virada do dia é a de Brasília, não a do aparelho', () => {
    // 02:30 UTC do dia 28 = 23:30 do dia 27 em Brasília.
    expect(diaEmBrasilia('2026-11-28T02:30:00Z')).toBe('2026-11-27');
    expect(diaEmBrasilia('2026-11-28T03:00:00Z')).toBe('2026-11-28');
    expect(horaEmBrasilia('2026-11-28T02:30:00Z')).toBe('23:30');
    expect(quandoCompleto('2026-11-27T17:05:09Z')).toBe('27/11/2026 às 14:05:09');
    expect(diaEmBrasilia('não é data')).toBeNull();
    expect(horaEmBrasilia('não é data')).toBe('—');
  });

  it('Hoje, Ontem e a data, também na virada do mês', () => {
    expect(tituloDoDia('2026-11-27', '2026-11-27')).toBe('Hoje');
    expect(tituloDoDia('2026-11-26', '2026-11-27')).toBe('Ontem');
    expect(tituloDoDia('2026-11-25', '2026-11-27')).toBe('25/11/2026');
    expect(tituloDoDia('2026-11-30', '2026-12-01')).toBe('Ontem');
  });

  it('agrupa na ordem que veio, um grupo por dia', () => {
    const grupos = agruparPorDia([
      ev({ id: 'a', criadoEm: '2026-11-27T15:00:00Z' }), ev({ id: 'b', criadoEm: '2026-11-27T03:10:00Z' }),
      ev({ id: 'c', criadoEm: '2026-11-27T02:50:00Z' }), ev({ id: 'd', criadoEm: '2026-11-20T12:00:00Z' }),
    ], '2026-11-27');
    expect(grupos.map((g) => [g.titulo, g.eventos.map((e) => e.id)])).toEqual([['Hoje', ['a', 'b']], ['Ontem', ['c']], ['20/11/2026', ['d']]]);
  });
});

describe('resumo da linha', () => {
  it('Aluno e Cobrança sem aspas, os outros com aspas', () => {
    expect(resumoDaLinha(ev({ objetoNome: 'Vitor Luiz Santos' }))).toBe('Aluno Vitor Luiz Santos');
    expect(resumoDaLinha(ev({ entidade: 'COBRANCA', objetoNome: '11/2026 de R$ 997,00' }))).toBe('Cobrança 11/2026 de R$ 997,00');
    expect(resumoDaLinha(ev({ entidade: 'QUESTIONARIO', objetoNome: 'Padrão' }))).toBe('Questionário “Padrão”');
    expect(resumoDaLinha(ev({ entidade: 'aluno', objetoNome: 'Bia' }))).toBe('Aluno Bia');
    expect(resumoDaLinha(ev({ entidade: 'COISA_NOVA', objetoNome: 'Algo' }))).toBe('Algo');
  });

  it('sem objeto mostra a origem; sem os dois, vazio (nunca o resumo que repete a ação)', () => {
    expect(resumoDaLinha(ev({ entidade: 'USUARIO', objetoNome: null, origem: 'App Android' }))).toBe('App Android');
    expect(resumoDaLinha(ev({ objetoNome: '  ', origem: null }))).toBe('');
    expect(resumoDaLinha(ev({ objetoNome: undefined, origem: undefined }))).toBe('');
  });
});

describe('objeto e link', () => {
  it('só abre com nome, id e uma tela para o tipo', () => {
    expect(rotaDoObjeto(ev({ objetoNome: 'Bia' }))).toBe('/treinador/alunos/a1');
    expect(rotaDoObjeto(ev({ entidade: 'QUESTIONARIO', entidadeId: 'q1', objetoNome: 'Padrão' }))).toBe('/treinador/planejamento/questionario/q1');
    expect(rotaDoObjeto(ev({ entidade: 'DIETA', entidadeId: 'p1', objetoNome: 'Dieta de Bia' }))).toBe('/treinador/dietas/p1');
    expect(rotaDoObjeto(ev({ objetoNome: null }))).toBeNull();
    expect(rotaDoObjeto(ev({ entidadeId: null, objetoNome: 'Bia' }))).toBeNull();
    expect(rotaDoObjeto(ev({ entidade: 'COBRANCA', entidadeId: 'c1', objetoNome: '11/2026' }))).toBeNull();
    expect(rotuloDoTipo('INSCRICAO_MODELO')).toBe('Resposta pronta');
    expect(rotuloDoTipo('XYZ')).toBeNull();
    expect(textoDoObjeto(ev({ objetoNome: null }))).toBeNull();
  });
});

describe('outros', () => {
  it('juntar páginas tira o repetido da borda', () => {
    const p1 = [ev({ id: 'a' }), ev({ id: 'b' })];
    const p2 = [ev({ id: 'b' }), ev({ id: 'c' })];
    expect(juntarPaginas(p1, p2).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('contagem', () => {
    expect(textoDaContagem(252)).toBe('252 eventos neste filtro');
    expect(textoDaContagem(1)).toBe('1 evento neste filtro');
    expect(textoDaContagem(1500)).toBe('1.500 eventos neste filtro');
  });
});
