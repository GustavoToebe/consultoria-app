import { ChevronDown, ChevronRight, Ellipsis, Plus, Trash2, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { abertaDepoisDeMover, abertaDepoisDeRemover, LIMITES_DOS_COMPLEMENTOS, problemaDaOrientacao } from '../../dominio/complementosDaDieta';
import { mover, substituir } from '../../dominio/editorTreino';
import { moverPara } from '../../dominio/reordenar';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { coresDaEdicao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { ContadorDeCaracteres } from './ContadorDeCaracteres';

type Orientacao = ConteudoDieta['orientacoes'][number];

/** Abaixo disto (lista medida), o começo do texto desce para baixo do título: lado a lado, os dois ficavam curtos demais. */
const LARGURA_EM_LINHA = 520;

/**
 * Aba Orientações do cartão Complementos (25/11): lista compacta e reordenável, uma linha por orientação com a alça, o
 * título em negrito, o começo do texto em secundário (uma linha, reticências) e o ⋯ (mover e excluir, com Desfazer).
 * Tocar na linha abre a edição ali mesmo (a aba toda fica em largura de leitura); só uma aberta por vez, e a nova já nasce
 * aberta com o foco no título. As orientações não têm uid: a aberta é um índice que segue o item ao mover e ao remover.
 */
export function OrientacoesDaDieta({ orientacoes, aoMudar, aoRemover }: {
  orientacoes: Orientacao[];
  aoMudar: (lista: Orientacao[]) => void;
  /** Remove com a barra "Desfazer" do editor. */
  aoRemover: (indice: number) => void;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [focarNova, setFocarNova] = useState(false);
  const [largura, setLargura] = useState(0);
  const moverDe = (de: number, para: number) => {
    aoMudar(moverPara(orientacoes, de, para));
    setAberta((a) => abertaDepoisDeMover(a, de, para));
  };
  const arraste = useArrasteDaLista({ total: orientacoes.length, folga: 3, aoSoltar: moverDe });
  // Desfazer devolveu ou tirou itens por fora: um índice que ficou para fora da lista fecha.
  const abertaValida = aberta !== null && aberta < orientacoes.length ? aberta : null;
  const emLinha = largura >= LARGURA_EM_LINHA;

  return (
    <View style={estilos.aba}>
      {orientacoes.length === 0 ? (
        <Texto variante="suave">Nenhuma orientação ainda. Escreva o que o aluno deve ler junto com a dieta (água, preparo, trocas).</Texto>
      ) : (
        <View style={estilos.itens} role="group" accessibilityLabel="Orientações da dieta" onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
          {orientacoes.map((o, i) => (
            <ItemArrastavel key={i} arraste={arraste} indice={i}>
              <LinhaDaOrientacao orientacao={o} posicao={i} total={orientacoes.length} emLinha={emLinha}
                aberta={abertaValida === i} focar={focarNova && abertaValida === i}
                alca={<AlcaDeArraste arraste={arraste} indice={i} />}
                aoAlternar={() => { setFocarNova(false); setAberta(abertaValida === i ? null : i); }}
                aoMudar={(nova) => aoMudar(substituir(orientacoes, i, nova))}
                aoMover={(d) => { aoMudar(mover(orientacoes, i, d)); setAberta((a) => abertaDepoisDeMover(a, i, i + d)); }}
                aoRemover={() => { setAberta((a) => abertaDepoisDeRemover(a, i)); aoRemover(i); }} />
            </ItemArrastavel>
          ))}
        </View>
      )}
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar orientação" tipo="acao" Icone={Plus} aoTocar={() => {
          aoMudar([...orientacoes, { titulo: '', texto: '' }]);
          setAberta(orientacoes.length);
          setFocarNova(true);
        }} />
      </LinhaDeAcoes>
    </View>
  );
}

function LinhaDaOrientacao({ orientacao: o, posicao, total, emLinha, aberta, focar, alca, aoAlternar, aoMudar, aoMover, aoRemover }: {
  orientacao: Orientacao;
  posicao: number;
  total: number;
  emLinha: boolean;
  aberta: boolean;
  focar: boolean;
  alca: ReactNode;
  aoAlternar: () => void;
  aoMudar: (o: Orientacao) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
}) {
  const { cores } = useTema();
  const [menu, setMenu] = useState(false);
  const n = posicao + 1;
  const titulo = o.titulo.trim();
  const nome = titulo || `orientação ${n}`;
  const problema = problemaDaOrientacao(o);
  const Seta = aberta ? ChevronDown : ChevronRight;
  const L = LIMITES_DOS_COMPLEMENTOS;
  const acoes = [
    ...acoesDeMover({ nome, posicao, total, aoMover }),
    { rotulo: 'Excluir orientação', detalhe: `Remover ${nome}. Dá para desfazer logo depois.`, Icone: Trash2, perigo: true, aoTocar: aoRemover },
  ];
  const fundo = aberta ? coresDaEdicao(cores).fundoDoBloco : cores.superficie2;
  return (
    <View style={[estilos.faixa, { backgroundColor: fundo, borderColor: problema === 'perigo' ? cores.perigo : 'transparent' }]}>
      <View style={estilos.linha}>
        <View style={estilos.colunaDaAlca}>{alca}</View>
        <Pressable accessibilityRole="button" aria-expanded={aberta}
          accessibilityLabel={`Orientação ${n} de ${total}: ${titulo || 'sem título'}${problema === 'atencao' ? ', falta o título' : problema === 'perigo' ? ', texto acima do limite' : ''}. ${aberta ? 'Fechar edição' : 'Editar'}`}
          onPress={aoAlternar} style={estilos.botaoDaLinha}>
          {(estado) => (
            <View style={[estilos.resumo, emLinha ? estilos.resumoEmLinha : null, sobre(estado) && !aberta ? { backgroundColor: cores.superficie3 } : null]}>
              <View style={[estilos.titulo, emLinha ? estilos.tituloEmLinha : null]}>
                <Seta size={16} color={aberta ? cores.acao : cores.textoSuave} strokeWidth={2.25} aria-hidden />
                {problema === 'atencao' ? <TriangleAlert size={14} color={cores.atencao} strokeWidth={2.5} aria-hidden /> : null}
                <Texto numberOfLines={1} style={[estilos.textoDoTitulo, titulo ? null : { color: cores.textoSuave }]}>{titulo || 'Sem título'}</Texto>
              </View>
              {aberta ? null : (
                <Texto variante="suave" numberOfLines={1} style={[estilos.comeco, emLinha ? estilos.comecoEmLinha : null]}>{o.texto.trim() || '—'}</Texto>
              )}
            </View>
          )}
        </Pressable>
        <View style={estilos.colunaDoMais}>
          <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${nome}`} aoTocar={() => setMenu(true)} />
        </View>
      </View>
      {aberta ? (
        <View style={estilos.edicao} role="group" accessibilityLabel={`Editando orientação ${n}`}>
          <Campo rotulo="Título" rotuloAcessivel={`Título da orientação ${n}`} valor={o.titulo} maxLength={L.tituloDaOrientacao} autoFocus={focar}
            placeholder="Ex.: Hidratação" aoMudar={(t) => aoMudar({ ...o, titulo: t })} />
          <View style={estilos.campoDoTexto}>
            <Campo rotulo="Texto" rotuloAcessivel={`Texto da orientação ${n}`} valor={o.texto} linhas={5} maxLength={L.textoDaOrientacao}
              erro={o.texto.length > L.textoDaOrientacao ? `Até ${L.textoDaOrientacao} caracteres.` : null}
              aoMudar={(t) => aoMudar({ ...o, texto: t })} />
            <ContadorDeCaracteres usados={o.texto.length} maximo={L.textoDaOrientacao} />
          </View>
        </View>
      ) : null}
      {menu ? <FolhaDeAcoes titulo={titulo || 'Orientação sem título'} aoFechar={() => setMenu(false)} acoes={acoes} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Largura de leitura (~72 caracteres), à esquerda do cartão: a lista, a edição aberta e o botão (26/11).
  aba: { gap: espaco(2), maxWidth: LARGURA_TEXTO_CORRIDO },
  itens: { gap: 6 },
  faixa: { borderRadius: 12, borderWidth: 1, paddingHorizontal: espaco(1), paddingVertical: espaco(0.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  colunaDaAlca: { width: LARGURA_DA_ALCA },
  colunaDoMais: { width: ALVO_TOQUE },
  botaoDaLinha: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: 8 },
  resumo: { gap: 2, paddingHorizontal: espaco(1), paddingVertical: espaco(0.75), borderRadius: 8 },
  resumoEmLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), minWidth: 0 },
  // Em linha, o título fica com no máximo 40% e o começo do texto com o resto (nenhum dos dois empurra o ⋯).
  tituloEmLinha: { flexShrink: 0, maxWidth: '40%' },
  textoDoTitulo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  comeco: { paddingLeft: 16 + espaco(0.75) },
  comecoEmLinha: { flex: 1, minWidth: 0, paddingLeft: 0 },
  edicao: { gap: espaco(1.5), paddingTop: espaco(1), paddingBottom: espaco(1.5), paddingLeft: LARGURA_DA_ALCA + espaco(1.5), paddingRight: espaco(1) },
  campoDoTexto: { gap: espaco(0.5) },
});
