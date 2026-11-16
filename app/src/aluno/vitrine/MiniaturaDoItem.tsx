import { Package } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { useTema } from '../../tema/TemaProvider';
import { RAIO } from '../../tema/tokens';
import { ImagemProtegida } from '../../ui/ImagemProtegida';

/**
 * Foto do item da vitrine (equipe e aluno, cada um com a sua rota): só pela API com o token (`ImagemProtegida`), nunca
 * por link. Sem foto, um quadro neutro com o ícone, para a lista não pular de alinhamento.
 */
export function MiniaturaDoItem({ item, carregar, tamanho = 56 }: {
  item: Pick<ItemDaVitrineDoAluno, 'id' | 'nome' | 'temFoto' | 'fotoAtualizadaEm'>;
  carregar: (id: string) => Promise<Blob>;
  tamanho?: number;
}) {
  const { cores } = useTema();
  if (item.temFoto) {
    return <ImagemProtegida chave={`vitrine:${item.id}:${item.fotoAtualizadaEm ?? ''}`} carregar={() => carregar(item.id)}
      descricao={`Foto de ${item.nome}`} tamanho={tamanho} />;
  }
  return (
    <View style={[estilos.vazio, { width: tamanho, height: tamanho, backgroundColor: cores.superficie2, borderColor: cores.divisor }]}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Package size={Math.round(tamanho * 0.4)} color={cores.textoSuave} aria-hidden />
    </View>
  );
}

const estilos = StyleSheet.create({
  vazio: { borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
