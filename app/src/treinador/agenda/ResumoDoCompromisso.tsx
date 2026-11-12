import { AlignLeft, CalendarDays, Clock, MapPin, UserRound, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Compromisso } from '../../api/agendaTipos';
import { rotuloDoDia } from '../../dominio/agenda';
import { COR_DOS_COMPROMISSOS, posicaoDoResumo, type RetanguloNaJanela } from '../../dominio/agendaCalendario';
import { acaoDeCancelamento, nomesPorExtenso, textoDaOcorrencia, textoDoHorario } from '../../dominio/agendaPresencial';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { MarcadorDaAgenda, seloDoCompromissoComIcone } from './itemDaAgenda';

/** O nome do diálogo, no PC e no celular. */
const TITULO = 'Resumo do compromisso';
const LARGURA_DO_RESUMO = 360;
const FOLGA = 16;

interface Props {
  compromisso: Compromisso;
  hoje: string;
  /** O item tocado na grade (PC): o resumo abre ao lado dele. Sem âncora, abre numa folha (celular). */
  ancora: RetanguloNaJanela | null;
  aoFechar: () => void;
  aoAbrirDetalhes: () => void;
  aoEditar: () => void;
  aoCancelar: () => void;
}

/**
 * Resumo do compromisso ao tocá-lo (F13), como o cartão do Google Agenda: no PC um cartão ancorado ao lado do item, sem
 * escurecer a tela (Esc e clique fora fecham; quem abre devolve o foco ao item); no celular a mesma informação numa
 * `Folha`. Mostra quem, quando, a agenda, o responsável, o local e a observação (só com `ALUNO_SENSIVEL_LER`), e as ações:
 * "Abrir detalhes" (a folha de sempre, com a situação de cada aluno) e, com `AGENDA_ALTERAR`, "Editar" e o cancelamento
 * (com a confirmação da folha). Compromisso já cancelado não oferece o cancelamento: reabrir fica no detalhe.
 */
export function ResumoDoCompromisso({ compromisso: c, hoje, ancora, aoFechar, aoAbrirDetalhes, aoEditar, aoCancelar }: Props) {
  const { pode } = useSessao();
  const podeAlterar = pode('AGENDA_ALTERAR');
  const cancelamento = acaoDeCancelamento(c);
  const acoes = <>
    <Botao rotulo="Abrir detalhes" tipo="secundario" aoTocar={aoAbrirDetalhes} />
    {podeAlterar ? <Botao rotulo="Editar" tipo="secundario" aoTocar={aoEditar} /> : null}
    {podeAlterar && !c.cancelado ? <Botao rotulo={cancelamento.rotulo} tipo="perigoTexto" aoTocar={aoCancelar} /> : null}
  </>;
  const conteudo = <ConteudoDoResumo compromisso={c} hoje={hoje} comObservacao={pode('ALUNO_SENSIVEL_LER')} />;
  if (!ancora) return <Folha visivel titulo={TITULO} aoFechar={aoFechar} rodape={acoes}>{conteudo}</Folha>;
  return <CartaoAncorado ancora={ancora} aoFechar={aoFechar} acoes={acoes}>{conteudo}</CartaoAncorado>;
}

