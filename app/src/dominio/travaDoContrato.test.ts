import { ErroApi } from '@plataforma/web';

import type { ContratoDoAlunoResumo } from '../api/contratos';
import { contratoQueTrava, ehContratoPendente, ERRO_DO_PRAZO, lerPrazoDias, situacaoDaTrava, textoDoPrazo } from './travaDoContrato';

const contrato = (id: string, p: Partial<ContratoDoAlunoResumo> = {}): ContratoDoAlunoResumo => ({
  id, titulo: 'Prestação de serviço', origem: 'MODELO', signatario: 'ALUNO', situacao: 'PENDENTE', prazoAte: '2026-11-20T02:59:59Z',
  vencido: true, geradoEm: '2026-11-10T12:00:00Z', assinadoEm: null, ...p,
});

describe('ehContratoPendente', () => {
  it('só o 403 com o código CONTRATO_PENDENTE', () => {
    expect(ehContratoPendente(new ErroApi(403, 'CONTRATO_PENDENTE', 'Assine o contrato.'))).toBe(true);
    expect(ehContratoPendente(new ErroApi(403, 'ACESSO_PAUSADO_POR_ATRASO', 'Pausado.'))).toBe(false);
    expect(ehContratoPendente(new ErroApi(409, 'CONTRATO_PENDENTE', 'Outro.'))).toBe(false);
    expect(ehContratoPendente(new Error('CONTRATO_PENDENTE'))).toBe(false);
  });
});

describe('contratoQueTrava', () => {
  it('o vencido do aluno com o prazo mais antigo; empate pelo gerado antes', () => {
    const a = contrato('a', { prazoAte: '2026-11-22T02:59:59Z' });
    const b = contrato('b', { prazoAte: '2026-11-18T02:59:59Z', geradoEm: '2026-11-09T12:00:00Z' });
    const c = contrato('c', { prazoAte: '2026-11-18T02:59:59Z', geradoEm: '2026-11-08T12:00:00Z' });
    expect(contratoQueTrava([a, b, c])?.id).toBe('c');
  });

  it('ignora o do responsável, o não vencido, o assinado e a lista vazia ou ausente', () => {
    expect(contratoQueTrava([
      contrato('r', { signatario: 'RESPONSAVEL' }),
      contrato('n', { vencido: false }),
      contrato('s', { situacao: 'ASSINADO', assinadoEm: '2026-11-21T12:00:00Z' }),
    ])).toBeNull();
    expect(contratoQueTrava([])).toBeNull();
    expect(contratoQueTrava(undefined)).toBeNull();
  });
});

describe('situacaoDaTrava', () => {
  const base = { contratoPendenteVencido: true, acessoPausado: false };

  it('sem a marca: pausa ou nenhuma, como antes', () => {
    expect(situacaoDaTrava({ contratoPendenteVencido: false, acessoPausado: true, contratos: [contrato('a')] })).toEqual({ tela: 'pausa' });
    expect(situacaoDaTrava({ contratoPendenteVencido: false, acessoPausado: false })).toEqual({ tela: 'nenhuma' });
  });

  it('com a marca, a do contrato vem antes da pausa (D21) e guarda a pausa para a frase de baixo', () => {
    expect(situacaoDaTrava({ contratoPendenteVencido: true, acessoPausado: true, contratos: [contrato('a')] }))
      .toEqual({ tela: 'contrato', comPausa: true, variante: 'assinar', contratoId: 'a' });
  });

  it('lista ainda não chegou: semLista', () => {
    expect(situacaoDaTrava({ ...base, contratos: undefined })).toEqual({ tela: 'contrato', comPausa: false, variante: 'semLista' });
  });

  it('só vencidos do responsável: aguardaResponsavel (D8), mesmo com o do aluno no prazo ou assinado (par de 16 a 17)', () => {
    expect(situacaoDaTrava({ ...base, contratos: [
      contrato('r', { signatario: 'RESPONSAVEL' }),
      contrato('a', { situacao: 'ASSINADO', assinadoEm: '2026-11-21T12:00:00Z' }),
      contrato('n', { vencido: false }),
    ] })).toMatchObject({ variante: 'aguardaResponsavel' });
  });

  it('com vencido do aluno e do responsável, assinar o do aluno', () => {
    expect(situacaoDaTrava({ ...base, contratos: [contrato('r', { signatario: 'RESPONSAVEL' }), contrato('a')] }))
      .toEqual({ tela: 'contrato', comPausa: false, variante: 'assinar', contratoId: 'a' });
  });

  it('lista sem vencido: semVencido (a marca do perfil está velha)', () => {
    expect(situacaoDaTrava({ ...base, contratos: [] })).toMatchObject({ variante: 'semVencido' });
    expect(situacaoDaTrava({ ...base, contratos: [contrato('n', { vencido: false })] })).toMatchObject({ variante: 'semVencido' });
  });
});

describe('prazo', () => {
  it('aceita inteiro de 1 a 60, com espaço ou "dias" junto', () => {
    expect(lerPrazoDias('15')).toEqual({ valor: 15, erro: null });
    expect(lerPrazoDias(' 1 ')).toEqual({ valor: 1, erro: null });
    expect(lerPrazoDias('60 dias')).toEqual({ valor: 60, erro: null });
    expect(lerPrazoDias('030')).toEqual({ valor: 30, erro: null });
  });

  it('recusa vazio, zero, acima de 60, fração e texto', () => {
    for (const t of ['', '0', '61', '7,5', '7.5', '-3', 'dez']) expect(lerPrazoDias(t)).toEqual({ valor: null, erro: ERRO_DO_PRAZO });
  });

  it('texto de leitura', () => {
    expect(textoDoPrazo(null)).toBe('Não trava o acesso');
    expect(textoDoPrazo(1)).toBe('Trava o acesso depois de 1 dia');
    expect(textoDoPrazo(15)).toBe('Trava o acesso depois de 15 dias');
  });
});
