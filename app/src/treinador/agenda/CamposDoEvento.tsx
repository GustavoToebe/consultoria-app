import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AgendaPessoal, TipoDeRepeticaoDeEvento } from '../../api/agendaTipos';
import { DURACOES_SUGERIDAS, textoDaDuracao } from '../../dominio/agendaPresencial';
import {
  AJUDA_DIAS_UTEIS, avisoDoPrimeiroDia, type ErrosDaRepeticaoDoEvento, type ErrosDoEvento, type FormularioDaRepeticaoDoEvento,
  type FormularioDoEvento, LIMITES_DO_EVENTO, mascaraHora, NOME_DA_AGENDA_PADRAO, OPCOES_DE_FIM_DA_REPETICAO, OPCOES_DE_REPETICAO,
  PRIVACIDADE_DO_EVENTO, ROTULOS_DAS_CORES_DA_AGENDA, trocarTipoDaRepeticaoDoEvento,
} from '../../dominio/agendaEvento';
import { dataDaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Texto } from '../../ui/Texto';
import { DiasDaSemana, ErroDoCampo } from './CamposDoCompromisso';

interface Props {
  form: FormularioDoEvento;
  erros: ErrosDoEvento;
  errosDaRepeticao: ErrosDaRepeticaoDoEvento;
  mudar: <K extends keyof FormularioDoEvento>(campo: K, valor: FormularioDoEvento[K]) => void;
  mudarRepeticao: (r: FormularioDaRepeticaoDoEvento) => void;
  /** As agendas pessoais; vazia = a "Pessoal" é criada ao salvar o primeiro evento. */
  agendas: readonly AgendaPessoal[];
  /** Evento avulso em edição não ganha repetição (a API só aceita `ESTA` nele). */
  comRepeticao: boolean;
  hoje: string;
  /** Linha sobre a série, no topo (qual ocorrência e o que cada mudança alcança). */
  sobreASerie?: ReactNode;
  /** Aviso de outro evento no mesmo horário (P5): só informa, nunca impede salvar. */
  aviso?: string | null;
}

/**
 * Campos do evento pessoal: título, agenda, dia inteiro, data, hora e duração, repetição (fim opcional), local e descrição,
 * mais o aviso fixo de privacidade (P6). Os botões ficam no rodapé da folha, fora da rolagem, acima do teclado.
 */
export function CamposDoEvento(p: Props) {
  const { form, erros, mudar } = p;
  const opcoesDeAgenda = p.agendas.map((a) => ({ valor: a.id, rotulo: `${a.nome} (${ROTULOS_DAS_CORES_DA_AGENDA[a.cor]})` }));
  const duracaoSugerida = DURACOES_SUGERIDAS.find((d) => String(d) === form.duracao.trim()) ?? null;
  return (
    <View style={estilos.coluna}>
      {p.sobreASerie}
      <Campo rotulo="Título" valor={form.titulo} aoMudar={(t) => mudar('titulo', t)} erro={erros.titulo} maxLength={LIMITES_DO_EVENTO.titulo}
        placeholder="Ex.: Reunião, estudo, academia" />
      {p.agendas.length === 0 ? (
        <CampoLeitura rotulo="Agenda" valor={`${NOME_DA_AGENDA_PADRAO} (criada ao salvar)`} />
      ) : opcoesDeAgenda.length > OPCOES_PARA_BUSCAR ? (
        <EscolhaEmFolha rotulo="Agenda" titulo="Escolher agenda" valor={form.agendaId} opcoes={opcoesDeAgenda} aoMudar={(id) => mudar('agendaId', id)} />
      ) : (
        <Escolha rotulo="Agenda" valor={form.agendaId} opcoes={opcoesDeAgenda} aoMudar={(id) => mudar('agendaId', id)} />
      )}
      {erros.agendaId ? <ErroDoCampo texto={erros.agendaId} /> : null}
      <Interruptor rotulo="Dia inteiro" valor={form.diaInteiro} aoMudar={(v) => mudar('diaInteiro', v)} />
      <CampoData rotulo="Data" valor={form.data} aoMudar={(t) => mudar('data', t)} erro={erros.data} />
      {form.diaInteiro ? null : <>
        <Campo rotulo="Hora (Brasília)" valor={form.hora} aoMudar={(t) => mudar('hora', mascaraHora(t))} erro={erros.hora}
          placeholder="HH:MM" keyboardType="number-pad" inputMode="numeric" maxLength={5} numerico />
        <Escolha rotulo="Duração" valor={duracaoSugerida} opcoes={DURACOES_SUGERIDAS.map((d) => ({ valor: d, rotulo: textoDaDuracao(d) }))}
          aoMudar={(d) => { if (d !== null) mudar('duracao', String(d)); }} />
        <Campo rotulo="Duração em minutos" valor={form.duracao} aoMudar={(t) => mudar('duracao', t.replace(/\D/g, '').slice(0, 4))}
          erro={erros.duracao} ajuda={`De ${LIMITES_DO_EVENTO.duracaoMinima} a ${LIMITES_DO_EVENTO.duracaoMaxima} minutos.`}
          keyboardType="number-pad" inputMode="numeric" numerico />
      </>}
      {p.aviso ? <View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{p.aviso}</Texto></View> : null}
      {p.comRepeticao ? <CamposDaRepeticao repeticao={form.repeticao} data={form.data} erros={p.errosDaRepeticao} hoje={p.hoje}
        aoMudar={p.mudarRepeticao} /> : null}
      <Campo rotulo="Local (opcional)" valor={form.local} aoMudar={(t) => mudar('local', t)} erro={erros.local} maxLength={LIMITES_DO_EVENTO.local} />
      <Campo rotulo="Descrição (opcional)" valor={form.descricao} aoMudar={(t) => mudar('descricao', t)} erro={erros.descricao}
        linhas={3} maxLength={LIMITES_DO_EVENTO.descricao} />
      <Texto variante="suave">{PRIVACIDADE_DO_EVENTO}</Texto>
    </View>
  );
}