function ConteudoDoResumo({ compromisso: c, hoje, comObservacao }: { compromisso: Compromisso; hoje: string; comObservacao: boolean }) {
  const selo = seloDoCompromissoComIcone(c);
  const ocorrencia = textoDaOcorrencia(c);
  return (
    <View style={estilos.conteudo}>
      <View style={estilos.topo}>
        <Texto variante="subtitulo" nivel={2} style={c.cancelado && estilos.riscado}>{nomesPorExtenso(c)}</Texto>
        <View style={estilos.linhaDoSelo}><Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} /></View>
      </View>
      <Linha Icone={Clock}>
        <Texto numerico>{`${rotuloDoDia(c.data, hoje)}, ${dataSemAnoCorrente(c.data, hoje)} · ${textoDoHorario(c)}`}</Texto>
        {ocorrencia ? <Texto variante="suave" numerico>{ocorrencia}</Texto> : null}
      </Linha>
      <Linha Icone={CalendarDays} marcador>
        <Texto>Compromissos com alunos</Texto>
      </Linha>
      <Linha Icone={UserRound}>
        <Texto>{c.responsavelNome ?? (c.responsavelId ? 'Membro inativo' : '—')}</Texto>
      </Linha>
      {c.local ? <Linha Icone={MapPin}><Texto>{c.local}</Texto></Linha> : null}
      {comObservacao && c.observacao ? <Linha Icone={AlignLeft}><Texto numberOfLines={4}>{c.observacao}</Texto></Linha> : null}
    </View>
  );
}

/** Uma linha do resumo: o ícone (enfeite; o texto diz tudo) e o texto. Na agenda, o marcador da cor no lugar do ícone. */
function Linha({ Icone, marcador, children }: { Icone: typeof Clock; marcador?: boolean; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={estilos.linha}>
      <View style={estilos.icone} aria-hidden importantForAccessibility="no-hide-descendants">
        {marcador ? <MarcadorDaAgenda cor={COR_DOS_COMPROMISSOS} /> : <Icone size={16} color={cores.textoSuave} strokeWidth={2} />}
      </View>
      <View style={estilos.texto}>{children}</View>
    </View>
  );
}

/**
 * O cartão do PC: `Modal` transparente (a trava de foco e o Esc são dele), o fundo inteiro fecha no clique e o cartão fica
 * ao lado do item (`posicaoDoResumo`), na superfície elevada com o contorno do contêiner, sem sombra. O foco entra no
 * cartão (o leitor de tela lê o nome do diálogo e segue pelo conteúdo).
 */
function CartaoAncorado({ ancora, aoFechar, acoes, children }: { ancora: RetanguloNaJanela; aoFechar: () => void; acoes: ReactNode; children: ReactNode }) {
  const { cores, bordas } = useTema();
  const { width, height } = useWindowDimensions();
  const [altura, setAltura] = useState(0);
  const cartao = useRef<View>(null);
  const largura = Math.min(LARGURA_DO_RESUMO, width - 2 * FOLGA);
  const lugar = posicaoDoResumo(ancora, { largura, altura }, { largura: width, altura: height }, FOLGA);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => (cartao.current as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(relogio);
  }, []);
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessible={false} focusable={false} tabIndex={-1} />
      <View ref={cartao} role="dialog" aria-modal aria-label={TITULO} tabIndex={-1}
        onLayout={(e) => setAltura(Math.round(e.nativeEvent.layout.height))}
        style={[estilos.cartao, {
          left: lugar.esquerda, top: lugar.topo, width: largura, maxHeight: height - 2 * FOLGA,
          backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco,
        }]}>
        <View style={estilos.fechar}>
          <IconeBotao Icone={X} rotulo="Fechar o resumo" aoTocar={aoFechar} compacto />
        </View>
        <ScrollView contentContainerStyle={estilos.rolagem}>
          {children}
          <LinhaDeAcoes>{acoes}</LinhaDeAcoes>
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  conteudo: { gap: espaco(1.5) },
  // O título não passa por baixo do X (44 px no canto).
  topo: { gap: espaco(1), paddingRight: espaco(4) },
  linhaDoSelo: { flexDirection: 'row' },
  riscado: { textDecorationLine: 'line-through' },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  icone: { width: 16, height: 22, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, minWidth: 0, gap: 2 },
  cartao: { position: 'absolute', borderRadius: RAIO, overflow: 'hidden' },
  fechar: { position: 'absolute', top: espaco(0.5), right: espaco(0.5), zIndex: 1 },
  rolagem: { padding: espaco(2), gap: espaco(2) },
});
