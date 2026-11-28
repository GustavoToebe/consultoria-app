import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { FIBRA, gramasNaTela, kcalNaTela, MACROS, MarcaDoMacro, textoDaFibra, TotalParaLeitor, type CorDoMacro, type ValoresComFibra } from '../../ui/ValoresDaDieta';

/**
 * Total da refeição na aba Dieta do aluno com a coluna de apoio ao lado (web, `docs/planos/orientacoes-de-design-26-11.md`
 * 1.5): os mesmos valores e textos da linha de `ValoresDaDieta` ("P 10,0 g", "Fibra —", "(parcial)"), com respiro: o rótulo
 * e a kcal em destaque (20 px, semibold, tabular) numa linha e P · C · G · Fibra numa linha menor e suave embaixo. Cada
 * valor anda inteiro (quebra de linha, nunca reticências). O leitor ouve a frase inteira (`TotalParaLeitor`); o que se vê
 * fica escondido dele. O celular e a prévia do treinador seguem com a linha de sempre.
 */
export function TotalDaRefeicaoComRespiro({ rotulo, totais }: { rotulo: string; totais: ValoresComFibra }) {
  const { cores } = useTema();
  const fibra = textoDaFibra(totais);
  const valores: { chave: string; cor: CorDoMacro; texto: string }[] = [
    ...MACROS.map((m) => ({ chave: m.chave, cor: m.cor, texto: `${m.curto} ${gramasNaTela(totais[m.chave])}` })),
    ...(fibra ? [{ chave: FIBRA.chave, cor: FIBRA.cor, texto: fibra }] : []),
  ];
  return (
    <View style={[estilos.total, { borderColor: cores.bordaCampo }]} role="group" aria-label={rotulo}>
      <TotalParaLeitor rotulo={rotulo} totais={totais} />
      <View style={estilos.linha} aria-hidden>
        <Texto numerico style={estilos.forte} cor={cores.texto}>{rotulo}</Texto>
        <Texto numerico style={estilos.kcal} cor={cores.texto}>{`${kcalNaTela(totais.kcal)} kcal`}</Texto>
      </View>
      <View style={estilos.macros} aria-hidden>
        {valores.map((v, i) => (
          <Fragment key={v.chave}>
            {i > 0 ? <Texto variante="pequeno">·</Texto> : null}
            <View style={estilos.macro}>
              <MarcaDoMacro cor={v.cor} />
              <Texto variante="pequeno" numerico>{v.texto}</Texto>
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  total: { borderTopWidth: 1, paddingTop: espaco(1), marginTop: espaco(0.5), gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5) },
  kcal: { fontFamily: fontes.semi, fontSize: 20, lineHeight: 26 },
  macros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  // Marca e valor andam juntos: o macro inteiro desce de linha, nunca se parte.
  macro: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: espaco(0.5) },
  forte: { fontFamily: fontes.semi },
});