/**
 * Repetição do evento: o tipo (como no compromisso), os dias no semanal e o fim, que aqui é opcional ("Nunca", numa data ou
 * depois de N vezes, até 999). Quando a regra começa depois da data escolhida, diz o primeiro dia.
 */
function CamposDaRepeticao({ repeticao: r, data, erros, hoje, aoMudar }: {
  repeticao: FormularioDaRepeticaoDoEvento; data: string; erros: ErrosDaRepeticaoDoEvento; hoje: string;
  aoMudar: (r: FormularioDaRepeticaoDoEvento) => void;
}) {
  const iso = dataDaTela(data);
  const aviso = iso && r.tipo !== 'NENHUMA' ? avisoDoPrimeiroDia(iso, r.tipo, r.dias, hoje) : null;
  return (
    <View style={estilos.grupo}>
      <Escolha<TipoDeRepeticaoDeEvento> rotulo="Repetição" valor={r.tipo} opcoes={[...OPCOES_DE_REPETICAO]}
        aoMudar={(tipo) => aoMudar(trocarTipoDaRepeticaoDoEvento(r, tipo, data))} />
      {erros.tipo ? <ErroDoCampo texto={erros.tipo} /> : null}
      {r.tipo === 'DIAS_UTEIS' ? <Texto variante="suave">{AJUDA_DIAS_UTEIS}</Texto> : null}
      {r.tipo === 'NENHUMA' ? null : <>
        {r.tipo === 'SEMANAL' ? <DiasDaSemana dias={r.dias} aoMudar={(dias) => aoMudar({ ...r, dias })} /> : null}
        {erros.dias ? <ErroDoCampo texto={erros.dias} /> : null}
        <Escolha rotulo="Termina" valor={r.fim} opcoes={[...OPCOES_DE_FIM_DA_REPETICAO]} aoMudar={(fim) => aoMudar({ ...r, fim })} />
        {r.fim === 'DATA' ? <CampoData rotulo="Última data" valor={r.ate} aoMudar={(ate) => aoMudar({ ...r, ate })} erro={erros.ate} /> : null}
        {r.fim === 'VEZES' ? <Campo rotulo="Quantas vezes" valor={r.vezes} aoMudar={(t) => aoMudar({ ...r, vezes: t.replace(/\D/g, '').slice(0, 3) })}
          erro={erros.vezes} ajuda={`De ${LIMITES_DO_EVENTO.vezesMinimo} a ${LIMITES_DO_EVENTO.vezesMaximo}, contando a primeira.`}
          keyboardType="number-pad" inputMode="numeric" maxLength={3} numerico /> : null}
        {erros.fim ? <ErroDoCampo texto={erros.fim} /> : null}
        {aviso ? <View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{aviso}</Texto></View> : null}
      </>}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
});
