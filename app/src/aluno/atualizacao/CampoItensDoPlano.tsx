import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ItemDaLista, PerguntaAtualizacao, RespostaAtualizacao } from '../../api/tipos';
import {
  alternarItem, filtrarItens, foraDaLista, MOTIVO_DO_LIMITE, mudarMotivo, noLimite, rotuloDaBusca, rotuloDoCampoDoMotivo,
  textoDaContagem, textoDaListaVazia,
} from '../../dominio/campoItensDoPlano';
import { LIMITES_DE_ITENS, maximoDeItens, modoDoMotivo } from '../../dominio/questionario';
import { itensDaResposta, respostaDeItens } from '../../dominio/respostasAtualizacao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Texto } from '../../ui/Texto';

interface Props {
  p: PerguntaAtualizacao;
  valor: RespostaAtualizacao;
  /** Itens da fonte da pergunta (`useItensDaAtualizacao`; na prévia do editor, fictícios). */
  lista: readonly ItemDaLista[];
  /** Rótulo com " *" quando obrigatória. */
  rotulo: string;
  ajuda: ReactNode;
  erro?: string;
  aoMudar: (valor: RespostaAtualizacao) => void;
}

/**
 * ITENS_DO_PLANO para responder: escolher da lista que vem do plano (alimentos da dieta, exercícios do treino ou dias
 * treinados). Escolha única segue a ESCOLHA_UNICA (chips até 8, folha com busca acima disso); várias seguem a
 * MULTIPLA_ESCOLHA (caixas), com busca a partir de 8 itens e os desmarcados desabilitados no limite. Com motivo, o campo
 * aparece embaixo de cada item marcado. Item marcado que saiu da lista fica visível para remover.
 */
export function CampoItensDoPlano({ p, valor, lista, rotulo, ajuda, erro, aoMudar }: Props) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const marcados = itensDaResposta(valor);
  const sobrando = foraDaLista(valor, lista);
  const comMotivo = modoDoMotivo(p) !== 'NENHUM';
  const faltaMotivo = !!erro && modoDoMotivo(p) === 'OBRIGATORIO';
  const unica = maximoDeItens(p) === 1;
  const mensagemErro = erro ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erro}</Texto> : null;

  const campoDoMotivo = (item: ItemDaLista) => {
    const motivo = marcados.find((m) => m.id === item.id)?.motivo ?? '';
    return <Campo key={`motivo:${item.id}`} rotulo={rotuloDoCampoDoMotivo(p)} rotuloAcessivel={`${rotuloDoCampoDoMotivo(p)} — ${item.nome}`}
      valor={motivo} aoMudar={(t) => aoMudar(mudarMotivo(valor, item.id, t))} maxLength={LIMITES_DE_ITENS.motivoTamanho} linhas={2}
      erro={faltaMotivo && motivo.trim() === '' ? 'Escreva o motivo.' : undefined} />;
  };
  const removiveis = sobrando.length ? <View style={estilos.lista}>
    {sobrando.map((s) => <View key={s.id} style={[estilos.foraDaLista, { borderColor: cores.divisor }]}>
      <Texto style={estilos.textoForaDaLista}>{s.nome ?? 'Item marcado antes'} · não está mais na lista</Texto>
      <Botao tipo="fantasma" rotulo="Remover" rotuloAcessivel={`Remover ${s.nome ?? 'item que não está mais na lista'}`}
        aoTocar={() => aoMudar(marcados.length > 1 ? respostaDeItens(marcados.filter((m) => m.id !== s.id)) : null)} />
    </View>)}
  </View> : null;

  if (lista.length === 0) return <View style={estilos.pergunta}>
    <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
    {ajuda}
    <Texto variante="suave">{textoDaListaVazia(p.fonte)}</Texto>
    {removiveis}{mensagemErro}
  </View>;

  if (unica) {
    const opcoes = lista.map((i) => ({ valor: i.id, rotulo: i.nome }));
    const escolhido = lista.find((i) => marcados.some((m) => m.id === i.id)) ?? null;
    const escolher = (id: string | null) => {
      if (id == null) aoMudar(null);
      else if (id !== escolhido?.id) aoMudar(alternarItem(p, valor, id));
    };
    return <View style={estilos.pergunta}>
      {lista.length > OPCOES_PARA_BUSCAR ? <>
        <EscolhaEmFolha rotulo={rotulo} valor={escolhido?.id ?? null} opcoes={opcoes} aoMudar={escolher} rotuloDoValor="Escolher" />
        {!p.obrigatoria && escolhido ? <Botao tipo="fantasma" rotulo="Limpar" rotuloAcessivel={`Limpar ${p.rotulo}`} aoTocar={() => aoMudar(null)} /> : null}
      </> : <Escolha chips rotulo={rotulo} opcoes={opcoes} valor={escolhido?.id ?? null} limpavel={!p.obrigatoria} aoMudar={escolher} />}
      {ajuda}
      {escolhido && comMotivo ? campoDoMotivo(escolhido) : null}
      {removiveis}{mensagemErro}
    </View>;
  }

  const limite = noLimite(p, valor);
  const comBusca = lista.length > OPCOES_PARA_BUSCAR;
  // Os marcados ficam sempre na tela, mesmo fora da busca: o motivo deles não some enquanto se procura outro.
  const achados = new Set(filtrarItens(lista, busca).map((i) => i.id));
  const visiveis = lista.filter((i) => achados.has(i.id) || marcados.some((m) => m.id === i.id));
  return <View style={estilos.pergunta}>
    <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
    {ajuda}
    <Texto variante="pequeno" numerico>{[textoDaContagem(p, valor), limite ? MOTIVO_DO_LIMITE : null].filter(Boolean).join(' ')}</Texto>
    {comBusca ? <Campo rotulo={rotuloDaBusca(p.fonte)} valor={busca} aoMudar={setBusca} autoCorrect={false} enterKeyHint="search" /> : null}
    <View style={estilos.lista}>
      {visiveis.map((i) => {
        const marcado = marcados.some((m) => m.id === i.id);
        return <View key={i.id} style={estilos.item}>
          <CaixaSelecao rotulo={i.nome} marcado={marcado} desabilitado={limite && !marcado} ajuda={limite && !marcado ? MOTIVO_DO_LIMITE : undefined}
            aoMudar={() => aoMudar(alternarItem(p, valor, i.id))} />
          {marcado && comMotivo ? <View style={estilos.motivo}>{campoDoMotivo(i)}</View> : null}
        </View>;
      })}
      {comBusca && visiveis.length === 0 ? <Texto variante="suave">Nada encontrado com essa busca.</Texto> : null}
    </View>
    {removiveis}{mensagemErro}
  </View>;
}

const estilos = StyleSheet.create({
  pergunta: { gap: espaco(1) },
  lista: { gap: espaco(1) },
  item: { gap: espaco(1) },
  // O motivo fica recuado sob o item e com folga antes do próximo: lê-se como parte do item marcado.
  motivo: { paddingLeft: espaco(2), marginBottom: espaco(1) },
  foraDaLista: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO_CONTROLE, paddingLeft: espaco(1.5) },
  textoForaDaLista: { flex: 1 },
});
