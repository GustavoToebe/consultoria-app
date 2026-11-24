import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgendaPessoal, Compromisso } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { minutoDoDiaEmBrasilia } from '../../dominio/agendaCalendario';
import { horarioSugerido, ROTULOS_DA_CRIACAO, textoDasPerdas, type TipoDaCriacao, trocarTipoDaCriacao } from '../../dominio/agendaCriacao';
import { agendaDoFormulario, formularioDeEventoNovo } from '../../dominio/agendaEvento';
import { formularioNovo } from '../../dominio/agendaPresencial';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, LARGURA_FOLHA_LARGA, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useFormularioDoCompromisso } from './useFormularioDoCompromisso';
import { useFormularioDoEvento } from './useFormularioDoEvento';

/** O que abre a janela de criação: o tipo escolhido no Criar (ou o compromisso, no clique da grade), o dia e a hora. */
export interface CriacaoAberta {
  tipo: TipoDaCriacao;
  /** AAAA-MM-DD (Brasília). */
  data: string;
  /** HH:MM do horário clicado na grade; sem ela, a próxima meia hora (`horarioSugerido`). */
  hora?: string;
  /** Muda a cada abertura: cada uma começa limpa (a `key` da folha). */
  vez: number;
}

interface Props {
  aberto: CriacaoAberta | null;
  hoje: string;
  responsaveis: readonly ResponsavelEquipe[];
  /** Compromissos já na tela, para o aviso de sobreposição do responsável. */
  carregados: readonly Compromisso[];
  /** As agendas pessoais (`null` = carregando ou a leitura falhou). */
  agendas: readonly AgendaPessoal[] | null;
  erroDasAgendas?: unknown;
  recarregarAgendas: () => void;
  aoFechar: () => void;
  aoCriarCompromisso: (c: Compromisso) => void;
  /** `agendas` = criou a "Pessoal" (a tela relê a lista). */
  aoCriarEvento: (o: { agendas: boolean }) => void;
}

const OPCOES_DO_TIPO = (['compromisso', 'evento'] as const).map((valor) => ({ valor, rotulo: ROTULOS_DA_CRIACAO[valor] }));

/**
 * A janela de criação da Agenda (agenda: criar unificado, 23/11): uma folha só para o compromisso com aluno e o evento
 * pessoal, com o segmento no topo. Os dois formulários ficam montados (`useFormularioDoCompromisso` e
 * `useFormularioDoEvento`) e só o do tipo escolhido aparece e pergunta à API; trocar de tipo leva data, horário, local e
 * observação ao outro (`trocarTipoDaCriacao`) e avisa, sem bloquear, o que fica só no tipo de origem. Rodapé igual nos dois:
 * "Mais opções" como link à esquerda (o formulário completo, em `LARGURA_EDITOR`), "Cancelar" e o primário. O painel rápido
 * usa a folha larga (`LARGURA_FOLHA_LARGA`) para Data | Início – Fim | Dia inteiro caberem numa linha. Fechar com algo
 * digitado pergunta "Sair sem salvar?"; salvar fecha sem perguntar.
 */
export function FolhaCriar(props: Props) {
  if (!props.aberto) return null;
  return <FolhaAberta key={props.aberto.vez} {...props} aberto={props.aberto} />;
}

