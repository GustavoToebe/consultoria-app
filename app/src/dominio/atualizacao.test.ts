import type { Atualizacao } from '../api/tipos';
import { atrasoEmTexto, DIAS_MAXIMOS_PARA_CONTAR_ATRASO, desdeQuandoAtrasou, statusAtualizacao, atualizacaoDaPasta, caminhoAtualizacaoTreinador, caminhoListaAtualizacoes, faseAtualizacao, filaDosParametros, filtroDaFila, formularioSomenteLeitura, limitesNovaDataAtraso, linkCartaoAtualizacao, mostrarCartaoAtualizacao, novaDataAtrasoValida, emDias, fraseDeTreinosNoPeriodo, proximaDaFila, statusAtualizacaoTreinador } from './atualizacao';

describe('datas da atualização iguais às do servidor', () => {
  it.each([['2026-10-05','NENHUMA',4,0],['2026-10-06','AVISO',3,0],['2026-10-07','AVISO',2,0],
    ['2026-10-08','ABERTA',1,0],['2026-10-09','ABERTA',0,0],['2026-10-10','ATRASADA',-1,1]])(
    '%s: %s', (hoje,fase,diasParaData,diasDeAtraso) => {
      expect(faseAtualizacao(hoje,'2026-10-09',null)).toEqual({fase,diasParaData,diasDeAtraso});
    });
  it('aviso de atraso adia só o "atrasada"; o formulário abre pela data original', () => {
    expect(faseAtualizacao('2026-10-08','2026-10-09','2026-10-14').fase).toBe('ABERTA');
    expect(faseAtualizacao('2026-10-10','2026-10-09','2026-10-12')).toEqual({fase:'ABERTA',diasParaData:2,diasDeAtraso:0});
    expect(faseAtualizacao('2026-10-12','2026-10-09','2026-10-12').fase).toBe('ABERTA');
    expect(faseAtualizacao('2026-10-13','2026-10-09','2026-10-12')).toEqual({fase:'ATRASADA',diasParaData:-1,diasDeAtraso:1});
    expect(faseAtualizacao('2026-10-10','2026-10-09','2026-10-07').fase).toBe('ATRASADA');
  });
  it('envio preserva o estado', () => {
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'ENVIADA').fase).toBe('ENVIADA');
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'REVISADA').fase).toBe('REVISADA');
    expect(faseAtualizacao('2026-10-20',null,null).fase).toBe('NENHUMA');
  });
});

it('próxima atualização sem linha abre a prévia do aluno em vez de um id nulo',()=>{
  expect(caminhoAtualizacaoTreinador({id:null,alunoId:'a1'})).toBe('/treinador/atualizacoes/previa?alunoId=a1');
  expect(caminhoAtualizacaoTreinador({id:'c1',alunoId:'a1'})).toBe('/treinador/atualizacoes/c1');
});

describe('nova data do "vou atrasar" igual à API', () => {
  it('fica entre a data original (ou hoje, se já passou) e quinze dias depois', () => {
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-08')).toBe(false);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-09')).toBe(true);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-24')).toBe(true);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-25')).toBe(false);
    expect(novaDataAtrasoValida('2026-10-12','2026-10-09','2026-10-11')).toBe(false);
    expect(limitesNovaDataAtraso('2026-10-12','2026-10-09')).toEqual({minimo:'2026-10-12',maximo:'2026-10-24'});
  });
  it('com o aviso dado o cartão continua visível', () => {
    const base = {fase:'NENHUMA',atrasoAte:null,feedback:null} as unknown as Atualizacao;
    expect(mostrarCartaoAtualizacao(base)).toBe(false);
    expect(mostrarCartaoAtualizacao({...base,atrasoAte:'2026-10-20'})).toBe(true);
    expect(mostrarCartaoAtualizacao({...base,fase:'ABERTA'})).toBe(true);
    expect(mostrarCartaoAtualizacao({...base,fase:'REVISADA'})).toBe(false);
  });
});

