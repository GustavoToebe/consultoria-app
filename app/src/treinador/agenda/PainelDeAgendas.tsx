import { Check, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgendaPessoal, CorDaAgenda } from '../../api/agendaTipos';
import { alterarAgendaPessoal, apagarAgendaPessoal, contarEventosDaAgenda, criarAgendaPessoal } from '../../api/rotas';
import type { AgendaDoPainel } from '../../dominio/agendaCalendario';
import {
  COR_DA_AGENDA_PADRAO, type ErrosDaAgenda, LIMITES_DA_AGENDA, pedidoDaAgenda, podeCriarAgenda, ROTULOS_DAS_CORES_DA_AGENDA, textoDeApagarAgenda,
  textoDoErroDoCalendario,
} from '../../dominio/agendaEvento';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, CHAVES_DA_AGENDA, espaco, fontes, RAIO, textoSobre } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { ErroDoCampo } from './CamposDoCompromisso';
import { useCorDaAgenda } from './itemDaAgenda';

interface Props {
  agendas: readonly AgendaDoPainel[];
  /** As pessoais como vieram da API (nome e limite para a validação); `null` = a leitura falhou ou não terminou. */
  pessoais: readonly AgendaPessoal[] | null;
  carregando: boolean;
  podeAlterar: boolean;
  aoAlternar: (chave: string) => void;
  /** Depois de criar, renomear, recolorir ou apagar: a tela relê as agendas e os eventos. */
  aoMudar: () => void;
}

type Edicao = { tipo: 'nova' } | { tipo: 'editar'; agenda: AgendaPessoal };

/**
 * "Minhas agendas" (bloco com faixa): as duas fixas (compromissos com alunos e atualizações) e as pessoais, cada uma com a
 * caixa de mostrar ou esconder na cor dela (a escolha fica no aparelho, `agendasOcultas`). Com `AGENDA_ALTERAR`, o "+" da
 * faixa ("Nova agenda") e o lápis de cada pessoal abrem a folha de nome e cor, onde também se apaga (com a contagem de
 * eventos na confirmação). No limite de agendas o "+" fica desabilitado e o motivo aparece embaixo da lista.
 */
export function PainelDeAgendas({ agendas, pessoais, carregando, podeAlterar, aoAlternar, aoMudar }: Props) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const quantas = pessoais?.length ?? 0;
  const podeCriar = podeCriarAgenda(quantas);
  const comNova = podeAlterar && !!pessoais;
  const motivo = `Você já tem ${LIMITES_DA_AGENDA.agendas} agendas. Apague uma para criar outra.`;
  return (
    <Cartao titulo="Minhas agendas"
      acoes={comNova ? <IconeBotao Icone={Plus} rotulo={podeCriar ? 'Nova agenda' : `Nova agenda. ${motivo}`} moldura aoTocar={() => setEdicao({ tipo: 'nova' })} desabilitado={!podeCriar} /> : undefined}>
      <View style={estilos.lista} role="group" aria-label="Agendas visíveis">
        {agendas.map((a) => <LinhaDaAgenda key={a.chave} agenda={a} aoAlternar={() => aoAlternar(a.chave)}
          aoEditar={podeAlterar && !a.fixa ? () => {
            const pessoal = pessoais?.find((p) => p.id === a.chave);
            if (pessoal) setEdicao({ tipo: 'editar', agenda: pessoal });
          } : undefined} />)}
        {carregando ? <Texto variante="suave">Carregando as agendas…</Texto> : null}
      </View>
      {comNova && !podeCriar ? (
        <Texto variante="pequeno">{motivo}</Texto>
      ) : null}
      <FolhaDaAgenda key={edicao?.tipo === 'editar' ? edicao.agenda.id : edicao?.tipo ?? 'fechada'} edicao={edicao} pessoais={pessoais ?? []}
        aoFechar={() => setEdicao(null)} aoMudar={() => { setEdicao(null); aoMudar(); }} />
    </Cartao>
  );
}

function LinhaDaAgenda({ agenda: a, aoAlternar, aoEditar }: { agenda: AgendaDoPainel; aoAlternar: () => void; aoEditar?: () => void }) {
  const { cores } = useTema();
  const corDe = useCorDaAgenda();
  const cor = corDe(a.cor);
  return (
    <View style={estilos.linha}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: a.visivel }} aria-checked={a.visivel}
        accessibilityLabel={`${a.nome}, cor ${ROTULOS_DAS_CORES_DA_AGENDA[a.cor]}. Mostrar na agenda`} onPress={aoAlternar}
        style={(e) => [estilos.caixaELinha, sobre(e) && { backgroundColor: cores.superficie3 }]}>
        <View style={[estilos.caixa, { borderColor: cor, backgroundColor: a.visivel ? cor : 'transparent' }]}>
          {a.visivel ? <Check size={14} color={textoSobre(cor)} strokeWidth={3} /> : null}
        </View>
        <Texto numberOfLines={2} style={estilos.nome}>{a.nome}</Texto>
      </Pressable>
      {aoEditar ? <IconeBotao Icone={Pencil} rotulo={`Editar a agenda ${a.nome}`} aoTocar={aoEditar} /> : null}
    </View>
  );
}

