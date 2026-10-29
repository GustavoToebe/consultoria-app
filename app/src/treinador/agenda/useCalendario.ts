import { useCallback, useMemo } from 'react';

import type { AgendaPessoal, SituacaoCompromisso } from '../../api/agendaTipos';
import type { AtualizacaoDaLista } from '../../api/tipos';
import {
  listarAgendasPessoais, listarAtualizacoes, listarCompromissos, listarEventos, painelTreinador, responsaveisEquipe, resumoDaAgenda,
} from '../../api/rotas';
import { resumoDeAtrasadas } from '../../dominio/agenda';
import {
  AGENDA_ATUALIZACOES, AGENDA_COMPROMISSOS, type AgendaDoPainel, agendasDoPainel, agendasOcultasValidas, agendasParaBuscar,
  atualizacoesSemData, contagemDoAno, type ContagemDoDia, type ItemDoCalendario, mesclarItens, periodoDoCalendario, type VisaoDoCalendario,
} from '../../dominio/agendaCalendario';
import { useCarregar } from '../../ui/useCarregar';

/** Lista vazia estável (a fonte que a pessoa não pode ver ou escondeu), para o `useMemo` não refazer a conta à toa. */
const NADA: never[] = [];

export interface PermissoesDoCalendario {
  /** `AGENDA_LER`: compromissos, agendas pessoais, eventos e o resumo do Ano. */
  agenda: boolean;
  /** `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`. */
  atualizacoes: boolean;
  /** `PAINEL_VER`: o contador de atrasadas. */
  painel: boolean;
  /** `ALUNO_LER` ou `INSCRICAO_LER`: a lista da equipe do filtro de responsável (`/responsaveis`). */
  equipe: boolean;
}

export interface FiltrosDoCalendario {
  visao: VisaoDoCalendario;
  data: string;
  /** "Só os meus": as atualizações vão com `meus` e os compromissos com o próprio id. */
  meus: boolean;
  /** Outro membro escolhido (D19): `responsavel` nas três fontes. */
  membro: string | null;
  situacao: SituacaoCompromisso | null;
  usuarioId: string | null;
  /** A preferência `agendasOcultas` como está gravada (pode ter id de agenda apagada). */
  ocultasGravadas: readonly string[];
}

export interface ErroDaFonte {
  chave: string;
  erro: unknown;
  tentarDeNovo: () => void;
}

/**
 * Carga da Agenda: as três fontes do período da visão (compromissos, eventos pessoais e atualizações), as agendas pessoais,
 * o resumo do Ano, a equipe do filtro e o contador de atrasadas. Cada busca só sai com a permissão dela e com a agenda
 * visível; sem `AGENDA_LER` nada vai a `/agenda*`. O Ano não baixa as listas: só o resumo e as atualizações do ano. Cada
 * resposta guarda a chave com que foi pedida, e a tela só usa a da chave atual (resposta fora de ordem é ignorada).
 */
