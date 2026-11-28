import type { ResultadoDoConvite } from '../api/convitesEmLote';
import {
  csvDosConvites, dividirEmLotesDe100, linkDoWhatsApp, mensagemDaConfirmacao, mensagemDoConvite, motivoDaSituacao, primeiroNome,
  resumoDosResultados, rotuloDaAcao, textoDoLoteQueFalhou, textoDoProgresso, validadeCurta,
} from './convitesEmLote';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
const VALIDO = '2026-12-06T02:59:59Z'; // 05/12 às 23:59:59 de Brasília
const gerado = (alunoId: string, extra: Partial<ResultadoDoConvite> = {}): ResultadoDoConvite => ({
  alunoId, nome: `Aluno ${alunoId}`, telefone: '(45) 99999-8888', situacao: 'GERADO', link: `https://app.exemplo/convite#codigo=${alunoId}`, validoAte: VALIDO, ...extra,
});

describe('convites em lote', () => {
  it('divide em lotes de 100, na ordem', () => {
    expect(dividirEmLotesDe100([])).toEqual([]);
    expect(dividirEmLotesDe100(ids(3))).toEqual([ids(3)]);
    const lotes = dividirEmLotesDe100(ids(250));
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 50]);
    expect(lotes.flat()).toEqual(ids(250));
    expect(dividirEmLotesDe100(ids(100))).toHaveLength(1);
  });

  it('primeiro nome é a primeira palavra; vazio fica vazio', () => {
    expect(primeiroNome('  Ana Paula Souza ')).toBe('Ana');
    expect(primeiroNome('Bruno')).toBe('Bruno');
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome(null)).toBe('');
  });

  it('validade em dd/mm/aaaa de Brasília', () => {
    expect(validadeCurta(VALIDO)).toBe('05/12/2026');
    expect(validadeCurta('2026-12-05T03:00:00Z')).toBe('05/12/2026');
    expect(validadeCurta('2026-12-05T02:59:59Z')).toBe('04/12/2026');
    expect(validadeCurta(null)).toBeNull();
    expect(validadeCurta('não é data')).toBeNull();
  });

  it('mensagem exata, com a consultoria ou "sua consultoria"', () => {
    const base = { nome: 'Ana Paula', link: 'https://app.exemplo/convite#codigo=x', validade: '05/12/2026' };
    expect(mensagemDoConvite({ ...base, consultoria: 'Equipe Teste' }))
      .toBe('Oi, Ana! Seu acesso ao app da Equipe Teste está pronto: https://app.exemplo/convite#codigo=x. Válido até 05/12/2026.');
    expect(mensagemDoConvite({ ...base, consultoria: null }))
      .toBe('Oi, Ana! Seu acesso ao app da sua consultoria está pronto: https://app.exemplo/convite#codigo=x. Válido até 05/12/2026.');
    expect(mensagemDoConvite({ ...base, nome: ' ', consultoria: '  ' })).toMatch(/^Oi! Seu acesso ao app da sua consultoria/);
  });

  it('link do WhatsApp: 55 uma vez só, texto codificado; telefone inválido = null', () => {
    expect(linkDoWhatsApp('(45) 99999-8888', 'Oi, Ana!')).toBe('https://wa.me/5545999998888?text=Oi%2C%20Ana!');
    expect(linkDoWhatsApp('(45) 3222-1111', 'x')).toBe('https://wa.me/554532221111?text=x');
    expect(linkDoWhatsApp('+55 45 99999-8888', 'x')).toBe('https://wa.me/5545999998888?text=x');
    expect(linkDoWhatsApp('554532221111', 'x')).toBe('https://wa.me/554532221111?text=x');
    expect(linkDoWhatsApp(null, 'x')).toBeNull();
    expect(linkDoWhatsApp('9999', 'x')).toBeNull();
    const link = linkDoWhatsApp('(45) 99999-8888', 'Oi! https://a.b/convite#codigo=1. Válido até 05/12/2026.')!;
    expect(new URL(link).searchParams.get('text')).toBe('Oi! https://a.b/convite#codigo=1. Válido até 05/12/2026.');
  });

  it('confirmação e rótulo no singular e no plural', () => {
    expect(mensagemDaConfirmacao(1)).toBe('Gera um link de acesso para 1 aluno. Links anteriores deixam de valer.');
    expect(mensagemDaConfirmacao(150)).toBe('Gera um link de acesso para 150 alunos. Links anteriores deixam de valer.');
    expect(rotuloDaAcao(3)).toBe('Gerar convites (3)');
    expect(textoDoProgresso(100, 150)).toBe('Gerando convites: 100 de 150 alunos.');
    expect(textoDoLoteQueFalhou(2, 2, 50)).toBe('Lote 2 de 2 (50 alunos) não foi gerado.');
  });

  it('resumo: gerados na ordem do pedido, não gerados com motivo, desconhecido e link ruim não viram convite', () => {
    const r = resumoDosResultados(['a', 'b', 'c', 'd', 'e', 'f', 'g'], [
      gerado('b'),
      gerado('a', { telefone: null }),
      { alunoId: 'c', nome: 'Cid', telefone: null, situacao: 'JA_TEM_ACESSO', link: null, validoAte: null },
      { alunoId: 'd', nome: 'Duda', telefone: null, situacao: 'CODIGO_NOVO', link: null, validoAte: null },
      gerado('e', { link: 'http://inseguro/convite' }),
      { alunoId: 'f', nome: 'Fê', telefone: null, situacao: 'JA_TEM_ACESSO', link: null, validoAte: null },
    ]);
    expect(r.gerados.map((g) => g.alunoId)).toEqual(['a', 'b']);
    expect(r.gerados[0]).toEqual({ alunoId: 'a', nome: 'Aluno a', telefone: null, link: 'https://app.exemplo/convite#codigo=a', validade: '05/12/2026' });
    expect(r.naoGerados.map((n) => [n.alunoId, n.motivo])).toEqual([
      ['c', 'Já tem acesso ao app.'], ['d', 'Não foi possível gerar o convite.'], ['e', 'O servidor não devolveu o link.'],
      ['f', 'Já tem acesso ao app.'], ['g', 'O servidor não respondeu por este aluno.'],
    ]);
    expect(r.naoGerados.at(-1)?.nome).toBeNull();
    expect(r.linhas).toEqual(['2 convites gerados', '2 já tinham acesso', '3 não gerados']);
    expect(resumoDosResultados(['a'], [gerado('a')]).linhas).toEqual(['1 convite gerado']);
    expect(resumoDosResultados([], []).linhas).toEqual(['Nenhum convite gerado']);
    expect(motivoDaSituacao('ACESSO_DESATIVADO')).toBe('Acesso desativado: reative na ficha.');
  });

  it('CSV: cabeçalho, ; e CRLF, sem fórmula e com aspas quando precisa', () => {
    const csv = csvDosConvites([
      { alunoId: 'a', nome: 'Ana', telefone: '(45) 99999-8888', link: 'https://x/convite#codigo=1', validade: '05/12/2026' },
      { alunoId: 'b', nome: '=HYPERLINK("x")', telefone: null, link: 'https://x/convite#codigo=2', validade: '05/12/2026' },
      { alunoId: 'c', nome: 'Silva; Bia', telefone: '+55 45 9999', link: 'https://x/convite#codigo=3', validade: '05/12/2026' },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'nome;telefone;link;validade',
      'Ana;(45) 99999-8888;https://x/convite#codigo=1;05/12/2026',
      `"'=HYPERLINK(""x"")";;https://x/convite#codigo=2;05/12/2026`,
      `"Silva; Bia";'+55 45 9999;https://x/convite#codigo=3;05/12/2026`,
      '',
    ]);
    expect(csv.startsWith('﻿')).toBe(false);
  });
});
