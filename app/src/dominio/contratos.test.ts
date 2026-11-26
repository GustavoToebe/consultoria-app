import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ContratacaoResponse } from '../api/financeiroTipos';
import {
  acoesDoContrato, camposDesconhecidos, CAMPOS_DO_CONTRATO, contratacoesParaEscolher, erroDosCamposDesconhecidos, GRUPOS_DOS_CAMPOS,
  htmlDoTextoFormatado, inserirCampo, instanteDeBrasilia, linhasDeEvidencia, notaDasFaltas, PADRAO_DO_CAMPO, podeCompletarOCadastro,
  rotuloDaContratacao, seloDoContrato, seloDoContratoDoAluno, TEXTO_DA_NOTA_DAS_FALTAS,
} from './contratos';

/** Paridade com o Java: a lista dos 12 campos e o padrão do campo (T5), como em `catalogoDePermissoesParidade.test.ts`. */
const java = readFileSync(resolve(__dirname, '../../../api/src/main/java/br/com/treinos/api/contratos/CamposDoContrato.java'), 'utf8');

describe('paridade com CamposDoContrato.java', () => {
  it('os mesmos 12 códigos', () => {
    const enumJava = /enum Campo \{([\s\S]*?);/.exec(java)?.[1] ?? '';
    const daApi = [...enumJava.matchAll(/\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();
    expect(daApi).toHaveLength(12);
    expect(CAMPOS_DO_CONTRATO.map((c) => c.codigo).sort()).toEqual(daApi);
  });

  it('o mesmo padrão do campo', () => {
    const token = /Pattern\.compile\("((?:[^"\\]|\\.)*)"\)/.exec(java.slice(java.indexOf('TOKEN')))?.[1] ?? '';
    expect(PADRAO_DO_CAMPO.source).toBe(token.replace(/\\\\/g, '\\'));
  });

  it('todo campo tem rótulo, e os grupos cobrem todos', () => {
    expect(CAMPOS_DO_CONTRATO.every((c) => c.rotulo.length > 0 && GRUPOS_DOS_CAMPOS.includes(c.grupo))).toBe(true);
    expect(new Set(CAMPOS_DO_CONTRATO.map((c) => c.codigo)).size).toBe(12);
  });
});

describe('camposDesconhecidos', () => {
  it('só os que a lista não tem, sem repetir, na ordem', () => {
    expect(camposDesconhecidos('{aluno_nome} {x} {y} {x} {data}')).toEqual(['x', 'y']);
  });
  it('chave com outro conteúdo é texto, não campo', () => {
    expect(camposDesconhecidos('{ aluno } {a-b} {} {{z}')).toEqual(['z']);
  });
  it('mensagem fixa para a tela; sem desconhecido, nada', () => {
    expect(erroDosCamposDesconhecidos('{x} e {y}')).toBe('Campos desconhecidos: {x}, {y}. Use só os da lista.');
    expect(erroDosCamposDesconhecidos('{aluno_nome}')).toBeNull();
  });
});

describe('inserirCampo', () => {
  it('no cursor, com o cursor depois do campo', () => {
    expect(inserirCampo('Olá , bem-vindo', { inicio: 4, fim: 4 }, 'aluno_nome')).toEqual({ texto: 'Olá {aluno_nome}, bem-vindo', cursor: 16 });
  });
  it('troca o trecho selecionado', () => {
    expect(inserirCampo('Olá XXX!', { inicio: 4, fim: 7 }, 'data')).toEqual({ texto: 'Olá {data}!', cursor: 10 });
  });
  it('seleção invertida ou fora do texto é ajustada', () => {
    expect(inserirCampo('ab', { inicio: 99, fim: 99 }, 'data')).toEqual({ texto: 'ab{data}', cursor: 8 });
    expect(inserirCampo('abcd', { inicio: 3, fim: 1 }, 'data')).toEqual({ texto: 'a{data}d', cursor: 7 });
    expect(inserirCampo('', { inicio: 0, fim: 0 }, 'data')).toEqual({ texto: '{data}', cursor: 6 });
  });
});

describe('selos', () => {
  // 2026-11-30T02:59:59Z é 29/11 em Brasília (o prazo é o fim do dia de lá).
  const prazo = '2026-11-30T02:59:59Z';
  it('equipe', () => {
    expect(seloDoContrato({ situacao: 'PENDENTE', prazoAte: prazo, vencido: true })).toEqual({ texto: 'Prazo vencido', tipo: 'perigo' });
    expect(seloDoContrato({ situacao: 'PENDENTE', prazoAte: prazo, vencido: false })).toEqual({ texto: 'Pendente · até 29/11', tipo: 'atencao' });
    expect(seloDoContrato({ situacao: 'PENDENTE', prazoAte: null, vencido: false })).toEqual({ texto: 'Pendente', tipo: 'atencao' });
    expect(seloDoContrato({ situacao: 'ASSINADO', prazoAte: prazo, vencido: false })).toEqual({ texto: 'Assinado', tipo: 'sucesso' });
    expect(seloDoContrato({ situacao: 'CANCELADO', vencido: false })).toEqual({ texto: 'Cancelado', tipo: 'neutro' });
  });
  it('aluno', () => {
    expect(seloDoContratoDoAluno({ situacao: 'PENDENTE', prazoAte: prazo, vencido: true })).toEqual({ texto: 'Prazo terminou', tipo: 'perigo' });
    expect(seloDoContratoDoAluno({ situacao: 'PENDENTE', prazoAte: prazo, vencido: false })).toEqual({ texto: 'Assine até 29/11', tipo: 'atencao' });
    expect(seloDoContratoDoAluno({ situacao: 'PENDENTE', prazoAte: null, vencido: false })).toEqual({ texto: 'Para assinar', tipo: 'atencao' });
    expect(seloDoContratoDoAluno({ situacao: 'ASSINADO', vencido: false })).toEqual({ texto: 'Assinado', tipo: 'sucesso' });
  });
});

describe('acoesDoContrato', () => {
  const tudo = () => true;
  const soLer = (p: string) => p === 'CONTRATO_LER';
  const nada = () => false;
  it('assinado: só o comprovante, com CONTRATO_LER', () => {
    expect(acoesDoContrato({ situacao: 'ASSINADO' }, tudo)).toEqual([{ id: 'comprovante', rotulo: 'Baixar comprovante' }]);
    expect(acoesDoContrato({ situacao: 'ASSINADO' }, nada)).toEqual([]);
  });
  it('pendente com prazo: prorrogar e cancelar (perigo), só com CONTRATO_ALTERAR', () => {
    expect(acoesDoContrato({ situacao: 'PENDENTE', prazoAte: '2026-12-01T02:59:59Z' }, tudo)).toEqual([
      { id: 'prorrogar', rotulo: 'Prorrogar prazo' }, { id: 'cancelar', rotulo: 'Cancelar contrato', perigo: true },
    ]);
    expect(acoesDoContrato({ situacao: 'PENDENTE', prazoAte: '2026-12-01T02:59:59Z' }, soLer)).toEqual([]);
  });
  it('pendente sem prazo não prorroga', () => {
    expect(acoesDoContrato({ situacao: 'PENDENTE', prazoAte: null }, tudo).map((a) => a.id)).toEqual(['cancelar']);
  });
  it('cancelado não tem ação', () => {
    expect(acoesDoContrato({ situacao: 'CANCELADO' }, tudo)).toEqual([]);
  });
});

describe('faltas da prévia', () => {
  const faltas = [{ campo: 'plano', mensagem: 'x' }];
  it('a nota só com falta do Financeiro e sem FINANCEIRO_LER', () => {
    expect(notaDasFaltas(faltas, false)).toBe(TEXTO_DA_NOTA_DAS_FALTAS);
    expect(notaDasFaltas(faltas, true)).toBeNull();
    expect(notaDasFaltas([{ campo: 'aluno_cpf', mensagem: 'x' }], false)).toBeNull();
    expect(notaDasFaltas([], false)).toBeNull();
  });
  it('completar o cadastro: falta de CPF ou endereço e ALUNO_SENSIVEL_ALTERAR', () => {
    const pode = (p: string) => p === 'ALUNO_SENSIVEL_ALTERAR';
    expect(podeCompletarOCadastro([{ campo: 'aluno_endereco', mensagem: 'x' }], pode)).toBe(true);
    expect(podeCompletarOCadastro([{ campo: 'aluno_cpf', mensagem: 'x' }], () => false)).toBe(false);
    expect(podeCompletarOCadastro(faltas, pode)).toBe(false);
  });
});

describe('contratação', () => {
  const c = (parcial: Partial<ContratacaoResponse>) => ({
    id: 'c', alunoId: 'a', planoComercialId: 'p', planoNome: 'Plano Mensal', periodicidade: 'MENSAL', valorCentavos: 30000, motivoValor: null,
    inicio: '2026-10-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null, criadoEm: '', versao: 1, minimoAte: null, ...parcial,
  }) as ContratacaoResponse;

  it('rótulo com plano, periodicidade, valor e início; pausada avisa', () => {
    expect(rotuloDaContratacao(c({}))).toBe('Plano Mensal · Mensal · R$ 300,00 · desde 05/10/2026');
    expect(rotuloDaContratacao(c({ situacao: 'PAUSADA' }))).toBe('Plano Mensal · Mensal · R$ 300,00 · desde 05/10/2026 · pausada');
    expect(rotuloDaContratacao(c({ planoNome: null }))).toContain('Plano · ');
  });

  it('só ATIVA e PAUSADA; o padrão é a única ATIVA', () => {
    const lista = [c({ id: 'enc', situacao: 'ENCERRADA' }), c({ id: 'pau', situacao: 'PAUSADA' }), c({ id: 'ati' })];
    expect(contratacoesParaEscolher(lista)).toMatchObject({ padraoId: 'ati' });
    expect(contratacoesParaEscolher(lista).opcoes.map((x) => x.id)).toEqual(['ati', 'pau']);
  });
  it('duas ATIVAS, só PAUSADA ou lista ausente: sem padrão', () => {
    expect(contratacoesParaEscolher([c({ id: 'a1' }), c({ id: 'a2' })]).padraoId).toBeNull();
    expect(contratacoesParaEscolher([c({ id: 'p', situacao: 'PAUSADA' })])).toMatchObject({ padraoId: null });
    expect(contratacoesParaEscolher(null)).toEqual({ opcoes: [], padraoId: null });
  });
});

describe('evidências', () => {
  it('instante de Brasília com segundos', () => {
    expect(instanteDeBrasilia('2026-11-26T17:03:09.123456Z')).toBe('26/11/2026 às 14:03:09');
    expect(instanteDeBrasilia('2026-11-27T01:00:00Z')).toBe('26/11/2026 às 22:00:00');
    expect(instanteDeBrasilia('lixo')).toBe('');
    expect(instanteDeBrasilia(null)).toBe('');
  });

  const hash = 'a'.repeat(64);
  const base = { nome: 'Maria Aluna', assinadoEm: '2026-11-26T17:03:09Z', sha256: hash };

  it('versão do aluno: sem IP, aparelho e quem gerou', () => {
    expect(linhasDeEvidencia(base)).toEqual([
      { rotulo: 'Assinado por', valor: 'Maria Aluna' },
      { rotulo: 'Data e hora', valor: '26/11/2026 às 14:03:09 (horário de Brasília)' },
      { rotulo: 'Código de verificação (SHA-256)', valor: hash },
    ]);
  });
  it('versão da equipe: IP, aparelho e quem gerou; vazio diz "Não registrado"', () => {
    const l = linhasDeEvidencia({ ...base, ip: '203.0.113.7', agente: '', geradoPorNome: 'Treinador' });
    expect(l.map((x) => x.rotulo)).toEqual(['Assinado por', 'Data e hora', 'IP', 'Aparelho', 'Gerado por', 'Código de verificação (SHA-256)']);
    expect(l.find((x) => x.rotulo === 'IP')?.valor).toBe('203.0.113.7');
    expect(l.find((x) => x.rotulo === 'Aparelho')?.valor).toBe('Não registrado');
  });
  it('ausente (nulo) some; o código de verificação sai inteiro, sem ser recalculado', () => {
    const l = linhasDeEvidencia({ ...base, ip: null, agente: undefined, geradoPorNome: null });
    expect(l.map((x) => x.rotulo)).toEqual(['Assinado por', 'Data e hora', 'Código de verificação (SHA-256)']);
    expect(l[2].valor).toBe(hash);
  });
});

describe('htmlDoTextoFormatado', () => {
  it('negrito, sublinhado, linhas e parágrafos', () => {
    expect(htmlDoTextoFormatado('**Cláusula 1**\nTexto __importante__ aqui\n\nSegundo')).toBe(
      '<p><strong>Cláusula 1</strong><br>Texto <u>importante</u> aqui</p><p>Segundo</p>',
    );
  });
  it('tudo escapado: texto não vira marcação', () => {
    const html = htmlDoTextoFormatado('**<img src=x onerror=alert(1)>** & "a"');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;a&quot;');
  });
  it('vazio ou nulo, nada', () => {
    expect(htmlDoTextoFormatado('')).toBe('');
    expect(htmlDoTextoFormatado(null)).toBe('');
  });
});
