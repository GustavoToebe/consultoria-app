import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { AGUA_MAXIMA, AGUA_MINIMA, aguaValida, type ItemSemValor, textoItensSemValor, totalDoDia } from '../../dominio/dieta';
import { numeroParaTela, SEM_DADO } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Incompleto } from '../../ui/Estados';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';

/**
 * "Total do dia" (opção A de cada refeição), compacto: kcal e os três macros lado a lado, o número antes do nome ("—" sem
 * unidade quando falta valor), e a água por dia na mesma faixa, sempre à vista (dentro da "Configuração do plano", que fecha
 * sozinha quando a dieta já tem refeições, o treinador não a encontrava, 30/10). Se algum item deixa o total incompleto,
 * diz quantos são e leva ao primeiro. Modelo de uma refeição só não tem água.
 */
export function TotalDoDia({ conteudo: c, semValor, aoAbrirRefeicao, aoMudarAgua }: {
  conteudo: ConteudoDieta; semValor: ItemSemValor[]; aoAbrirRefeicao: (uid: string) => void; aoMudarAgua?: (litros: number | null) => void;
}) {
  const { rolarAte } = useRolagem();
  const t = totalDoDia(c);
  const primeiro = semValor[0];
  const grama = (v: number | null) => (v === null ? SEM_DADO : `${numeroParaTela(v, 1)} g`);
  const numeros = [
    { rotulo: 'kcal', valor: t.kcal === null ? SEM_DADO : numeroParaTela(t.kcal, 0) },
    { rotulo: 'Proteína', valor: grama(t.proteina) },
    { rotulo: 'Carboidrato', valor: grama(t.carboidrato) },
    { rotulo: 'Gordura', valor: grama(t.gordura) },
  ];
  return (
    <Cartao faixa titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
      <View style={estilos.faixa}>
        <View style={estilos.numeros} role="list">
          {/* Um destaque só, as kcal; os macros ao lado, menores, com o rótulo embaixo alinhado. */}
          {numeros.map((n, i) => (
            <View key={n.rotulo} style={estilos.numero} role="listitem" accessibilityLabel={`${n.rotulo}: ${n.valor}`}>
              <Texto variante={i === 0 ? 'destaque' : 'subtitulo'} numerico>{n.valor}</Texto>
              <Texto variante="pequeno">{n.rotulo}</Texto>
            </View>
          ))}
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
  numeros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1), flexShrink: 1 },
  numero: { minWidth: 72, gap: 2 },
  agua: { width: 220, maxWidth: '100%' },
  // Coluna: o aviso de item sem valor ocupa a linha toda (em 390 px cortava ao lado do botão).
  semValor: { gap: espaco(0.5), alignItems: 'flex-start' },
});
