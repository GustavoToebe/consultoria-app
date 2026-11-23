import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TextosDoCabecalho } from '../dominio/cabecalhoDaColecao';
import { palavraDosAuloes } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Divisor } from '../ui/Divisor';
import { Texto } from '../ui/Texto';

/** 16 px entre o cabeçalho da coleção e a grade dos vídeos. */
export const VAO_DO_CABECALHO = espaco(2);
/** 20 px de cada lado do fio: ~40 px entre uma seção e a seguinte. */
const RESPIRO = espaco(2.5);
/** Metade do vão entre duas seções (respiro + fio + respiro): a linha guia do arrastar cai em cima do fio. */
export const FOLGA_ENTRE_COLECOES = RESPIRO + 0.5;

const TITULO = { role: 'heading' as const, 'aria-level': 2 };

/**
 * Cabeçalho de coleção da aba Vídeos (cabeçalho de coleção, 23/11), o mesmo no treinador e no aluno: sobretítulo "COLEÇÃO N"
 * (ou "SEM COLEÇÃO", sem nome), o nome no tamanho de título de seção (20 px, acima dos 16 do título do vídeo) e a contagem em
 * pílula neutra. É o h2 da seção, com o nome acessível "Coleção 1: Treinos, 1 vídeo". O treinador passa a alça em `inicio` e
 * "Adicionar vídeo" e o ⋯ em `acoes`, centrados na altura do bloco; o aluno passa `alternar` e o cabeçalho vira o botão que
 * abre e fecha a coleção (o padrão de acordeão do APG: o botão dentro do título, o estado só no `aria-expanded`).
 */
export function CabecalhoDaColecao({ textos, inicio, acoes, alternar }: {
  textos: TextosDoCabecalho;
  inicio?: ReactNode;
  acoes?: ReactNode;
  alternar?: { aberta: boolean; aoAlternar: () => void };
}) {
  const { cores } = useTema();
  const { sobretitulo, nome, total, nomeAcessivel } = textos;
  const pilula = (
    <View style={[estilos.pilula, { backgroundColor: cores.superficie3 }]}>
      <Texto cor="suave" style={estilos.textoDaPilula}>
        <Texto cor="suave" numerico style={estilos.numeroDaPilula}>{total}</Texto>{` ${palavraDosAuloes(total)}`}
      </Texto>
    </View>
  );
  const blocoDosTextos = (
    <>
      <View style={estilos.linhaDoNome}>
        <Texto variante="secao">{sobretitulo}</Texto>
        {nome === null ? pilula : null}
      </View>
      {nome === null ? null : (
        <View style={estilos.linhaDoNome}>
          <Texto variante="bloco" style={estilos.nome}>{nome}</Texto>
          {pilula}
        </View>
      )}
    </>
  );

  if (alternar) {
    const Seta = alternar.aberta ? ChevronUp : ChevronDown;
    return (
      <View {...TITULO}>
        <Pressable accessibilityRole="button" accessibilityLabel={nomeAcessivel} accessibilityState={{ expanded: alternar.aberta }}
          aria-expanded={alternar.aberta} onPress={alternar.aoAlternar}
          style={({ pressed }) => [estilos.linha, estilos.botao, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={estilos.textos}>{blocoDosTextos}</View>
          <Seta size={20} color={cores.textoSuave} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={estilos.linha}>
      {/* Alça e título juntos: no celular o título quebra linha ao lado da alça e só as ações descem. */}
      <View style={estilos.identificacao}>
        {inicio}
        {/* O nome acessível vem do título inteiro; os textos visíveis saem da leitura para não serem lidos duas vezes. */}
        {/* `accessible`: no celular o leitor de tela só lê uma `View` que é elemento de acessibilidade. */}
        <View {...TITULO} accessible accessibilityLabel={nomeAcessivel} style={estilos.textos}>
          <View aria-hidden style={estilos.textos}>{blocoDosTextos}</View>
        </View>
      </View>
      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );
}

/** O fio `divisor` de largura total acima de cada seção, menos a primeira; o respiro fica dos dois lados dele. */
export function FioEntreColecoes() {
  return (
    <View testID="fio-entre-colecoes" style={estilos.fio}>
      <Divisor />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(2), rowGap: espaco(1) },
  botao: { flexWrap: 'nowrap', minHeight: ALVO_TOQUE },
  identificacao: { flexDirection: 'row', alignItems: 'center', columnGap: espaco(0.5), flexGrow: 1, flexShrink: 1, minWidth: 0 },
  textos: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: espaco(0.25) },
  linhaDoNome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  // 20/26: o título da seção fica claramente acima do título do vídeo (16).
  nome: { fontSize: 20, lineHeight: 26, flexShrink: 1 },
  pilula: { borderRadius: 999, paddingHorizontal: espaco(1), paddingVertical: 2 },
  textoDaPilula: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
  // Sem `fontFamily`: a do `numerico` (fonte numérica) vale só no número.
  numeroDaPilula: { fontSize: 12, lineHeight: 16 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), marginLeft: 'auto' },
  fio: { marginVertical: RESPIRO },
});
