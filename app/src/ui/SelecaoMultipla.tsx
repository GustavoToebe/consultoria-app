import { ScrollView, StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { Botao } from './Botao';
import { CaixaSelecao } from './CaixaSelecao';
import { Texto } from './Texto';

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
}

interface Props {
  rotulo: string;
  opcoes: OpcaoMultipla[];
  marcados: ReadonlySet<string>;
  aoMudar: (marcados: Set<string>) => void;
}

/** Lista de opções com caixa de seleção (várias de uma vez), com "Marcar todos" e "Limpar" e rolagem própria. */
export function SelecaoMultipla({ rotulo, opcoes, marcados, aoMudar }: Props) {
  const alternar = (valor: string, marcar: boolean) => {
    const novo = new Set(marcados);
    if (marcar) novo.add(valor);
    else novo.delete(valor);
    aoMudar(novo);
  };
  const quantos = opcoes.filter((o) => marcados.has(o.valor)).length;
  return (
    <View style={estilos.campo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View style={estilos.acoes}>
        <Texto variante="pequeno" numerico style={estilos.contagem}>
          {quantos} de {opcoes.length} marcados
        </Texto>
        <Botao rotulo="Marcar todos" tipo="secundario" aoTocar={() => aoMudar(new Set(opcoes.map((o) => o.valor)))} />
        <Botao rotulo="Limpar" tipo="secundario" aoTocar={() => aoMudar(new Set())} />
      </View>
      <ScrollView style={estilos.lista} contentContainerStyle={estilos.conteudo} nestedScrollEnabled>
        {opcoes.map((o) => (
          <CaixaSelecao key={o.valor} rotulo={o.rotulo} marcado={marcados.has(o.valor)} aoMudar={(m) => alternar(o.valor, m)} />
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.75) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  contagem: { flexGrow: 1 },
  lista: { maxHeight: 288 },
  conteudo: { gap: espaco(0.75) },
});
