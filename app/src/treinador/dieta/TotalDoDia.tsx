import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { AGUA_MAXIMA, AGUA_MINIMA, aguaValida, type ItemSemValor, textoItensSemValor, totalDoDia } from '../../dominio/dieta';
import { numeroParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Incompleto } from '../../ui/Estados';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';
import { gramasNaTela, kcalNaTela, MACROS, MarcaDoMacro } from '../../ui/ValoresDaDieta';

/**
 * "Total do dia" (opção A de cada refeição; guia premium pág. 10), compacto: kcal em destaque neutro e os três macros
 * lado a lado com a marca da cor, o número antes do nome ("—" sem unidade quando falta valor), e a água por dia na mesma faixa, sempre à vista (dentro da "Configuração do plano", que fecha
 * sozinha quando a dieta já tem refeições, o treinador não a encontrava, 30/10). Se algum item deixa o total incompleto,
 * diz quantos são e leva ao primeiro. Modelo de uma refeição só não tem água.
 */
export function TotalDoDia({ conteudo: c, semValor, aoAbrirRefeicao, aoMudarAgua }: {
  conteudo: ConteudoDieta; semValor: ItemSemValor[]; aoAbrirRefeicao: (uid: string) => void; aoMudarAgua?: (litros: number | null) => void;
}) {
  const { rolarAte } = useRolagem();
  const t = totalDoDia(c);
  const kcal = kcalNaTela(t.kcal);
  const primeiro = semValor[0];
  return (
    <Cartao faixa titulo="Total do dia" descricao="Soma só a opção A de cada refeição: as outras opções substituem a refeição e não entram no total.">
      <View style={estilos.faixa}>
        {/* Um destaque só, as kcal, em texto neutro (nunca vermelho por ser alto) com a unidade pequena; os macros ao lado,
            menores, cada um com a marca da cor e o nome escrito. No celular os macros descem juntos para a linha de baixo. */}
        <View style={estilos.numeros} role="list">
          <View style={estilos.kcal} role="listitem" accessibilityLabel={`Calorias: ${t.kcal === null ? kcal : `${kcal} kcal`}`}>
            <Texto variante="destaque" numerico>{kcal}</Texto>
            {t.kcal === null ? null : <Texto variante="pequeno">kcal</Texto>}
          </View>
          <View style={estilos.macros}>
            {MACROS.map((m) => (
              <View key={m.chave} style={estilos.macro} role="listitem" accessibilityLabel={`${m.nome}: ${gramasNaTela(t[m.chave])}`}>
                <Texto variante="subtitulo" numerico>{gramasNaTela(t[m.chave])}</Texto>
                <View style={estilos.nomeDoMacro}><MarcaDoMacro cor={m.cor} /><Texto variante="pequeno">{m.nome}</Texto></View>
              </View>
            ))}
          </View>
        </View>
        {aoMudarAgua ? (
          <View style={estilos.agua}>
            <CampoNumerico
              rotulo="Água por dia (opcional)"
              sufixo="L"
              valor={c.aguaLitros ?? null}
              aoMudar={aoMudarAgua}
              erro={aguaValida(c.aguaLitros ?? null) ? null : `De ${numeroParaTela(AGUA_MINIMA)} a ${AGUA_MAXIMA} L, com uma casa decimal.`}
              ajuda="Aparece no início e na dieta do aluno. Vazio não aparece."
            />
          </View>
        ) : null}
      </View>
      {primeiro ? (
        <View style={estilos.semValor}>
          <Incompleto texto={textoItensSemValor(semValor.length)} />
          <Botao rotulo="Mostrar o primeiro" rotuloAcessivel={`Mostrar o primeiro item sem valor: ${primeiro.nome || 'sem nome'}`} tipo="fantasma"
            aoTocar={() => { aoAbrirRefeicao(primeiro.refeicaoUid); rolarAte([primeiro.refeicaoUid]); }} />
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  // Números e água na mesma faixa no PC, a água logo depois dos números (em 1920 px, encostada na beirada, ficava longe
  // demais do que ela soma); no celular a água desce para a linha de baixo.
  faixa: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(6), rowGap: espaco(2) },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1.5), flexShrink: 1 },
  kcal: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.5) },
  macros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1) },
  macro: { minWidth: 72, gap: 2 },
  nomeDoMacro: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  agua: { width: 220, maxWidth: '100%' },
  // Coluna: o aviso de item sem valor ocupa a linha toda (em 390 px cortava ao lado do botão).
  semValor: { gap: espaco(0.5), alignItems: 'flex-start' },
});