it('atualização aberta pelo histórico que não é a atual fica só leitura', () => {
  expect(formularioSomenteLeitura(undefined,'atual')).toBe(false);
  expect(formularioSomenteLeitura('atual','atual')).toBe(false);
  expect(formularioSomenteLeitura('antiga','atual')).toBe(true);
  expect(formularioSomenteLeitura('antiga',null)).toBe(true);
});

it('antes da véspera o cartão convida a ver o que vai responder, inclusive com atraso avisado', () => {
  const base = {fase:'NENHUMA',atrasoAte:'2026-10-20',feedback:null} as unknown as Atualizacao;
  expect(linkCartaoAtualizacao(base)).toBe('Ver o que vou responder');
  expect(linkCartaoAtualizacao({...base,fase:'AVISO'})).toBe('Ver o que vou responder');
  expect(linkCartaoAtualizacao({...base,fase:'ENVIADA'})).toBe('Ver respostas');
  expect(linkCartaoAtualizacao({...base,fase:'REVISADA',feedback:{texto:'x',em:'',editadoEm:null,naoLido:true,nomeAutor:null}})).toBe('Ler');
});

it('cada pasta mostra a própria atualização: a vigente (mesmo sem linha gravada) ou a do histórico', () => {
  const a = (id: string | null, pastaId: string) => ({id,pastaId}) as unknown as Atualizacao;
  const atual = a(null,'p2');
  const historico = [a('h1','p1'), a('h0','p0')];
  expect(atualizacaoDaPasta('p2',atual,historico)).toBe(atual);
  expect(atualizacaoDaPasta('p1',atual,historico)?.id).toBe('h1');
  expect(atualizacaoDaPasta('p9',atual,historico)).toBeNull();
  expect(atualizacaoDaPasta('p1',null,historico)?.id).toBe('h1');
});
it('a lista aberta pelo contador leva o escopo "Meus alunos"', () => {
  expect(caminhoListaAtualizacoes('PARA_REVISAR', true)).toBe('/treinador/atualizacoes?situacao=PARA_REVISAR&meus=true');
  expect(caminhoListaAtualizacoes('ATRASADAS', false)).toBe('/treinador/atualizacoes?situacao=ATRASADAS');
});

