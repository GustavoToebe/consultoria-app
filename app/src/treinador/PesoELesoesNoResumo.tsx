import { ChevronRight, Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { listarLesoes, pesosDoAluno } from '../api/rotas';
import { avisoDeLesoes, ultimoPeso } from '../dominio/fichaDoAluno';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * Última medição no Resumo (só monta com `ALUNO_SENSIVEL_LER`; guia de 11/11, pág. 31): o último peso com a data em que
 * foi registrado, nunca "peso atual", e o caminho para a Evolução. Sem gráfico: o gráfico mora na aba Evolução.
 */
export function UltimaMedicao({ alunoId, aoVerEvolucao }: { alunoId: string; aoVerEvolucao: (() => void) | null }) {
  const pesos = useCarregar(`resumo-peso:${alunoId}`, () => pesosDoAluno(alunoId));
  const ultimo = pesos.dados ? ultimoPeso(pesos.dados) : null;
  return (
    <Cartao titulo="Última medição" style={estilos.bloco}>
      {pesos.erro && !pesos.dados ? <MensagemErro texto={textoDoErro(pesos.erro)} erro={pesos.erro} tentarDeNovo={pesos.recarregar} /> : null}
      {!pesos.dados && !pesos.erro ? <Esqueleto cartoes={1} texto="Carregando o peso" /> : null}
      {pesos.dados && !ultimo ? <Texto variante="suave">Nenhum peso registrado.</Texto> : null}
      {ultimo ? (
        <View style={estilos.valor} accessible accessibilityLabel={`Último peso: ${numeroParaTela(ultimo.pesoKg)} kg, registrado em ${dataParaTela(ultimo.data)}`}>
          <Texto variante="bloco" numerico>{numeroParaTela(ultimo.pesoKg)} kg</Texto>
          <Texto variante="suave" numerico>Registrado em {dataParaTela(ultimo.data)}</Texto>
        </View>
      ) : null}
      {pesos.dados && aoVerEvolucao ? (
        <View style={estilos.atalho}>
          <Botao rotulo="Ver evolução" tipo="fantasma" Icone={ChevronRight} aoTocar={aoVerEvolucao} />
        </View>
      ) : null}
    </Cartao>
  );
}

/**
 * Aviso discreto das lesões no Resumo (só com `ALUNO_SENSIVEL_LER`): só a contagem (`avisoDeLesoes`), com o atalho para a
 * aba Ficha do aluno. Erro na busca não derruba nada: o aviso some (o cartão das lesões, na aba Ficha, mostra o erro).
 */
export function AvisoDeLesoesNoResumo({ alunoId, aoVerLesoes }: { alunoId: string; aoVerLesoes: () => void }) {
  const { cores } = useTema();
  const lesoes = useCarregar(`resumo-lesoes:${alunoId}`, () => listarLesoes(alunoId));
  const aviso = lesoes.dados ? avisoDeLesoes(lesoes.dados, true) : null;
  if (!aviso) return null;
  return (
    // Informativo, em neutro: não é status de ação nem erro (decisão 4 do plano); nenhum detalhe da lesão aparece aqui.
    <View style={[estilos.aviso, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
      <Info size={18} color={cores.textoSuave} strokeWidth={2} />
      <Texto style={estilos.textoDoAviso}>{aviso}</Texto>
      <Botao rotulo="Ver na ficha" rotuloAcessivel={`${aviso}: ver na ficha do aluno`} tipo="fantasma" Icone={ChevronRight} aoTocar={aoVerLesoes} />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  valor: { gap: 2 },
  atalho: { flexDirection: 'row', marginTop: 'auto' },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1), alignSelf: 'flex-start', maxWidth: '100%',
    borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingRight: espaco(0.5),
  },
  textoDoAviso: { flexShrink: 1 },
});
