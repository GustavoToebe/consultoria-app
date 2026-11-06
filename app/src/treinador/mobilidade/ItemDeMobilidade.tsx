import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ItemMobilidade } from '../../dominio/mobilidade';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';

interface Props {
  item: ItemMobilidade;
  posicao: number;
  total: number;
  /** Nome ou "item sem nome" com o problema (borda vermelha), como o alimento da dieta. */
  comProblema: boolean;
  aberto: boolean;
  /** Sem ele, o item fica sempre aberto (o inspetor do editor em duas colunas): o nome é o próprio campo, sem chevron. */
  aoAlternar?: () => void;
  aoMudar: (parcial: Partial<ItemMobilidade>) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
}

/** "2 x 20s cada lado · com vídeo"; sem nada, "Sem prescrição". */
export function resumoDoItem(it: ItemMobilidade): string {
  return [it.prescricao.trim() || 'Sem prescrição', it.videoUrl.trim() ? 'com vídeo' : null].filter(Boolean).join(' · ');
}

/**
 * Um item da seção (a segunda e última moldura): o número invertido, o nome, a prescrição e o vídeo (só link). No
 * inspetor ele fica sempre aberto e o nome é o campo da primeira linha (aparece uma vez só); os três campos dividem a
 * linha conforme a largura (os três em 1920, nome e prescrição em 1280 e 1440, um por linha no celular). Empilhado, o
 * item fechado é uma linha com nome, resumo e o chevron, e abre no lugar com as ações (gramática do `CabecalhoDoItem`).
 */
export function ItemDeMobilidade({ item: it, posicao, total, comProblema, aberto, aoAlternar, aoMudar, aoMover, aoRemover }: Props) {
  const { cores } = useTema();
  const n = posicao + 1;
  // O nome dos botões e dos campos leva o item: "Subir Gato-vaca", nunca "Subir item" igual em todos.
  const nome = it.nome.trim() || `item ${n}`;
  const lixeira = <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />;
  const campoNome = <Campo rotulo="Nome" rotuloAcessivel={`Nome do item ${n}`} valor={it.nome} maxLength={120} placeholder="Ex.: Gato-vaca"
    // A borda vermelha e o "Corrigir" da seção diziam que algo falta; o campo diz o quê (o mesmo vale para o vídeo).
    erro={it.nome.trim() ? null : 'Informe o nome.'} aoMudar={(v) => aoMudar({ nome: v })} />;
  const outros = <>
    <View style={estilos.campoCurto}>
      <Campo rotulo="Prescrição" rotuloAcessivel={`Prescrição do item ${n}`} valor={it.prescricao} maxLength={120} placeholder="Ex.: 2 x 20s cada lado" aoMudar={(v) => aoMudar({ prescricao: v })} />
    </View>
    <View style={estilos.campoVideo}>
      <Campo rotulo="Vídeo (link do YouTube, opcional)" rotuloAcessivel={`Vídeo do item ${n} (link do YouTube, opcional)`} valor={it.videoUrl} maxLength={500}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" erro={erroDoVideo(it.videoUrl)} aoMudar={(v) => aoMudar({ videoUrl: v })} />
    </View>
  </>;
  const caixa = [estilos.caixa, { borderColor: comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 }];

  if (!aoAlternar) {
    return (
      <View style={caixa}>
        <View style={estilos.linha}>
          <View style={estilos.numeroDoCampo}><NumeroInvertido numero={n} invertido={false} /></View>
          <View style={estilos.campos}>
            <View style={estilos.campoCurto}>{campoNome}</View>
            {outros}
          </View>
          <View style={estilos.acoes}>
            {total > 1 ? <>
              <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nome}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
              <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nome}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
            </> : null}
            {lixeira}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={caixa}>
      <View style={estilos.linhaCentro}>
        <NumeroInvertido numero={n} invertido={false} />
        <View style={estilos.cresce}>
          <CabecalhoDoItem titulo={it.nome.trim() || 'Item sem nome'} resumo={aberto ? undefined : resumoDoItem(it)} aberto={aberto} aoAlternar={aoAlternar}
            // Fechado, só o chevron: no celular as quatro ações espremiam o nome em três linhas; abrir mostra Subir, Descer e Remover.
            nomeDoItem={nome} posicao={posicao} total={total} aoMover={aberto ? aoMover : undefined} remover={aberto ? lixeira : undefined} />
        </View>
      </View>
      {aberto ? <View style={[estilos.campos, estilos.corpo]}>
        <View style={estilos.inteiro}>{campoNome}</View>
        {outros}
      </View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.25), paddingVertical: espaco(1), gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  linhaCentro: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  cresce: { flex: 1, minWidth: 0 },
  // Os campos se dividem pela largura: cada um tem um mínimo e cresce; o que não cabe desce para a linha de baixo.
  campos: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  corpo: { paddingBottom: espaco(0.5) },
  campoCurto: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  campoVideo: { flexGrow: 1.4, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  inteiro: { width: '100%' },
  // Alinha o número e as setas com a caixa do campo, não com o rótulo em cima dele.
  numeroDoCampo: { paddingTop: 30 },
  acoes: { flexDirection: 'row', alignItems: 'center', paddingTop: 22 },
});
