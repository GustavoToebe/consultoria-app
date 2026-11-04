import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Bloco, Rascunho } from '../dominio/montador';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_BLOCO, espaco, fontes, RAIO } from '../tema/tokens';
import { Vazio } from '../ui/Estados';
import { IconeBotao } from '../ui/IconeBotao';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { CATALOGO_MONTADOR } from './catalogo';

interface Props {
  rascunho: Rascunho;
  selecionadoId: string | null;
  aoSelecionar: (id: string | null) => void;
  aoMover: (id: string, direcao: 'cima' | 'baixo') => void;
  aoDuplicar: (id: string) => void;
  aoInserirAbaixo: (id: string) => void;
  aoPedirRemover: (id: string) => void;
}

export function Prancheta({
  rascunho,
  selecionadoId,
  aoSelecionar,
  aoMover,
  aoDuplicar,
  aoInserirAbaixo,
  aoPedirRemover,
}: Props) {
  const { cores, bordas } = useTema();

  return (
    <ScrollView style={estilos.rolagemVertical} contentContainerStyle={estilos.containerVertical}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={estilos.containerHorizontal}
      >
        <View
          testID="moldura-prancheta"
          style={[
            estilos.moldura,
            {
              width: rascunho.largura,
              backgroundColor: cores.fundo,
              borderColor: cores.borda,
              borderWidth: bordas.bloco,
            },
          ]}
        >
          {rascunho.blocos.length === 0 ? (
            <Vazio
              titulo="Prancheta vazia"
              texto="Clique em um bloco na paleta para adicioná-lo ou escolha um modelo pronto na barra superior."
            />
          ) : (
            rascunho.blocos.map((bloco, indice) => (
              <ItemBloco
                key={bloco.id}
                bloco={bloco}
                primeiro={indice === 0}
                ultimo={indice === rascunho.blocos.length - 1}
                selecionadoId={selecionadoId}
                aoSelecionar={aoSelecionar}
                aoMover={aoMover}
                aoDuplicar={aoDuplicar}
                aoInserirAbaixo={aoInserirAbaixo}
                aoPedirRemover={aoPedirRemover}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function ItemBloco({
  bloco,
  primeiro,
  ultimo,
  selecionadoId,
  aoSelecionar,
  aoMover,
  aoDuplicar,
  aoInserirAbaixo,
  aoPedirRemover,
}: {
  bloco: Bloco;
  primeiro: boolean;
  ultimo: boolean;
  selecionadoId: string | null;
  aoSelecionar: (id: string) => void;
  aoMover: (id: string, direcao: 'cima' | 'baixo') => void;
  aoDuplicar: (id: string) => void;
  aoInserirAbaixo: (id: string) => void;
  aoPedirRemover: (id: string) => void;
}) {
  const { cores } = useTema();
  const cat = CATALOGO_MONTADOR[bloco.tipo];
  const selecionado = selecionadoId === bloco.id;
  const listaFilhos = bloco.filhos ?? [];

  const filhosNode = cat.aceitaFilhos ? (
    listaFilhos.length > 0 ? (
      listaFilhos.map((filho, idx) => (
        <ItemBloco
          key={filho.id}
          bloco={filho}
          primeiro={idx === 0}
          ultimo={idx === listaFilhos.length - 1}
          selecionadoId={selecionadoId}
          aoSelecionar={aoSelecionar}
          aoMover={aoMover}
          aoDuplicar={aoDuplicar}
          aoInserirAbaixo={aoInserirAbaixo}
          aoPedirRemover={aoPedirRemover}
        />
      ))
    ) : (
      <Texto variante="pequeno">
        Contêiner vazio ({cat.rotulo}) — selecione e toque num bloco na paleta para inserir dentro.
      </Texto>
    )
  ) : null;

  return (
    <View
      onPointerDown={(e) => {
        e.stopPropagation();
        aoSelecionar(bloco.id);
      }}
      style={[
        estilos.bloco,
        selecionado
          ? {
              borderColor: cores.bordaCampo,
              borderWidth: BORDA_BLOCO,
              backgroundColor: cores.superficie,
              padding: espaco(1),
            }
          : estilos.blocoInativo,
      ]}
    >
      {selecionado ? (
        <View
          style={[
            estilos.barraSelecionado,
            { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo },
          ]}
        >
          <Texto variante="pequeno" style={estilos.rotuloTipo}>
            {`${cat.rotulo} (${bloco.tipo})`}
          </Texto>
          <View style={estilos.acoesBloco}>
            <IconeBotao
              Icone={ArrowUp}
              rotulo="Mover para cima"
              compacto
              moldura
              desabilitado={primeiro}
              aoTocar={() => aoMover(bloco.id, 'cima')}
            />
            <IconeBotao
              Icone={ArrowDown}
              rotulo="Mover para baixo"
              compacto
              moldura
              desabilitado={ultimo}
              aoTocar={() => aoMover(bloco.id, 'baixo')}
            />
            <BotaoAcaoCurta
              Icone={Copy}
              rotulo="Duplicar"
              aoTocar={() => aoDuplicar(bloco.id)}
            />
            <BotaoAcaoCurta
              Icone={Plus}
              rotulo="Inserir abaixo"
              aoTocar={() => aoInserirAbaixo(bloco.id)}
            />
            <BotaoAcaoCurta
              Icone={Trash2}
              rotulo="Remover"
              perigo
              aoTocar={() => aoPedirRemover(bloco.id)}
            />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Selecionar bloco ${cat.rotulo}`}
          onPress={() => aoSelecionar(bloco.id)}
          style={estilos.etiquetaInativa}
        >
          <Texto variante="pequeno">{cat.rotulo}</Texto>
        </Pressable>
      )}
      <View style={estilos.mioloBloco}>{cat.desenhar(bloco.props, filhosNode)}</View>
    </View>
  );
}

function BotaoAcaoCurta({
  Icone,
  rotulo,
  perigo,
  aoTocar,
}: {
  Icone: typeof Copy;
  rotulo: string;
  perigo?: boolean;
  aoTocar: () => void;
}) {
  const { cores } = useTema();
  const cor = perigo ? cores.perigo : cores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={(estado) => [
        estilos.botaoCurto,
        {
          borderColor: cores.bordaCampo,
          backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie,
        },
      ]}
    >
      <Icone size={14} color={cor} strokeWidth={2} />
      <Texto variante="pequeno" cor={cor} style={estilos.textoBotaoCurto}>
        {rotulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  rolagemVertical: { flex: 1, minHeight: 0 },
  containerVertical: { paddingBottom: espaco(4) },
  containerHorizontal: { flexGrow: 1 },
  moldura: {
    marginHorizontal: 'auto',
    borderRadius: RAIO,
    padding: espaco(2.5),
    gap: espaco(2),
    minHeight: 480,
  },
  bloco: {
    borderRadius: RAIO,
    gap: espaco(1),
  },
  blocoInativo: {
    borderWidth: 0,
  },
  etiquetaInativa: {
    alignSelf: 'flex-start',
    minHeight: ALVO_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: espaco(1),
  },
  barraSelecionado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: espaco(1.5),
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.75),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  rotuloTipo: {
    fontFamily: fontes.semi,
  },
  acoesBloco: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(0.75),
  },
  botaoCurto: {
    minHeight: ALVO_TOQUE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.5),
    paddingHorizontal: espaco(1.25),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  textoBotaoCurto: {
    fontFamily: fontes.semi,
  },
  mioloBloco: {
    gap: espaco(1.5),
  },
});
