import { ChevronRight, Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { listarLesoes, pesosDoAluno } from '../api/rotas';
import { dataRelativa } from '../dominio/datasRelativas';
import { avisoDeLesoes, ultimoPeso } from '../dominio/fichaDoAluno';
import { numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * A parte sensível do Resumo (só monta com `ALUNO_SENSIVEL_LER`): o último peso, pequeno como os outros indicadores, e o
 * aviso discreto das lesões, só a contagem (`avisoDeLesoes`), com o atalho para a aba Ficha do aluno. Erro de uma das
 * duas buscas não derruba nada: o peso diz "Indisponível" e o aviso some (o cartão das lesões, na aba Ficha, mostra o erro).
 */
export function PesoELesoesNoResumo({ alunoId, aoVerLesoes }: { alunoId: string; aoVerLesoes: () => void }) {
  const { cores } = useTema();
  const pesos = useCarregar(`resumo-peso:${alunoId}`, () => pesosDoAluno(alunoId));
  const lesoes = useCarregar(`resumo-lesoes:${alunoId}`, () => listarLesoes(alunoId));
  const ultimo = pesos.dados ? ultimoPeso(pesos.dados) : null;
  const valorDoPeso = pesos.erro && !pesos.dados ? 'Indisponível'
    : !pesos.dados ? null
      : ultimo ? `${numeroParaTela(ultimo.pesoKg)} kg · ${dataRelativa(ultimo.data)}` : 'Nenhum registro';
  const aviso = lesoes.dados ? avisoDeLesoes(lesoes.dados, true) : null;
  return (
    <View style={estilos.area}>
      <CampoLeitura rotulo="Último peso" valor={valorDoPeso} numerico />
      {aviso ? (
        // Informativo, em neutro: não é status de ação nem erro (decisão 4 do plano); nenhum detalhe da lesão aparece aqui.
        <View style={[estilos.aviso, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
          <Info size={18} color={cores.textoSuave} strokeWidth={2} />
          <Texto style={estilos.textoDoAviso}>{aviso}</Texto>
          <Botao rotulo="Ver na ficha" rotuloAcessivel={`${aviso}: ver na ficha do aluno`} tipo="fantasma" Icone={ChevronRight} aoTocar={aoVerLesoes} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(3), rowGap: espaco(1.5) },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, maxWidth: '100%',
    borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingRight: espaco(0.5),
  },
  textoDoAviso: { flexShrink: 1 },
});
