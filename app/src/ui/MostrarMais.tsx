import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ajustarAChave, faltaMostrar, limiteInicial, mostrarMaisUm, textoMostrando } from '../dominio/mostrarMais';
import { espaco } from '../tema/tokens';
import { Botao } from './Botao';
import { LinhaDeAcoes } from './LinhaDeAcoes';
import { Texto } from './Texto';

/**
 * Quantos itens da lista aparecem: 80 e mais 80 a cada "Mostrar mais". `chave` junta a busca e os filtros da lista:
 * quando ela muda, a contagem volta a 80 (estado derivado na renderização, o padrão do React).
 */
export function useMostrarMais(chave: string) {
  const [estado, setEstado] = useState(() => limiteInicial(chave));
  const atual = ajustarAChave(estado, chave);
  if (atual !== estado) setEstado(atual);
  return { limite: atual.limite, mostrarMais: () => setEstado((e) => mostrarMaisUm(ajustarAChave(e, chave))) };
}

/** "Mostrando 80 de 200." e o botão "Mostrar mais"; some quando tudo já aparece. */
export function MostrarMais({ limite, total, aoMostrarMais }: { limite: number; total: number; aoMostrarMais: () => void }) {
  if (!faltaMostrar(limite, total)) return null;
  return (
    <View style={estilos.bloco}>
      <Texto variante="pequeno" numerico accessibilityLiveRegion="polite">{textoMostrando(limite, total)}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo="Mostrar mais" tipo="secundario" aoTocar={aoMostrarMais} />
      </LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});
