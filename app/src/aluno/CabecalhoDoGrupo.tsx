import { StyleSheet, View } from 'react-native';

import type { Configuracao } from '../api/tipos';
import type { GrupoDeExercicios } from '../dominio/combinacoes';
import { explicacaoDaCombinacao } from '../dominio/metodologia';
import { detalheDoBloco } from '../dominio/textoDoGrupo';
import { espaco } from '../tema/tokens';
import { Texto } from '../ui/Texto';
import { SeloComExplicacao } from './SeloComExplicacao';

/**
 * Cabeçalho de um bloco de exercícios feitos juntos (superset, circuito, pré e pós-exaustão...): o nome da combinação
 * (toque abre a explicação), a ordem, as voltas e o descanso depois do grupo.
 */
export function CabecalhoDoGrupo({ bloco, metodologia }: { bloco: GrupoDeExercicios; metodologia?: Configuracao | null }) {
  if (!bloco.grupo || !bloco.nome) return null;
  return (
    <View style={estilos.cabecalho}>
      <SeloComExplicacao
        nome={bloco.nome}
        explicacao={explicacaoDaCombinacao(metodologia, bloco.grupo.tecnica)}
        rotuloAcessivel={`Explicação de ${bloco.nome}`}
      />
      <Texto numerico variante="pequeno">{detalheDoBloco(bloco)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({ cabecalho: { gap: espaco(0.5) } });