describe('revisão em fila', () => {
  it('o endereço leva a lista de origem; sem fila fica como era', () => {
    const fila = { situacao: 'PARA_REVISAR' as const, meus: true };
    expect(caminhoAtualizacaoTreinador({ id: 'c1', alunoId: 'a1' }, fila)).toBe('/treinador/atualizacoes/c1?situacao=PARA_REVISAR&meus=true');
    expect(caminhoAtualizacaoTreinador({ id: 'c1', alunoId: 'a1' }, { situacao: 'ATRASADAS', meus: false })).toBe('/treinador/atualizacoes/c1?situacao=ATRASADAS');
    expect(caminhoAtualizacaoTreinador({ id: null, alunoId: 'a1' }, fila)).toBe('/treinador/atualizacoes/previa?alunoId=a1&situacao=PARA_REVISAR&meus=true');
    expect(caminhoAtualizacaoTreinador({ id: 'c1', alunoId: 'a1' }, null)).toBe('/treinador/atualizacoes/c1');
  });

  it('só aceita situação conhecida', () => {
    expect(filaDosParametros('PROXIMAS', 'true')).toEqual({ situacao: 'PROXIMAS', meus: true });
    expect(filaDosParametros('AVISARAM_ATRASO', undefined)).toEqual({ situacao: 'AVISARAM_ATRASO', meus: false });
    expect(filaDosParametros('QUALQUER', 'true')).toBeNull();
    expect(filaDosParametros(undefined, 'true')).toBeNull();
    // Responsável e período da barra de filtros vão junto; com Meus o responsável não vale (a API recusa os dois).
    const id = 'u0000000-0000-4000-8000-000000000007';
    expect(filaDosParametros('PARA_REVISAR', undefined, { responsavel: id, de: '2026-10-01', ate: '2026-10-31' }))
      .toEqual({ situacao: 'PARA_REVISAR', meus: false, responsavel: id, de: '2026-10-01', ate: '2026-10-31' });
    expect(filaDosParametros('PARA_REVISAR', 'true', { responsavel: id, de: '2026-10-01' })).toEqual({ situacao: 'PARA_REVISAR', meus: true });
    expect(filaDosParametros('PARA_REVISAR', undefined, { responsavel: '../x' })).toEqual({ situacao: 'PARA_REVISAR', meus: false });
    const fila = { situacao: 'ATRASADAS' as const, meus: false, responsavel: id, de: '2026-10-01', ate: '2026-10-31' };
    expect(caminhoAtualizacaoTreinador({ id: 'c1', alunoId: 'a1' }, fila))
      .toBe(`/treinador/atualizacoes/c1?situacao=ATRASADAS&responsavel=${id}&de=2026-10-01&ate=2026-10-31`);
    expect(caminhoListaAtualizacoes('ATRASADAS', false, fila)).toBe(`/treinador/atualizacoes?situacao=ATRASADAS&responsavel=${id}&de=2026-10-01&ate=2026-10-31`);
    // Lote 2: vários responsáveis (com "nenhum") e a busca vão junto; algo estranho na lista derruba o filtro inteiro.
    const varios = filaDosParametros('ATRASADAS', undefined, { responsavel: `${id},nenhum`, busca: ' ana ' });
    expect(varios).toEqual({ situacao: 'ATRASADAS', meus: false, responsavel: `${id},nenhum`, busca: 'ana' });
    expect(caminhoAtualizacaoTreinador({ id: 'c1', alunoId: 'a1' }, varios))
      .toBe(`/treinador/atualizacoes/c1?situacao=ATRASADAS&responsavel=${encodeURIComponent(`${id},nenhum`)}&busca=ana`);
    expect(filtroDaFila(varios!)).toEqual({ responsavel: [id, 'nenhum'], busca: 'ana' });
    expect(filaDosParametros('ATRASADAS', undefined, { responsavel: `${id},../x` })).toEqual({ situacao: 'ATRASADAS', meus: false });
  });

  it('a próxima é a primeira diferente da atual; fila acabou = nula', () => {
    const itens = [{ pastaId: 'p1' }, { pastaId: 'p2' }, { pastaId: 'p3' }];
    expect(proximaDaFila(itens, 'p1')?.pastaId).toBe('p2');
    expect(proximaDaFila(itens, 'p2')?.pastaId).toBe('p1');
    expect(proximaDaFila(itens, null)?.pastaId).toBe('p1');
    expect(proximaDaFila([{ pastaId: 'p1' }], 'p1')).toBeNull();
    expect(proximaDaFila([], 'p1')).toBeNull();
  });
});

describe('atraso com teto (C76)', () => {
  const HOJE = '2026-11-02';
  it('até 365 dias conta os dias; acima disso diz desde quando, sem somar anos de dias', () => {
    expect(DIAS_MAXIMOS_PARA_CONTAR_ATRASO).toBe(365);
    expect(atrasoEmTexto(1, HOJE)).toBe('há 1 dia');
    expect(atrasoEmTexto(365, HOJE)).toBe('há 365 dias');
    expect(atrasoEmTexto(366, HOJE)).toBe('desde 01/11/2025');
    expect(atrasoEmTexto(644943, HOJE)).toBe(`desde ${desdeQuandoAtrasou(644943, HOJE)}`);
    expect(atrasoEmTexto(644943, HOJE)).not.toContain('644943');
  });
  it('o texto do aluno e do treinador seguem a mesma regra', () => {
    const base = { fase: 'ATRASADA', diasDeAtraso: 400, diasParaData: -400, atrasoAte: null } as const;
    expect(statusAtualizacaoTreinador(base, HOJE)).toEqual({ texto: 'Atualização atrasada desde 28/09/2025', curto: 'Atrasada desde 28/09/2025', tipo: 'perigo' });
    expect(statusAtualizacao({ ...base, dataAtualizacao: '2025-09-28', feedback: null } as unknown as Atualizacao, HOJE))
      .toEqual({ texto: 'Atualização atrasada desde 28/09/2025', tipo: 'perigo' });
    expect(statusAtualizacao({ ...base, diasDeAtraso: 3, dataAtualizacao: '2026-10-30', feedback: null } as unknown as Atualizacao, HOJE).texto).toBe('Atualização atrasada há 3 dias');
  });
});

