import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { sobre } from './sobre';

/**
 * "−" e "+" da carga, de passo em passo do arredondamento da metodologia. O que vale é a conta de `ajustarCarga`. O
 * sinal fica só no ícone (o rótulo "− 0,5 kg" com o ícone de menos mostrava o sinal duas vezes).
 */
export function AjusteDeCarga({ passo, rotulo, aoAjustar }: { passo: number; rotulo: string; aoAjustar: (sentido: 1 | -1) => void }) {
  const texto = `${numeroParaTela(passo)} kg`;
  return (
    <View style={estilos.linha}>
      <Botao rotulo={texto} rotuloAcessivel={`Diminuir ${texto} em ${rotulo}`} tipo="secundario" Icone={Minus} aoTocar={() => aoAjustar(-1)} />
      <Botao rotulo={texto} rotuloAcessivel={`Aumentar ${texto} em ${rotulo}`} tipo="secundario" Icone={Plus} aoTocar={() => aoAjustar(1)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  passo: { width: 52, height: 52, borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Um lado do ajuste, quadrado e só com o ícone, para ficar ao lado do campo (carga de trabalho): `[−] campo [+]` cabe
 * numa linha em 360 px, e o leitor de tela ouve "Diminuir 0,5 kg em …".
 */
export function BotaoDePasso({ sentido, passo, rotulo, aoAjustar }: { sentido: 1 | -1; passo: number; rotulo: string; aoAjustar: (sentido: 1 | -1) => void }) {
  const { cores } = useTema();
  const texto = `${numeroParaTela(passo)} kg`;
  const Icone = sentido === 1 ? Plus : Minus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sentido === 1 ? 'Aumentar' : 'Diminuir'} ${texto} em ${rotulo}`}
      onPress={() => aoAjustar(sentido)}
      style={(estado) => [estilos.passo, { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) ? cores.superficie3 : cores.campo }]}>
      <Icone size={22} color={cores.texto} strokeWidth={2.5} />
    </Pressable>
  );
}
