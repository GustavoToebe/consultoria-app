import { ArrowDown, ArrowUp, Ellipsis, MessageSquare } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { baixarCapaDaEquipe } from '../../api/comunidade';
import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import { CapaDoVideo } from '../../comunidade/CapaDoVideo';
import type { Direcao } from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { CaixaDaLinha } from '../../ui/LinhaDaLista';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  aula: AulaDaComunidade;
  /** Posição na coleção ("1", "2"…); ausente fora de coleção (o "Sem coleção" não tem ordem). */
  numero?: number;
  /** ⋯ (editar e excluir), só com `COMUNIDADE_MODERAR`. */
  aoMenu?: () => void;
  aoComentarios: () => void;
  aoAbrirFora: (url: string | null | undefined) => void;
  /** Subir/Descer dentro da coleção; cada direção já diz se pode andar. */
  mover?: { podeSubir: boolean; podeDescer: boolean; travado: boolean; aoMover: (d: Direcao) => void };
  /** Modo Selecionar: a caixa toma o lugar do ⋯ e das setas. */
  marcar?: { marcado: boolean; aoMudar: () => void };
}

/**
 * Cartão do vídeo na grade do treinador: título primeiro (com o número da posição na coleção ao lado), o estado discreto
 * (neutro), a descrição de apoio, a capa e, no rodapé, comentários à esquerda e Subir/Descer à direita.
 */
export function CartaoDoVideo({ aula, numero, aoMenu, aoComentarios, aoAbrirFora, mover, marcar }: Props) {
  const { cores } = useTema();
  const acoes = !aula.publicada || aoMenu || marcar ? (
    <View style={estilos.acoes}>
      {/* O Selo encolhe sem empurrar o ⋯ (ou a caixa) para fora do cartão em 390 px. */}
      {!aula.publicada ? <View style={[estilos.linha, estilos.encolher]}><Selo texto="Não publicado" tipo="neutro" /></View> : null}
      {marcar ? <CaixaDaLinha rotulo={`Selecionar ${aula.titulo}`} marcado={marcar.marcado} aoMudar={marcar.aoMudar} />
        : aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={`Ações do vídeo ${aula.titulo}`} aoTocar={aoMenu} /> : null}
    </View>
  ) : undefined;
  return (
    <Cartao titulo={aula.titulo} acoes={acoes}
      marcador={numero ? <Texto variante="bloco" cor={cores.textoSuave} style={estilos.numero}>{`${numero}.`}</Texto> : undefined}>
      {aula.descricao ? <Texto>{aula.descricao}</Texto> : null}
      <CapaDoVideo videoUrl={aula.videoUrl} titulo={aula.titulo} capaId={aula.capaId ?? null} baixarCapa={baixarCapaDaEquipe} aoAbrirFora={aoAbrirFora} />
      <View style={[estilos.linha, estilos.rodape, { borderTopColor: cores.divisor }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver ${aula.totalComentarios} comentário(s) do vídeo ${aula.titulo}`}
          onPress={aoComentarios}
          style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.sobre }]}>
          <MessageSquare size={18} color={cores.texto} aria-hidden />
          <Texto variante="suave" cor={cores.texto} numerico>{aula.totalComentarios} comentário(s)</Texto>
        </Pressable>
        {mover && !marcar ? (
          <View style={estilos.setas}>
            {/* Na ponta a seta não existe (a vaga segura a outra no lugar): o desabilitado com moldura quase não se distingue. */}
            {mover.podeSubir ? <IconeBotao Icone={ArrowUp} moldura rotulo={`Subir ${aula.titulo}`} desabilitado={mover.travado}
              aoTocar={() => mover.aoMover('cima')} /> : <View style={estilos.vaga} />}
            {mover.podeDescer ? <IconeBotao Icone={ArrowDown} moldura rotulo={`Descer ${aula.titulo}`} desabilitado={mover.travado}
              aoTocar={() => mover.aoMover('baixo')} /> : <View style={estilos.vaga} />}
          </View>
        ) : null}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, maxWidth: '100%' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flexShrink: 1, minWidth: 0 },
  numero: { fontSize: 17, lineHeight: 22 },
  rodape: { borderTopWidth: 1, paddingTop: espaco(1), justifyContent: 'space-between' },
  vaga: { width: ALVO_TOQUE, height: ALVO_TOQUE },
  setas: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), marginLeft: 'auto' },
  // Hover e pressionado pintam `sobre` (`ui/sobre`), como no mural do aluno.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
});
