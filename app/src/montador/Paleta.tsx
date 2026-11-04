import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  DEFINICOES_DE_BLOCO,
  GRUPOS_DO_CATALOGO,
  podeInserirDentro,
  type Bloco,
  type TipoDeBloco,
} from '../dominio/montador';
import { semAcento } from '../dominio/telas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { LISTA_DO_CATALOGO } from './catalogo';

interface Props {
  selecionado: Bloco | null;
  forcarAbaixo: boolean;
  aoInserir: (tipo: TipoDeBloco) => void;
}

export function Paleta({ selecionado, forcarAbaixo, aoInserir }: Props) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca);

  const filtrados = termo
    ? LISTA_DO_CATALOGO.filter((item) =>
        semAcento(`${item.rotulo} ${item.tipo} ${item.grupo}`).includes(termo),
      )
    : LISTA_DO_CATALOGO;

  const destinoTexto = !selecionado
    ? 'Inserindo no fim da tela'
    : !forcarAbaixo && DEFINICOES_DE_BLOCO[selecionado.tipo].aceitaFilhos && (selecionado.filhos?.length ?? 0) === 0
      ? `Inserindo dentro de: ${DEFINICOES_DE_BLOCO[selecionado.tipo].rotulo}`
      : `Inserindo abaixo de: ${DEFINICOES_DE_BLOCO[selecionado.tipo].rotulo}`;

  return (
    <View style={estilos.painel}>
      <Campo
        rotulo="Buscar bloco"
        valor={busca}
        aoMudar={setBusca}
        placeholder="Ex.: cartão, linha, botão…"
        autoCorrect={false}
      />
      <Texto variante="pequeno">{destinoTexto}</Texto>
      <ScrollView contentContainerStyle={estilos.lista}>
        {GRUPOS_DO_CATALOGO.map((grupo) => {
          const itens = filtrados.filter((i) => i.grupo === grupo);
          if (itens.length === 0) return null;
          return (
            <View key={grupo} style={estilos.grupo}>
              <Texto variante="secao" nivel={2}>
                {grupo}
              </Texto>
              <View style={estilos.itens}>
                {itens.map((item) => {
                  const vaiDentro =
                    !!selecionado &&
                    !forcarAbaixo &&
                    (selecionado.filhos?.length ?? 0) === 0 &&
                    podeInserirDentro(selecionado, item.tipo);
                  return (
                    <Pressable
                      key={item.tipo}
                      accessibilityRole="button"
                      accessibilityLabel={`Inserir ${item.rotulo}`}
                      onPress={() => aoInserir(item.tipo)}
                      style={(estado) => [
                        estilos.item,
                        {
                          backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2,
                          borderColor: vaiDentro ? cores.bordaCampo : cores.borda,
                        },
                      ]}
                    >
                      <View style={estilos.itemTextos}>
                        <Texto style={estilos.rotulo}>{item.rotulo}</Texto>
                        {item.aceitaFilhos ? <Selo texto="Contêiner" tipo="neutro" /> : null}
                      </View>
                      <Plus size={18} color={cores.textoSuave} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        {filtrados.length === 0 ? <Texto variante="suave">Nenhum bloco encontrado para esta busca.</Texto> : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  painel: { flex: 1, minHeight: 0, gap: espaco(1.5) },
  lista: { gap: espaco(2), paddingBottom: espaco(2) },
  grupo: { gap: espaco(1) },
  itens: { gap: espaco(0.75) },
  item: {
    minHeight: ALVO_TOQUE,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco(1),
  },
  itemTextos: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(0.75),
  },
  rotulo: { fontFamily: fontes.semi },
});