function FolhaAberta({ aberto, hoje, responsaveis, carregados, agendas, erroDasAgendas, recarregarAgendas, aoFechar, aoCriarCompromisso, aoCriarEvento }:
  Props & { aberto: CriacaoAberta }) {
  const { usuario } = useSessao();
  const [tipo, setTipo] = useState<TipoDaCriacao>(aberto.tipo);
  // Os dois formulários de abrir, uma vez: são também a referência do "Sair sem salvar?".
  const [iniciais] = useState(() => {
    const { data, hora } = aberto.hora ? { data: aberto.data, hora: aberto.hora } : horarioSugerido(aberto.data, hoje, minutoDoDiaEmBrasilia(new Date()));
    const eu = responsaveis.some((r) => r.id === usuario?.id) ? usuario?.id ?? '' : '';
    return { compromisso: formularioNovo(eu, data, hora), evento: formularioDeEventoNovo('', data, hora) };
  });
  const c = useFormularioDoCompromisso({
    compromisso: null, inicial: () => iniciais.compromisso, ativo: tipo === 'compromisso', hoje, responsaveis, carregados, completoInicial: false,
  });
  const ev = useFormularioDoEvento({ evento: null, inicial: () => iniciais.evento, agendas, ativo: tipo === 'evento', hoje, completoInicial: false });
  const [perdas, setPerdas] = useState<string | null>(null);

  const agendaSugerida = agendaDoFormulario(agendas ?? [])?.id ?? '';
  const alterado = JSON.stringify(c.form) !== JSON.stringify(iniciais.compromisso)
    || JSON.stringify({ ...ev.form, agendaId: '' }) !== JSON.stringify(iniciais.evento) || ev.form.agendaId !== agendaSugerida;
  const { fechar, aviso: perguntaDeSaida } = useFecharComAviso(true, alterado, aoFechar);

  const trocar = (para: TipoDaCriacao) => {
    if (para === tipo) return;
    const r = trocarTipoDaCriacao(para, c.form, ev.form, c.comObservacao);
    // O completo segue o de origem: a folha não muda de largura nem de jeito ao trocar.
    if (para === 'evento') { ev.substituir(r.evento); ev.setCompleto(c.completo); } else { c.substituir(r.compromisso); c.setCompleto(ev.completo); }
    setPerdas(textoDasPerdas(para, r.perdas));
    setTipo(para);
  };

  const marcar = async () => {
    const pedido = c.conferirPedido();
    if (!pedido) return;
    const salvo = await c.enviar(pedido, 'ESTA');
    if (!salvo) return;
    aoCriarCompromisso(salvo);
    aoFechar();
  };
  const salvarEvento = async () => {
    const r = await ev.enviar({});
    if (r.ok || r.criouAgenda) aoCriarEvento({ agendas: r.criouAgenda });
    if (r.ok) aoFechar();
    else if (r.erro) ev.mostrarErro(r.erro);
  };

  const ativo = tipo === 'compromisso' ? c : ev;
  // O evento só abre sabendo as agendas: carregando, espera; falhou, diz e deixa tentar de novo.
  const semAgendas = tipo === 'evento' && agendas === null;
  const segmento = (
    <View style={estilos.topo}>
      <Escolha<TipoDaCriacao> descricao="O que criar" valor={tipo} opcoes={OPCOES_DO_TIPO} aoMudar={trocar} />
      <View accessibilityLiveRegion="polite" aria-live="polite">
        {perdas ? <Texto variante="pequeno">{perdas}</Texto> : null}
      </View>
    </View>
  );
  const corpo = semAgendas ? (
    erroDasAgendas ? <MensagemErro texto={`Não deu para carregar as suas agendas. ${textoDoErro(erroDasAgendas)}`} erro={erroDasAgendas}
      tentarDeNovo={recarregarAgendas} />
      : <Esqueleto texto="Carregando as suas agendas" cartoes={1} />
  ) : tipo === 'compromisso' ? c.campos({ comRepeticao: true }) : ev.campos({ comRepeticao: true });

  const status = semAgendas ? undefined : <>
    {ativo.mensagem}
    {ativo.avisoDoCompleto ? <Texto variante="suave">{ativo.avisoDoCompleto}</Texto> : null}
    <LinkDeAcao texto={ativo.completo ? 'Menos opções' : 'Mais opções'} aoTocar={() => ativo.setCompleto(!ativo.completo)} />
  </>;
  const rodape = <>
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
    {semAgendas ? null : tipo === 'compromisso'
      ? <Botao rotulo="Marcar compromisso" aoTocar={() => void marcar()} carregando={c.salvando} desabilitado={c.salvando} motivo="Salvando." />
      : <Botao rotulo="Salvar evento" aoTocar={() => void salvarEvento()} carregando={ev.salvando} desabilitado={ev.salvando} motivo="Salvando." />}
  </>;

  return (
    <Folha visivel titulo="Criar" aoFechar={fechar} rodape={rodape} statusDoRodape={status}
      largura={ativo.completo && !semAgendas ? LARGURA_EDITOR : LARGURA_FOLHA_LARGA}>
      {segmento}
      {corpo}
      {perguntaDeSaida}
    </Folha>
  );
}

/** Ação discreta do rodapé ("Mais opções"): texto sublinhado, alvo de 44 px, como o `LinkTexto`, mas sem navegar. */
function LinkDeAcao({ texto, aoTocar }: { texto: string; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" onPress={aoTocar} style={(e) => [estilos.link, sobre(e) && { backgroundColor: cores.sobre }]}>
      <Texto style={[estilos.textoDoLink, { color: cores.texto }]}>{texto}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(1), marginBottom: espaco(1) },
  link: { alignSelf: 'flex-start', minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(0.5), marginLeft: -espaco(0.5), borderRadius: RAIO_CONTROLE },
  textoDoLink: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
});
