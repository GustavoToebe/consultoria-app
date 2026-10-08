import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  titulo: string;
  descricao?: string;
  selecionada: boolean;
  aoEscolher: () => void;
  /** Quadrado de 40 px à esquerda (cor, letra ou miniatura). */
  amostra?: ReactNode;
  /** Título escrito em outra fonte (ex.: a fonte do nome da consultoria). */
  fonteDoTitulo?: string;
  /** Tamanho final do título em px, já com o tamanho de texto da pessoa descontado (opção "Grande" escrita grande). */
  tamanhoDoTitulo?: number;
}

/**
 * Opção em cartão (nível 3): amostra opcional, título e descrição. Selecionada = borda de 2 px na cor do texto (não da
 * marca) e o ícone ✓. Tem papel de `radio`; o `GradeDeOpcoes` junta várias num grupo.
 */
export function OpcaoCartao({ titulo, descricao, selecionada, aoEscolher, amostra, fonteDoTitulo, tamanhoDoTitulo }: Props) {
  const { cores, fatorTexto } = useTema();
  // O `Texto` multiplica pelo fator da pessoa; dividimos antes para o título sair exatamente no tamanho pedido.
  const estiloDoTitulo = tamanhoDoTitulo
    ? { fontSize: tamanhoDoTitulo / fatorTexto, lineHeight: (tamanhoDoTitulo * 1.4) / fatorTexto }
    : fonteDoTitulo
      ? { fontFamily: fonteDoTitulo, fontSize: 20, lineHeight: 26 }
      : undefined;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionada }}
      accessibilityLabel={descricao ? `${titulo}. ${descricao}` : titulo}
      onPress={aoEscolher}
      style={(estado) => [
        estilos.opcao,
        {
          backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2,
          borderColor: selecionada ? cores.texto : cores.borda,
          // A borda cresce 1 px para dentro: o conteúdo não pula ao selecionar.
          borderWidth: selecionada ? 2 : 1,
          padding: espaco(1.5) - (selecionada ? 1 : 0),
        },
      ]}>
      {amostra ? <View style={estilos.amostra}>{amostra}</View> : null}
      <View style={estilos.textos}>
        <Texto variante="bloco" style={estiloDoTitulo}>{titulo}</Texto>
        {descricao ? <Texto variante="suave">{descricao}</Texto> : null}
      </View>
      {selecionada ? <Check size={20} color={cores.texto} strokeWidth={3} /> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1), borderRadius: RAIO },
  amostra: { width: 40, height: 40, borderRadius: RAIO, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
});
