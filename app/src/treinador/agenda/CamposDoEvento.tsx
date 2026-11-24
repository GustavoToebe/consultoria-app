import { AlignLeft, CalendarDays, Clock, MapPin, Type } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { AgendaPessoal, TipoDeRepeticaoDeEvento } from '../../api/agendaTipos';
import {
  AJUDA_DIAS_UTEIS, avisoDoPrimeiroDia, type ErrosDaRepeticaoDoEvento, type ErrosDoEvento, type FormularioDaRepeticaoDoEvento,
  type FormularioDoEvento, LIMITES_DO_EVENTO, OPCOES_DE_FIM_DA_REPETICAO, PRIVACIDADE_DO_EVENTO, trocarTipoDaRepeticaoDoEvento,
} from '../../dominio/agendaEvento';
import { dataDaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoData, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Grade } from '../../ui/Grade';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { Texto } from '../../ui/Texto';
import { DiasDaSemana, ErroDoCampo, focarDentro } from './CamposDoCompromisso';
import { EscolhaDaAgenda } from './EscolhaDaAgenda';
import { CamposDoHorario, LinhaComIcone, SeletorDaRepeticao, TituloDaParte } from './PecasDoFormulario';

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
  /** Formulário completo ("Mais opções" e a edição); sem isto, o painel rápido com linhas de ícone. */
  completo: boolean;
  /** Passa para o formulário completo ("Personalizar…" da repetição). */
  aoMaisOpcoes: () => void;
  /** Linha sobre a série, no topo (qual ocorrência e o que cada mudança alcança). */
  sobreASerie?: ReactNode;
  /** Aviso de outro evento no mesmo horário (P5): só informa, nunca impede salvar. */
  aviso?: string | null;
}

/**
 * Campos do evento pessoal, em dois jeitos (D4, D7): o painel rápido do Google Agenda (linhas com o ícone à esquerda: o
 * título grande; "Quando" com data, início – fim e dia inteiro numa linha e a repetição embaixo; a agenda; local;
 * descrição) e o formulário completo em duas partes ("Quando" e "Detalhes"), com os dias da semana do semanal. O horário é
 * início–fim (D5) e a repetição, a lista com os rótulos do Google (D6). Todo campo tem o rótulo à vista (criar unificado,
 * 23/11). O aviso fixo de privacidade (P6) fica nos dois. Os botões ficam no rodapé da folha.
 */
export function CamposDoEvento(p: Props) {
  const { form, erros, mudar, completo } = p;
  const r = form.repeticao;

  // "Personalizar…": como no compromisso (semanal do dia da data, formulário completo, foco na repetição).
  const repeticaoRef = useRef<View>(null);
  const [focarRepeticao, setFocarRepeticao] = useState(0);
  useEffect(() => {
    if (!focarRepeticao || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => focarDentro(repeticaoRef.current), 0);
    return () => clearTimeout(relogio);
  }, [focarRepeticao]);
  const personalizar = () => depoisDeFecharAsFolhas(() => {
    if (r.tipo === 'NENHUMA') p.mudarRepeticao(trocarTipoDaRepeticaoDoEvento(r, 'SEMANAL', form.data));
    p.aoMaisOpcoes();
    setFocarRepeticao((n) => n + 1);
  });

  const titulo = <Campo rotulo="Título" grande valor={form.titulo} aoMudar={(t) => mudar('titulo', t)} erro={erros.titulo}
    maxLength={LIMITES_DO_EVENTO.titulo} placeholder="Adicionar título" />;
  // O "Dia inteiro" fecha a linha do horário (Data | Início – Fim | Dia inteiro).
  const diaInteiro = <View style={estilos.diaInteiro}><Interruptor rotulo="Dia inteiro" valor={form.diaInteiro} aoMudar={(v) => mudar('diaInteiro', v)} /></View>;
  const horario = <CamposDoHorario data={form.data} hora={form.hora} duracao={form.duracao} limites={LIMITES_DO_EVENTO} compacto={!completo}
    semHoras={form.diaInteiro} erros={{ data: erros.data, hora: erros.hora, duracao: erros.duracao }} aoMudarData={(t) => mudar('data', t)} nomeDaData="Data do evento"
    aoMudarHora={(h) => mudar('hora', h)} aoMudarDuracao={(d) => mudar('duracao', d)} depois={diaInteiro} />;
  const aviso = p.aviso ? <View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{p.aviso}</Texto></View> : null;
  const repeticao = p.comRepeticao ? (
    <View ref={repeticaoRef} style={estilos.grupo}>
      <SeletorDaRepeticao<TipoDeRepeticaoDeEvento> tipo={r.tipo} dias={r.dias} data={form.data} aoPersonalizar={personalizar}
        aoEscolher={(tipo) => p.mudarRepeticao(trocarTipoDaRepeticaoDoEvento({ ...r, dias: [] }, tipo, form.data))} />
      <DetalhesDaRepeticao repeticao={r} data={form.data} erros={p.errosDaRepeticao} hoje={p.hoje} comDias={completo} aoMudar={p.mudarRepeticao} />
    </View>
  ) : null;
  const agenda = <EscolhaDaAgenda agendas={p.agendas} valor={form.agendaId} aoMudar={(id) => mudar('agendaId', id)} erro={erros.agendaId} />;
  const local = <Campo rotulo="Local (opcional)" valor={form.local} aoMudar={(t) => mudar('local', t)} erro={erros.local}
    maxLength={LIMITES_DO_EVENTO.local} />;
  const descricao = <Campo rotulo="Descrição (opcional)" valor={form.descricao} aoMudar={(t) => mudar('descricao', t)}
    erro={erros.descricao} linhas={3} maxLength={LIMITES_DO_EVENTO.descricao} />;
  const privacidade = <Texto variante={completo ? 'suave' : 'pequeno'}>{PRIVACIDADE_DO_EVENTO}</Texto>;

  if (!completo) {
    return (
      <View style={estilos.coluna}>
        {p.sobreASerie}
        <LinhaComIcone Icone={Type}>{titulo}</LinhaComIcone>
        <LinhaComIcone Icone={Clock}>{horario}{aviso}{repeticao}</LinhaComIcone>
        <LinhaComIcone Icone={CalendarDays}>{agenda}</LinhaComIcone>
        <LinhaComIcone Icone={MapPin}>{local}</LinhaComIcone>
        <LinhaComIcone Icone={AlignLeft}>{descricao}{privacidade}</LinhaComIcone>
      </View>
    );
  }
  return (
    <View style={estilos.coluna}>
      {p.sobreASerie}
      {titulo}
      <Grade gap={espaco(3)}>
        <View style={estilos.parte}>
          <TituloDaParte texto="Quando" />
          {horario}
          {aviso}
          {repeticao}
        </View>
        <View style={estilos.parte}>
          <TituloDaParte texto="Detalhes" />
          {agenda}
          {local}
          {descricao}
          {privacidade}
        </View>
      </Grade>
    </View>
  );
}

