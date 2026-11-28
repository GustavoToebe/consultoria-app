import { ChevronDown } from 'lucide-react-native';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import type { usePlanoEditor } from '../plano/usePlanoEditor';

/** Abaixo disto (largura do próprio bloco), Objetivo e Orientações empilham: lado a lado o Objetivo ficaria com menos de ~350 px. */
const LARGURA_LADO_A_LADO = 900;
/** Objetivo + Orientações não passam disto (proposta de 27/11), nem na tela mais larga. */
const LARGURA_MAXIMA_DOS_TEXTOS = 2400;
const DICA_DA_METODOLOGIA = 'Orienta as novas séries; as que já existem continuam editáveis.';

/**
 * "Configuração do plano" do treino: título, período, a metodologia, objetivo e orientações. A metodologia mora só aqui,
 * em qualquer largura (o exercício não a repete). Aberta (27/11): o seletor da metodologia com a dica ao lado e, a partir
 * de 900 px do bloco, Objetivo (40%) e Orientações gerais (60%) lado a lado, campos que crescem com o texto.
 */
export function ConfiguracaoDoTreino({ editor, modelo, aberta = false, aoTrocarMetodologia }: {
  editor: ReturnType<typeof usePlanoEditor<ConteudoTreino>>;
  modelo: boolean;
  /** Abre na montagem (o editor remonta por `key` para abrir no "Ir à primeira pendência" de um campo daqui). */
  aberta?: boolean;
  aoTrocarMetodologia: () => void;
}) {
  const [largura, setLargura] = useState(0);
  const estado = editor.estado;
  if (!estado) return null;
  const c = estado.conteudo;
  const ladoALado = largura >= LARGURA_LADO_A_LADO;
  return (
    <ConfiguracaoDoPlano
      editor={editor}
      modelo={modelo}
      recolhido={!aberta && c.sessoes.length > 0 && estado.titulo.trim() !== ''}
      resumo={resumoDaConfiguracao(c)}>
      <SeletorDeMetodologia nome={c.metodologia?.nome ?? null} aoTocar={aoTrocarMetodologia} />
      <View onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))} style={[estilos.textos, ladoALado ? estilos.ladoALado : null]}>
        <View style={ladoALado ? estilos.objetivo : null}>
          <CampoQueCresce
            rotulo="Objetivo (opcional)"
            placeholder="Ex.: ganho de força com boa técnica"
            valor={c.objetivo ?? ''}
            // O objetivo é uma linha (vai no resumo da faixa): a quebra digitada vira espaço.
            aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, objetivo: t.replace(/\n/g, ' ') || null }))}
            linhas={1}
            maximoDeLinhas={4}
            maxLength={200}
          />
        </View>
        <View style={ladoALado ? estilos.orientacoes : null}>
          <CampoQueCresce
            rotulo="Orientações gerais (opcional)"
            placeholder="Ex.: beba água durante o treino e anote como se sentiu"
            valor={c.orientacoes ?? ''}
            aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, orientacoes: t || null }))}
            linhas={2}
            maximoDeLinhas={16}
            maxLength={8000}
          />
        </View>
      </View>
    </ConfiguracaoDoPlano>
  );
}

/**
 * Parece um seletor (rótulo dentro, valor, seta), mas abre a folha "Vincular metodologia" do editor: a escolha precisa da
 * lista de receitas e da prévia de lá. shortcut: copia o botão do `ui/EscolhaSuspensa` (que sempre abre a própria lista);
 * se outra tela pedir um "campo que abre folha", vira peça do `ui/`.
 */
function SeletorDeMetodologia({ nome, aoTocar }: { nome: string | null; aoTocar: () => void }) {
  const { cores } = useTema();
  const idDaDica = `dica-metodologia-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const valor = nome ?? 'Nenhuma vinculada';
  return (
    <View style={estilos.metodologia}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Metodologia: ${valor}. ${nome ? 'Trocar' : 'Vincular'}.`}
        accessibilityHint={DICA_DA_METODOLOGIA}
        aria-haspopup="dialog"
        // O RN não tipa `aria-describedby`; o react-native-web o leva ao botão.
        {...({ 'aria-describedby': idDaDica } as object)}
        onPress={aoTocar}
        style={(estado) => [estilos.seletor, { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) ? cores.sobre : cores.campo }]}>
        <View style={estilos.valores}>
          <Texto variante="pequeno" numberOfLines={1}>Metodologia</Texto>
          <Texto style={estilos.valor} numberOfLines={1}>{valor}</Texto>
        </View>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      <Texto variante="suave" nativeID={idDaDica} style={estilos.dica}>{DICA_DA_METODOLOGIA}</Texto>
    </View>
  );
}

/** Resumo na faixa, à vista também recolhida (10/11): "Objetivo: hipertrofia · Metodologia: Padrão". */
export function resumoDaConfiguracao(c: Pick<ConteudoTreino, 'objetivo' | 'metodologia'>): string {
  return [c.objetivo ? `Objetivo: ${c.objetivo}` : 'Sem objetivo', c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Sem metodologia'].join(' · ');
}

const estilos = StyleSheet.create({
  metodologia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.75) },
  seletor: {
    width: 280,
    maxWidth: '100%',
    minHeight: ALVO_TOQUE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    borderWidth: 1,
    borderRadius: RAIO_CONTROLE,
  },
  valores: { flex: 1, gap: 1 },
  valor: { fontFamily: fontes.semi, fontSize: 15 },
  dica: { flexGrow: 1, flexShrink: 1, flexBasis: 220 },
  textos: { width: '100%', maxWidth: LARGURA_MAXIMA_DOS_TEXTOS, gap: espaco(2) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  objetivo: { flex: 2, minWidth: 0 },
  orientacoes: { flex: 3, minWidth: 0 },
});
