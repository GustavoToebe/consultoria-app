import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { caminhoDaPasta } from '../../dominio/caminhoDaPasta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  alunoId: string;
  /** Pasta do plano aberto no editor; sem pasta (ou com id que não é seguro), o botão não aparece. */
  pastaId: string | null | undefined;
}

/**
 * "Voltar à pasta" dos editores do plano do aluno (reunião de 30/10): leva à ficha do aluno com a Folha da pasta aberta
 * (`?pastaId=`), para o treinador seguir a ordem da renovação (revisar, publicar, dar o retorno, finalizar).
 *
 * - Passa pela guarda de saída: com alteração pendente pergunta "Sair sem salvar?" antes.
 * - Vai sempre para o caminho completo com `router.replace`, nunca `router.back()`: funciona com o editor aberto direto
 *   pela URL (sem histórico) e tira o editor da pilha, para a guarda dele não perguntar de novo na ficha.
 * - Na web é `<a href>` (Ctrl/Cmd+clique abre a ficha em outra aba e esta fica como está); o clique simples navega
 *   dentro do app. Nunca é chamado sozinho depois de publicar.
 */
export function VoltarParaAPasta({ alunoId, pastaId }: Props) {
  const { cores } = useTema();
  const { confirmar } = useSaidaGuardada();
  const caminho = caminhoDaPasta(alunoId, pastaId);
  if (!caminho) return null;
  const href = caminho as Href;
  const voltar = () => confirmar(() => router.replace(href));
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Voltar à pasta"
      accessibilityHint="Abre a ficha do aluno com a pasta deste plano."
      {...propsDeLink(href, voltar)}
      style={(estado) => [estilos.botao, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
      <View style={estilos.linha}>
        <ArrowLeft size={18} color={cores.texto} strokeWidth={2} />
        <Texto numberOfLines={2} style={[estilos.rotulo, { color: cores.texto }]}>Voltar à pasta</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Mesmo desenho do botão secundário (contorno), para ficar ao lado do "Abrir atualização" sem disputar com o Publicar.
  botao: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(0.75),
    borderRadius: RAIO,
    borderWidth: 1,
    justifyContent: 'center',
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  rotulo: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
});
