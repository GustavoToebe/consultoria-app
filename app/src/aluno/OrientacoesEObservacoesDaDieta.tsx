import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../api/tipos';
import { fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';
import { TextoFormatado } from '../ui/TextoFormatado';

/**
 * Orientações e observações da dieta como o aluno lê (27/11): o texto do treinador com o formato simples aplicado
 * (`ui/TextoFormatado`: `**negrito**`, `__sublinhado__`, quebras de linha), nunca os asteriscos crus. Só o miolo: o cartão
 * recolhível fica com quem chama (a `DietaDoAluno`; a prévia do editor monta o dela).
 */
export function OrientacaoDaDieta({ orientacao }: { orientacao: ConteudoDieta['orientacoes'][number] }) {
  return (
    <View style={estilos.orientacao}>
      {orientacao.titulo ? <Texto numerico style={estilos.forte}>{orientacao.titulo}</Texto> : null}
      <TextoFormatado texto={orientacao.texto} variante="suave" />
    </View>
  );
}

export function ObservacoesDaDieta({ texto }: { texto: string | null | undefined }) {
  return <TextoFormatado texto={texto} />;
}

const estilos = StyleSheet.create({
  orientacao: { gap: 2 },
  forte: { fontFamily: fontes.semi },
});
