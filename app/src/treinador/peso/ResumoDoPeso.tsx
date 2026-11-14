import { StyleSheet, View } from 'react-native';

import type { MetaDoPeso, RegistroPeso } from '../../api/tipos';
import { tomDaVariacaoDoPeso } from '../../dominio/corDaVariacaoDoPeso';
import { resumoDoPeso, SEM_REGISTRO_ANTERIOR } from '../../dominio/resumoDoPeso';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { useDestaques } from '../../ui/NumeroDeDestaque';
import { Texto } from '../../ui/Texto';
import { direcaoFalada, SETA_DO_PESO, useCorDoTom } from '../VariacaoDoPeso';

/**
 * Resumo acima de Lista e Gráfico (peso-visual D3): o último registro com a data em que foi medido (nunca "peso atual"
 * nem a data de hoje) e a diferença desde o registro anterior, com a referência ("51,0 kg em 19/08/2026"). O peso é
 * medida, no azul de indicador; a diferença leva seta, sinal e a cor da meta (D2). A frase da meta fica logo abaixo.
 * Tudo vem de `dominio/resumoDoPeso`: aqui nada é calculado.
 */
export function ResumoDoPeso({ registros, meta, linhaDaMeta }: {
  registros: readonly RegistroPeso[];
  meta: MetaDoPeso | undefined;
  /** "Cores pela meta: reduzir o peso" (equipe) ou "Verde: no caminho da sua meta" (aluno); `null` sem meta. */
  linhaDaMeta: string | null;
}) {
  const { cores, bordas } = useTema();
  const azul = useDestaques().azul.cor;
  const resumo = resumoDoPeso(registros);
  const desde = resumo.vazio ? null : resumo.desdeAnterior;
  const corDaDiferenca = useCorDoTom(desde ? tomDaVariacaoDoPeso(desde.diferenca, meta) : 'neutro');
  if (resumo.vazio) return null;
  const caixa = [estilos.caixa, { backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco }];
  const seta = desde ? SETA_DO_PESO[desde.seta] : '';
  return (
    <View style={estilos.resumo}>
      <View style={estilos.caixas}>
        <View style={caixa} accessible accessibilityLabel={`${resumo.rotuloUltimo}: ${resumo.ultimo.texto} em ${resumo.ultimo.dataTexto}`}>
          <Texto variante="secao">{resumo.rotuloUltimo}</Texto>
          <Texto variante="titulo" numerico cor={azul}>{resumo.ultimo.texto}</Texto>
          <Texto variante="pequeno" numerico>{resumo.ultimo.dataTexto}</Texto>
        </View>
        <View style={caixa} accessible
          accessibilityLabel={desde
            ? `${resumo.rotuloDiferenca}: ${direcaoFalada(desde.seta, desde.texto).toLowerCase()}, comparado a ${desde.referencia}`
            : `${resumo.rotuloDiferenca}: ${SEM_REGISTRO_ANTERIOR.toLowerCase()}`}>
          <Texto variante="secao">{resumo.rotuloDiferenca}</Texto>
          {desde ? (
            <>
              <Texto variante="titulo" numerico cor={corDaDiferenca}>{seta ? `${seta} ${desde.texto}` : desde.texto}</Texto>
              <Texto variante="pequeno" numerico>{desde.referencia}</Texto>
            </>
          ) : (
            <Texto variante="subtitulo" cor={cores.textoSuave}>{SEM_REGISTRO_ANTERIOR}</Texto>
          )}
        </View>
      </View>
      {linhaDaMeta ? <Texto variante="pequeno">{linhaDaMeta}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(1) },
  caixas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  // Base de 180 px: duas caixas lado a lado a partir de ~390 px de cartão; com texto ampliado, uma embaixo da outra.
  caixa: { flexGrow: 1, flexBasis: 180, minWidth: 0, borderRadius: RAIO_CONTROLE, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2), gap: 2 },
});
