import type { PlanoResumo } from '../api/tipos';
import { avisoDosTiposSemAcesso, motivoDosProblemas, pendentesDaPasta, periodoDaFolhaDaPasta, situacaoDaPasta, textoDasAlteracoes, tituloDaFolhaDaPasta } from './folhaDaPasta';

const HOJE = '2026-11-27';
const VENCIDA = { id: 'f1', titulo: 'Plano 17', inicio: '2026-11-01', fim: '2026-11-11', concluidaEm: null };
const PLANO: PlanoResumo = {
  id: 'p1', alunoId: 'a1', pastaId: 'f1', titulo: 'Treino', inicio: null, fim: null, ativo: false, versaoPublicada: 0,
  publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};

describe('folha da pasta', () => {
  it('título é a pasta pelo período, nunca o nome técnico', () => {
    expect(tituloDaFolhaDaPasta(VENCIDA, HOJE)).toBe('Pasta de 01/11 a 11/11');
    expect(tituloDaFolhaDaPasta({ inicio: '2025-12-20', fim: '2026-01-10' }, HOJE)).toBe('Pasta de 20/12/2025 a 10/01/2026');
    expect(tituloDaFolhaDaPasta({ inicio: null, fim: null }, HOJE)).toBe('Pasta sem período');
  });

  it('período com a contagem de dias', () => {
    expect(periodoDaFolhaDaPasta(VENCIDA, HOJE)).toBe('01/11 a 11/11 · 11 dias');
    expect(periodoDaFolhaDaPasta({ inicio: '2026-11-05', fim: '2026-11-05' }, HOJE)).toBe('05/11 a 05/11 · 1 dia');
    expect(periodoDaFolhaDaPasta({ inicio: '2026-11-05', fim: null }, HOJE)).toBe('05/11 a —');
    expect(periodoDaFolhaDaPasta({ inicio: null, fim: null }, HOJE)).toBe('Período não definido');
  });

  it('um selo só: concluída > vencida (regra da lista) > período encerrado > vigente da API', () => {
    const so = [VENCIDA];
    // A vigente que acabou, ou a que acabou sem a pasta seguinte (pede renovação): vermelho.
    expect(situacaoDaPasta(VENCIDA, so, true, HOJE)).toEqual({ texto: 'Vencida há 16 dias', tipo: 'perigo' });
    expect(situacaoDaPasta(VENCIDA, so, false, HOJE)).toEqual({ texto: 'Vencida há 16 dias', tipo: 'perigo' });
    // Antiga já renovada (existe a seguinte) e não vigente: neutro, sem vermelho.
    const seguinte = { id: 'f2', titulo: 'Plano 18', inicio: '2026-11-12', fim: '2026-11-26', concluidaEm: null };
    expect(situacaoDaPasta(VENCIDA, [VENCIDA, seguinte], false, HOJE)).toEqual({ texto: 'Período encerrado em 11/11', tipo: 'neutro' });
    // A vigente vencida continua vermelha mesmo renovada.
    expect(situacaoDaPasta(VENCIDA, [VENCIDA, seguinte], true, HOJE)?.tipo).toBe('perigo');
    expect(situacaoDaPasta({ ...VENCIDA, concluidaEm: '2026-11-12T15:00:00Z' }, so, false, HOJE)?.tipo).toBe('neutro');
    // "Vigente" só quando a API diz, nunca por data.
    const noPeriodo = { ...VENCIDA, inicio: '2026-11-20', fim: '2026-11-30' };
    expect(situacaoDaPasta(noPeriodo, [noPeriodo], true, HOJE)).toEqual({ texto: 'Vigente', tipo: 'sucesso' });
    expect(situacaoDaPasta(noPeriodo, [noPeriodo], false, HOJE)).toBeNull();
    const futura = { ...VENCIDA, inicio: '2026-12-01', fim: '2026-12-15' };
    expect(situacaoDaPasta(futura, [futura], false, HOJE)).toBeNull();
    const semDatas = { ...VENCIDA, inicio: null, fim: null };
    expect(situacaoDaPasta(semDatas, [semDatas], true, HOJE)?.texto).toBe('Vigente');
    expect(situacaoDaPasta(semDatas, [semDatas], false, HOJE)).toBeNull();
  });

  it('aviso do tipo que a pessoa não vê nem pode publicar', () => {
    const so = (codigos: string[]) => (c: string) => codigos.includes(c);
    const planos = { treino: null, dieta: [PLANO], mobilidade: [] };
    expect(avisoDosTiposSemAcesso(planos, {}, so(['DIETA_PUBLICAR']))).toBe('Você não vê o treino desta pasta: se houver alteração nele, nada é publicado.');
    expect(avisoDosTiposSemAcesso(planos, {}, so(['DIETA_PUBLICAR', 'TREINO_PUBLICAR']))).toBeNull();
    // Lista que falhou não é "sem acesso": tem o "Tentar de novo".
    expect(avisoDosTiposSemAcesso(planos, { treino: true }, so([]))).toBeNull();
    expect(avisoDosTiposSemAcesso({ treino: null, dieta: null, mobilidade: [] }, {}, so([]))).toBe('Você não vê o treino e a dieta desta pasta: se houver alteração neles, nada é publicado.');
    expect(avisoDosTiposSemAcesso(null, {}, so([]))).toBeNull();
  });

  it('pendentes só das listas conhecidas, na ordem dos tipos', () => {
    const rascunho = { ...PLANO, id: 'r' };
    const alterado = { ...PLANO, id: 'a', versaoPublicada: 2, rascunhoAlteradoDepoisDePublicar: true };
    const publicado = { ...PLANO, id: 'ok', versaoPublicada: 2 };
    expect(pendentesDaPasta({ treino: [publicado, alterado], dieta: null, mobilidade: [rascunho] }).map((p) => `${p.tipo}:${p.plano.id}`))
      .toEqual(['treino:a', 'mobilidade:r']);
    expect(pendentesDaPasta(null)).toEqual([]);
    expect(textoDasAlteracoes(1)).toBe('1 alteração para publicar');
    expect(textoDasAlteracoes(2)).toBe('2 alterações para publicar');
    expect(textoDasAlteracoes(1, true)).toBe('Pelo menos 1 alteração para publicar');
  });

  it('motivo do botão depois de um 422', () => {
    const um = { mensagem: 'x' };
    expect(motivoDosProblemas([{ tipo: 'treino', problemas: [um] }])).toBe('Corrija 1 problema no treino');
    expect(motivoDosProblemas([{ tipo: 'treino', problemas: [um, um] }, { tipo: 'dieta', problemas: [um] }])).toBe('Corrija 3 problemas no treino e na dieta');
    expect(motivoDosProblemas([{ tipo: null, problemas: [um, um] }])).toBe('Corrija 2 problemas antes de publicar');
    expect(motivoDosProblemas([])).toBeNull();
  });
});
