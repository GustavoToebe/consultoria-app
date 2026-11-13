import { AGENDA_SEM_FILTRO, chipsDaAgenda, enderecoDaAgenda, lerFiltrosDaAgenda, semOFiltroDaAgenda } from './filtrosDaAgenda';

const tudo = { agenda: true, equipe: true };
const nomes: Record<string, string> = { m1: 'Bruno Equipe' };
const nomeDe = (id: string) => nomes[id];

describe('filtros da agenda', () => {
  it('lê o endereço: meus vence membro; membro só com a equipe; situação só com a agenda', () => {
    expect(lerFiltrosDaAgenda({}, tudo)).toEqual(AGENDA_SEM_FILTRO);
    expect(lerFiltrosDaAgenda({ meus: 'true', membro: 'm1' }, tudo).responsavel).toBe('meus');
    expect(lerFiltrosDaAgenda({ membro: 'm1' }, tudo).responsavel).toBe('m1');
    expect(lerFiltrosDaAgenda({ membro: 'm1' }, { agenda: true, equipe: false }).responsavel).toBe('');
    expect(lerFiltrosDaAgenda({ situacao: 'FALTOU,AGENDADO' }, tudo).situacoes).toEqual(['AGENDADO', 'FALTOU']);
    expect(lerFiltrosDaAgenda({ situacao: 'AGENDADO' }, { agenda: false, equipe: true }).situacoes).toEqual([]);
  });

  it('volta ao endereço: um dos dois de responsável; as quatro situações = sem parâmetro', () => {
    expect(enderecoDaAgenda(AGENDA_SEM_FILTRO)).toEqual({ meus: undefined, membro: undefined, situacao: undefined });
    expect(enderecoDaAgenda({ responsavel: 'meus', situacoes: [] }).meus).toBe('true');
    expect(enderecoDaAgenda({ responsavel: 'm1', situacoes: ['FALTOU', 'AGENDADO'] })).toEqual({ meus: undefined, membro: 'm1', situacao: 'AGENDADO,FALTOU' });
    expect(enderecoDaAgenda({ responsavel: '', situacoes: ['AGENDADO', 'REALIZADO', 'FALTOU', 'CANCELADO'] }).situacao).toBeUndefined();
  });

  it('etiquetas: uma por critério, membro sem nome conhecido e quatro situações sem etiqueta', () => {
    expect(chipsDaAgenda(AGENDA_SEM_FILTRO, nomeDe)).toEqual([]);
    expect(chipsDaAgenda({ responsavel: 'meus', situacoes: ['AGENDADO', 'FALTOU'] }, nomeDe)).toEqual([
      { chave: 'responsavel', texto: 'Responsável: Só os meus' },
      { chave: 'situacoes', texto: 'Compromissos: Agendados, Faltas' },
    ]);
    expect(chipsDaAgenda({ responsavel: 'm1', situacoes: [] }, nomeDe)[0].texto).toBe('Responsável: Bruno Equipe');
    expect(chipsDaAgenda({ responsavel: 'sumiu', situacoes: [] }, nomeDe)[0].texto).toBe('Responsável: Membro da equipe');
    expect(chipsDaAgenda({ responsavel: '', situacoes: ['AGENDADO', 'REALIZADO', 'FALTOU', 'CANCELADO'] }, nomeDe)).toEqual([]);
  });

  it('tirar uma etiqueta volta só aquele critério', () => {
    const f = { responsavel: 'meus', situacoes: ['AGENDADO' as const] };
    expect(semOFiltroDaAgenda(f, 'responsavel')).toEqual({ responsavel: '', situacoes: ['AGENDADO'] });
    expect(semOFiltroDaAgenda(f, 'situacoes')).toEqual({ responsavel: 'meus', situacoes: [] });
  });
});
