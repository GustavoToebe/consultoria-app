import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { numeroParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Botao } from './Botao';

/** "−" e "+" da carga, de passo em passo do arredondamento da metodologia. O que vale é a conta de `ajustarCarga`. */
export function AjusteDeCarga({ passo, rotulo, aoAjustar }: { passo: number; rotulo: string; aoAjustar: (sentido: 1 | -1) => void }) {
  const texto = `${numeroParaTela(passo)} kg`;
  return (
    <View style={estilos.linha}>
      <Botao rotulo={`− ${texto}`} rotuloAcessivel={`Diminuir ${texto} em ${rotulo}`} tipo="secundario" Icone={Minus} aoTocar={() => aoAjustar(-1)} />
      <Botao rotulo={`+ ${texto}`} rotuloAcessivel={`Aumentar ${texto} em ${rotulo}`} tipo="secundario" Icone={Plus} aoTocar={() => aoAjustar(1)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