describe('selo da atualização para o treinador', () => {
  const base = { fase: 'NENHUMA' as const, diasDeAtraso: 0, diasParaData: 15, atrasoAte: null };
  it('diz de quê no texto e fica curto onde o assunto já é a atualização', () => {
    expect(statusAtualizacaoTreinador(base, '2026-10-19')).toEqual({ texto: 'Atualização em 15 dias', curto: 'Em 15 dias', tipo: 'neutro' });
    expect(statusAtualizacaoTreinador({ ...base, fase: 'ENVIADA' })).toMatchObject({ texto: 'Atualização para revisar', curto: 'Para revisar', tipo: 'atencao' });
    expect(statusAtualizacaoTreinador({ ...base, fase: 'REVISADA' })).toMatchObject({ curto: 'Revisada', tipo: 'sucesso' });
  });
  it('atraso, adiamento e distância relativa', () => {
    expect(statusAtualizacaoTreinador({ ...base, fase: 'ATRASADA', diasDeAtraso: 1 })).toMatchObject({ texto: 'Atualização atrasada há 1 dia', tipo: 'perigo' });
    expect(statusAtualizacaoTreinador({ ...base, fase: 'ABERTA', atrasoAte: '2026-10-20' }, '2026-10-19')).toMatchObject({ texto: 'Atualização adiada para amanhã', curto: 'Adiada para amanhã' });
    expect(statusAtualizacaoTreinador({ ...base, fase: 'ABERTA', diasParaData: 0 })).toMatchObject({ texto: 'Atualização hoje', curto: 'Hoje' });
    expect(statusAtualizacaoTreinador({ ...base, fase: 'ABERTA', diasParaData: 1 })).toMatchObject({ curto: 'Amanhã' });
  });
  it('adiada: hoje e amanhã por extenso, o resto pela data (nunca "para em 5 dias")', () => {
    const adiada = (atrasoAte: string) => statusAtualizacaoTreinador({ ...base, fase: 'ABERTA', atrasoAte }, '2026-10-19');
    expect(adiada('2026-10-19')).toMatchObject({ texto: 'Atualização adiada para hoje', curto: 'Adiada para hoje', tipo: 'neutro' });
    expect(adiada('2026-10-24')).toMatchObject({ texto: 'Atualização adiada para 24/10', curto: 'Adiada para 24/10' });
    expect(adiada('2026-11-01')).toMatchObject({ texto: 'Atualização adiada para 01/11', curto: 'Adiada para 01/11' });
    expect(adiada('2027-01-02')).toMatchObject({ texto: 'Atualização adiada para 02/01/2027', curto: 'Adiada para 02/01/2027' });
  });
  it('emDias', () => {
    expect([emDias(0), emDias(1), emDias(-1), emDias(4), emDias(-3)]).toEqual(['hoje', 'amanhã', 'ontem', 'em 4 dias', 'há 3 dias']);
  });
});

describe('fraseDeTreinosNoPeriodo (N17)', () => {
  it('diz quantos treinos e a média por semana', () => {
    expect(fraseDeTreinosNoPeriodo(1, 0.2)).toBe('1 treino registrado no período (≈0,2 por semana)');
    expect(fraseDeTreinosNoPeriodo(8, 4)).toBe('8 treinos registrados no período (≈4 por semana)');
    expect(fraseDeTreinosNoPeriodo(0, 0)).toBe('Nenhum treino registrado no período (≈0 por semana)');
  });

  it('sem média só os treinos; sem dado do período, "—"', () => {
    expect(fraseDeTreinosNoPeriodo(3, null)).toBe('3 treinos registrados no período');
    expect(fraseDeTreinosNoPeriodo(null, null)).toBe('Treinos registrados no período: —');
    expect(fraseDeTreinosNoPeriodo(undefined, undefined)).toBe('Treinos registrados no período: —');
    expect(fraseDeTreinosNoPeriodo(3, undefined)).toBe('3 treinos registrados no período');
  });
});