export function useCalendario(permissoes: PermissoesDoCalendario, f: FiltrosDoCalendario) {
  const ano = f.visao === 'ano';
  const { de, ate } = periodoDoCalendario(f.visao, f.data);
  const responsavel = f.membro ?? (f.meus ? f.usuarioId : null);

  // Agendas pessoais: dão as cores, o filtro dos eventos e quais ids da preferência ainda valem.
  const agendas = useCarregar(permissoes.agenda ? 'agendas' : null, () => listarAgendasPessoais());
  const pessoais: AgendaPessoal[] | null = agendas.erro ? null : agendas.dados ?? null;
  // Ao recarregar (voltar à tela) a lista anterior continua valendo: os eventos não somem enquanto a nova chega.
  const agendasLidas = !!pessoais;
  // Só com a lista lida a preferência é limpa; com a leitura falhando vale a gravada (e nada é regravado).
  const ocultas = useMemo(() => (pessoais ? agendasOcultasValidas(f.ocultasGravadas, pessoais.map((a) => a.id)) : [...f.ocultasGravadas]),
    [pessoais, f.ocultasGravadas]);
  const escondida = (chave: string) => ocultas.includes(chave);
  const escolha = pessoais ? agendasParaBuscar(pessoais, ocultas) : { ids: [], semEventos: true };
  const idsDasAgendas = escolha.ids.join(',');

  const verCompromissos = permissoes.agenda && !escondida(AGENDA_COMPROMISSOS);
  const verAtualizacoes = permissoes.atualizacoes && !escondida(AGENDA_ATUALIZACOES);

  const chaveCompromissos = verCompromissos && !ano ? `c:${de}:${ate}:${responsavel ?? ''}:${f.situacao ?? ''}` : null;
  const compromissos = useCarregar(chaveCompromissos, async (chave) => ({
    chave, itens: await listarCompromissos({ de, ate, responsavel, situacao: f.situacao }),
  }));

  // Eventos só depois de saber as agendas (sem nenhuma, ou todas escondidas, não pede).
  const chaveEventos = permissoes.agenda && !ano && agendasLidas && !escolha.semEventos ? `e:${de}:${ate}:${idsDasAgendas}` : null;
  const eventos = useCarregar(chaveEventos, async (chave) => ({
    chave, itens: await listarEventos({ de, ate, agendas: escolha.ids }),
  }));

  // Atualizações do período (D14/D19): "Meus" vai como `meus`; um membro, como `responsavel`.
  const chaveAtualizacoes = verAtualizacoes ? `a:${de}:${ate}:${f.meus}:${f.membro ?? ''}` : null;
  const atualizacoes = useCarregar(chaveAtualizacoes, async (chave) => ({
    chave, itens: await listarAtualizacoes('PROXIMAS', f.meus, { responsavel: f.membro, de, ate }),
  }));

  // Ano: o resumo por dia (compromissos e eventos, só contagens). Com a leitura das agendas falhando, vai sem os eventos.
  const resumoPronto = !permissoes.agenda ? false : agendasLidas || !!agendas.erro;
  const chaveResumo = ano && resumoPronto ? `r:${de}:${responsavel ?? ''}:${f.situacao ?? ''}:${idsDasAgendas}` : null;
  const resumo = useCarregar(chaveResumo, async (chave) => ({
    chave, dias: (await resumoDaAgenda({ de, ate, responsavel, situacao: f.situacao, agendas: escolha.ids })).dias,
  }));

  const equipe = useCarregar(permissoes.equipe && (permissoes.agenda || permissoes.atualizacoes) ? 'agenda-equipe' : null, () => responsaveisEquipe());
  const painel = useCarregar(permissoes.atualizacoes && permissoes.painel && !f.membro ? `agenda-painel:${f.meus}` : null, () => painelTreinador(f.meus));

  // Só os dados da chave atual: enquanto o novo recorte chega, nada do anterior aparece como se fosse dele.
  const listaCompromissos = !verCompromissos || ano ? NADA : compromissos.dados?.chave === chaveCompromissos ? compromissos.dados.itens : undefined;
  const listaAtualizacoes: AtualizacaoDaLista[] | undefined = !verAtualizacoes ? NADA
    : atualizacoes.dados?.chave === chaveAtualizacoes ? atualizacoes.dados.itens : undefined;
  const listaEventos = !permissoes.agenda || ano ? NADA
    : agendas.erro || (agendasLidas && escolha.semEventos) ? NADA
      : eventos.dados?.chave === chaveEventos && chaveEventos ? eventos.dados.itens : undefined;
  const diasDoResumo = !permissoes.agenda ? NADA : resumo.dados?.chave === chaveResumo && chaveResumo ? resumo.dados.dias : undefined;

  const itens: ItemDoCalendario[] | undefined = useMemo(() => (listaCompromissos && listaEventos && listaAtualizacoes
    ? mesclarItens({ compromissos: listaCompromissos, eventos: listaEventos, atualizacoes: listaAtualizacoes, agendas: pessoais ?? [], ocultas })
    : undefined), [listaCompromissos, listaEventos, listaAtualizacoes, pessoais, ocultas]);
  const semData = useMemo(() => (listaAtualizacoes ? atualizacoesSemData(listaAtualizacoes) : NADA), [listaAtualizacoes]);
  const contagem: Map<string, ContagemDoDia> | undefined = useMemo(() => (ano && diasDoResumo && listaAtualizacoes
    ? contagemDoAno(diasDoResumo, listaAtualizacoes, { ocultas, semEventos: escolha.semEventos }) : undefined),
  [ano, diasDoResumo, listaAtualizacoes, ocultas, escolha.semEventos]);

  const painelDeAgendas: AgendaDoPainel[] = useMemo(() => agendasDoPainel(pessoais ?? [], ocultas,
    { compromissos: permissoes.agenda, atualizacoes: permissoes.atualizacoes }), [pessoais, ocultas, permissoes.agenda, permissoes.atualizacoes]);

  const possiveis: (ErroDaFonte | null)[] = [
    agendas.erro ? { chave: 'agendas', erro: agendas.erro, tentarDeNovo: agendas.recarregar } : null,
    compromissos.erro ? { chave: 'compromissos', erro: compromissos.erro, tentarDeNovo: compromissos.recarregar } : null,
    eventos.erro ? { chave: 'eventos', erro: eventos.erro, tentarDeNovo: eventos.recarregar } : null,
    atualizacoes.erro ? { chave: 'atualizacoes', erro: atualizacoes.erro, tentarDeNovo: atualizacoes.recarregar } : null,
    resumo.erro ? { chave: 'resumo', erro: resumo.erro, tentarDeNovo: resumo.recarregar } : null,
  ];
  const erros = possiveis.filter((e): e is ErroDaFonte => e !== null);

  const { recarregar: recAgendas } = agendas;
  const { recarregar: recCompromissos } = compromissos;
  const { recarregar: recEventos } = eventos;
  const { recarregar: recAtualizacoes } = atualizacoes;
  const { recarregar: recResumo } = resumo;
  const { recarregar: recPainel } = painel;
  const recarregarTudo = useCallback(() => {
    recAgendas(); recCompromissos(); recEventos(); recAtualizacoes(); recResumo(); recPainel();
  }, [recAgendas, recCompromissos, recEventos, recAtualizacoes, recResumo, recPainel]);

  const pronto = ano ? contagem !== undefined : itens !== undefined;
  // Com erro numa fonte, o que chegou das outras ainda aparece (a fonte que falhou fica vazia, com a mensagem acima).
  const comFalha = erros.length > 0;
  const itensMostrados = itens ?? (comFalha ? mesclarItens({
    compromissos: listaCompromissos ?? [], eventos: listaEventos ?? [], atualizacoes: listaAtualizacoes ?? [], agendas: pessoais ?? [], ocultas,
  }) : undefined);
  const contagemMostrada = contagem ?? (ano && comFalha ? contagemDoAno(diasDoResumo ?? [], listaAtualizacoes ?? [], { ocultas, semEventos: escolha.semEventos }) : undefined);

  return {
    de, ate, responsavel, pronto,
    itens: itensMostrados,
    semData,
    contagem: contagemMostrada,
    compromissosCarregados: listaCompromissos ?? NADA,
    agendas: pessoais,
    agendasCarregando: agendas.carregando && !agendas.dados,
    agendasLidas,
    painelDeAgendas,
    ocultas,
    equipe: equipe.dados ?? NADA,
    equipeCarregando: equipe.carregando,
    atrasadas: permissoes.atualizacoes && !f.membro ? resumoDeAtrasadas(painel.dados?.atualizacoesAtrasadas) : null,
    erros,
    recarregarTudo,
    recarregarAgendas: recAgendas,
    recarregarCompromissos: recCompromissos,
    recarregarEventos: recEventos,
  };
}
