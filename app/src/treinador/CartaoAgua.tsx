import { StyleSheet, View } from 'react-native';

import { aguaDoAlunoParaTreinador, listarPlanos, versaoPlano } from '../api/rotas';
import type { ConteudoDieta } from '../api/tipos';
import { DIAS_DA_AGUA, litrosParaTela, resumoDosDias,textoDaAguaDoDia, ultimosDiasDeAgua } from '../dominio/aguaDoDia';
import { hojeDoCiclo } from '../dominio/cicloMenstrual';
import { dataCurta, somarDias } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * Água na ficha (docs/planos/agua-do-aluno.md): os últimos 7 dias (duas colunas quando cabem), "1,5 L de 3,0 L" contra a
 * "Água por dia" da dieta publicada em uso, e "Registrou 5 de 7 dias". Dia sem registro é "—", nunca zero; nenhum
 * registro na semana vira uma frase só, com a meta da dieta se houver. Só mostra: não compara com
 * nada nem diz se "bateu a meta". Quem renderiza já checou `REGISTRO_LER` e `ALUNO_SENSIVEL_LER` (dado de dieta); a meta só
 * vem com `DIETA_LER` (`comDieta`), senão as linhas saem sem ela.
 */
export function CartaoAgua({ alunoId, comDieta }: { alunoId: string; comDieta: boolean }) {
  const hoje = hojeDoCiclo();
  const { dados, erro, recarregar } = useCarregar(`agua:${alunoId}:${hoje}:${comDieta}`, async () => {
    const [registros, meta] = await Promise.all([
      aguaDoAlunoParaTreinador(alunoId, somarDias(hoje, -(DIAS_DA_AGUA - 1)), hoje),
      comDieta ? metaDaDietaEmUso(alunoId) : Promise.resolve(undefined),
    ]);
    return { dias: ultimosDiasDeAgua(registros, hoje), meta };
  });
  const meta = dados ? (typeof dados.meta === 'number' ? dados.meta : null) : null;
  const semRegistro = !!dados && dados.dias.every((d) => d.aguaMl === null);
  // Só diz o que a dieta tem; nunca "não cumpriu" (sem marcação não é meta perdida).
  const notaDaMeta = !dados ? null
    : dados.meta === 'sem-dieta' ? 'Sem dieta publicada em uso: o aluno só vê a marcação com a “Água por dia” da dieta.'
      : dados.meta === null ? 'A dieta em uso não tem “Água por dia”: o aluno só vê a marcação com a meta.'
        : semRegistro && meta !== null ? `Água por dia na dieta: ${litrosParaTela(Math.round(meta * 1000))}.` : null;
  return (
    <Cartao titulo="Água" descricao="O que o aluno marcou nos últimos 7 dias, em copos de 250 ml.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados === undefined && !erro ? <Esqueleto cartoes={1} /> : null}
      {dados ? (
        <>
          <Texto numerico>{resumoDosDias(dados.dias)}</Texto>
          {notaDaMeta ? <Texto variante="suave" numerico>{notaDaMeta}</Texto> : null}
          {/* Sem nenhuma marcação, a frase acima basta: sete linhas de "—" não dizem nada (guia de 11/11, pág. 33). */}
          {semRegistro ? null : (
            <View style={estilos.dias}>
              {dados.dias.map((d) => (
                <View key={d.data} style={estilos.linha}>
                  <Texto variante="suave" numerico style={estilos.data}>{d.data === hoje ? `Hoje · ${dataCurta(d.data)}` : dataCurta(d.data)}</Texto>
                  <Texto numerico>{textoDaAguaDoDia(d.aguaMl, meta)}</Texto>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Cartao>
  );
}

/**
 * "Água por dia" da dieta publicada em uso (a ativa): o número, `null` quando a dieta não tem a água e `'sem-dieta'`
 * quando não há dieta publicada em uso (a tela explica cada caso de um jeito).
 */
async function metaDaDietaEmUso(alunoId: string): Promise<number | null | 'sem-dieta'> {
  const planos = await listarPlanos('dieta', alunoId);
  const ativa = planos.find((p) => p.ativo && p.versaoPublicada > 0);
  if (!ativa) return 'sem-dieta';
  const versao = await versaoPlano<ConteudoDieta>('dieta', ativa.id, ativa.versaoPublicada);
  return versao.conteudo.aguaLitros ?? null;
}

const estilos = StyleSheet.create({
  // Duas colunas quando cabem (PC), uma no celular: os sete dias ocupam metade da altura sem perder a data.
  dias: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(0.75) },
  // Valor logo depois da data (coluna de 110): a última linha, sozinha, não joga o valor para a outra ponta.
  linha: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  data: { minWidth: 110 },
});