/**
 * O resto da repetição do evento, depois da lista do tipo: os dias no semanal (só no formulário completo) e o fim, que aqui
 * é opcional ("Nunca", numa data ou depois de N vezes, até 999). Quando a regra começa depois da data escolhida, diz o
 * primeiro dia.
 */
function DetalhesDaRepeticao({ repeticao: r, data, erros, hoje, comDias, aoMudar }: {
  repeticao: FormularioDaRepeticaoDoEvento; data: string; erros: ErrosDaRepeticaoDoEvento; hoje: string; comDias: boolean;
  aoMudar: (r: FormularioDaRepeticaoDoEvento) => void;
}) {
  const iso = dataDaTela(data);
  const aviso = iso && r.tipo !== 'NENHUMA' ? avisoDoPrimeiroDia(iso, r.tipo, r.dias, hoje) : null;
  return (
    <>
      {erros.tipo ? <ErroDoCampo texto={erros.tipo} /> : null}
      {r.tipo === 'DIAS_UTEIS' ? <Texto variante="suave">{AJUDA_DIAS_UTEIS}</Texto> : null}
      {r.tipo === 'NENHUMA' ? null : <>
        {r.tipo === 'SEMANAL' && comDias ? <DiasDaSemana dias={r.dias} aoMudar={(dias) => aoMudar({ ...r, dias })} /> : null}
        {erros.dias ? <ErroDoCampo texto={erros.dias} /> : null}
        <Escolha rotulo="Termina" valor={r.fim} opcoes={[...OPCOES_DE_FIM_DA_REPETICAO]} aoMudar={(fim) => aoMudar({ ...r, fim })} />
        {r.fim === 'DATA' ? <CampoData rotulo="Última data" nome="Última data da repetição" regra="PLANEJAMENTO" valor={r.ate} aoMudar={(ate) => aoMudar({ ...r, ate })} erro={erros.ate} /> : null}
        {r.fim === 'VEZES' ? <Campo rotulo="Quantas vezes" valor={r.vezes} aoMudar={(t) => aoMudar({ ...r, vezes: t.replace(/\D/g, '').slice(0, 3) })}
          erro={erros.vezes} ajuda={`De ${LIMITES_DO_EVENTO.vezesMinimo} a ${LIMITES_DO_EVENTO.vezesMaximo}, contando a primeira.`}
          keyboardType="number-pad" inputMode="numeric" maxLength={3} numerico /> : null}
        {erros.fim ? <ErroDoCampo texto={erros.fim} /> : null}
        {aviso ? <View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{aviso}</Texto></View> : null}
      </>}
    </>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  parte: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  diaInteiro: { alignSelf: 'flex-end' },
});