/** Folha de criar ou editar a agenda: nome (até 40) e uma das 8 cores com o nome escrito; editar também apaga. */
function FolhaDaAgenda({ edicao, pessoais, aoFechar, aoMudar }: {
  edicao: Edicao | null; pessoais: readonly AgendaPessoal[]; aoFechar: () => void; aoMudar: () => void;
}) {
  const editando = edicao?.tipo === 'editar' ? edicao.agenda : null;
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [cor, setCor] = useState<CorDaAgenda>(editando?.cor ?? COR_DA_AGENDA_PADRAO);
  const [erros, setErros] = useState<ErrosDaAgenda>({});
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [apagar, setApagar] = useState<{ eventos: number } | null>(null);
  const [contando, setContando] = useState(false);

  const salvar = async () => {
    const r = pedidoDaAgenda(nome, cor, pessoais, editando ? { id: editando.id, versao: editando.versao } : undefined);
    setErros(r.erros);
    setErro(null);
    if (!r.pedido) return;
    setSalvando(true);
    try {
      if (editando) await alterarAgendaPessoal(editando.id, r.pedido);
      else await criarAgendaPessoal(r.pedido);
      aoMudar();
    } catch (e) {
      setErro(e);
    } finally {
      setSalvando(false);
    }
  };
  const pedirApagar = async () => {
    if (!editando) return;
    setContando(true);
    setErro(null);
    try {
      setApagar({ eventos: (await contarEventosDaAgenda(editando.id)).eventos });
    } catch (e) {
      setErro(e);
    } finally {
      setContando(false);
    }
  };
  const confirmarApagar = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      await apagarAgendaPessoal(editando.id, editando.versao);
      setApagar(null);
      aoMudar();
    } catch (e) {
      setApagar(null);
      setErro(e);
    } finally {
      setSalvando(false);
    }
  };

  const mensagem = erro ? textoDoErroDoCalendario(erro, 'agenda') ?? textoDoErro(erro) : erros.geral ?? null;
  return (
    <Folha visivel={edicao !== null} titulo={editando ? 'Editar agenda' : 'Nova agenda'} aoFechar={aoFechar}
      rodape={<>
        {mensagem ? <View style={estilos.mensagem}><MensagemErro texto={mensagem} erro={erro ?? undefined} /></View> : null}
        {editando ? <Botao rotulo="Apagar agenda" tipo="perigoTexto" aoTocar={() => void pedirApagar()} carregando={contando}
          desabilitado={salvando || contando} motivo="Aguarde." /> : null}
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
        <Botao rotulo={editando ? 'Salvar agenda' : 'Criar agenda'} aoTocar={() => void salvar()} carregando={salvando && !apagar}
          desabilitado={salvando} motivo="Salvando." />
      </>}>
      <View style={estilos.campos}>
        <Campo rotulo="Nome da agenda" valor={nome} aoMudar={(t) => { setNome(t); setErros((e) => ({ ...e, nome: undefined })); setErro(null); }}
          erro={erros.nome} maxLength={LIMITES_DA_AGENDA.nome} ajuda={`Até ${LIMITES_DA_AGENDA.nome} caracteres. Ex.: Pessoal, Estudos.`} />
        <EscolhaDeCor valor={cor} aoMudar={(c) => { setCor(c); setErros((e) => ({ ...e, cor: undefined })); }} />
        {erros.cor ? <ErroDoCampo texto={erros.cor} /> : null}
        <Texto variante="suave">A cor só identifica a agenda. Só você vê as suas agendas e os eventos delas.</Texto>
      </View>
      {apagar ? <PainelConfirmacao visivel titulo="Apagar a agenda?" mensagem={textoDeApagarAgenda(apagar.eventos)} perigo
        rotuloConfirmar="Apagar agenda" rotuloCancelar="Voltar" carregando={salvando} aoConfirmar={() => void confirmarApagar()} aoCancelar={() => setApagar(null)} /> : null}
    </Folha>
  );
}

/** As 8 cores da paleta, cada uma com o nome escrito (a cor nunca é a única informação). Seleção invertida. */
function EscolhaDeCor({ valor, aoMudar }: { valor: CorDaAgenda; aoMudar: (c: CorDaAgenda) => void }) {
  const { cores } = useTema();
  const corDe = useCorDaAgenda();
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo">Cor</Texto>
      <View style={estilos.cores} role="radiogroup" aria-label="Cor">
        {CHAVES_DA_AGENDA.map((c) => {
          const ativo = c === valor;
          return (
            <Pressable key={c} role="radio" aria-checked={ativo} accessibilityState={{ checked: ativo }} accessibilityLabel={ROTULOS_DAS_CORES_DA_AGENDA[c]}
              onPress={() => aoMudar(c)}
              style={(e) => [estilos.cor, {
                backgroundColor: ativo ? cores.texto : sobre(e) ? cores.superficie3 : cores.superficie2, borderColor: ativo ? cores.texto : cores.borda,
              }]}>
              <View style={[estilos.amostra, { backgroundColor: corDe(c) }]} />
              <Texto style={[estilos.nomeDaCor, { color: ativo ? cores.fundo : cores.texto }]}>{ROTULOS_DAS_CORES_DA_AGENDA[c]}</Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: 2, marginHorizontal: -espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center' },
  caixaELinha: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1), borderRadius: RAIO },
  caixa: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nome: { flexShrink: 1 },
  campos: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  cores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  cor: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  amostra: { width: 16, height: 16, borderRadius: 8 },
  nomeDaCor: { fontFamily: fontes.semi, fontSize: 14 },
  mensagem: { flexBasis: '100%' },
});
