import { StyleSheet, View } from 'react-native';

import { aguaDoAlunoParaTreinador, listarPlanos, versaoPlano } from '../api/rotas';
import type { ConteudoDieta } from '../api/tipos';
import { DIAS_DA_AGUA, resumoDosDias, textoDaAguaDoDia, ultimosDiasDeAgua } from '../dominio/aguaDoDia';
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
 * Água na ficha (docs/planos/agua-do-aluno.md): os últimos 7 dias, um por linha, "1,5 L de 3,0 L" contra a "Água por dia"
 * da dieta publicada em uso, e "Registrou 5 de 7 dias". Dia sem registro é "—", nunca zero. Só mostra: não compara com
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
  const semMeta = dados && dados.meta === null;
  return (
    <Cartao titulo="Água" descricao="O que o aluno marcou nos últimos 7 dias, em copos de 250 ml.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados === undefined && !erro ? <Esqueleto /> : null}
      {dados ? (
        <>
          <Texto numerico>{resumoDosDias(dados.dias)}</Texto>
          {semMeta ? <Texto variante="suave">{'A dieta em uso não tem “Água por dia”: o aluno só vê a marcação com a meta.'}</Texto> : null}
          <View style={estilos.dias}>
            {dados.dias.map((d) => (
              <View key={d.data} style={estilos.linha}>
                <Texto variante="suave" numerico style={estilos.data}>{d.data === hoje ? `Hoje · ${dataCurta(d.data)}` : dataCurta(d.data)}</Texto>
                <Texto numerico>{textoDaAguaDoDia(d.aguaMl, dados.meta)}</Texto>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Cartao>
  );
}

/** "Água por dia" da dieta publicada em uso (a ativa); sem dieta ou sem água, `null`. */
async function metaDaDietaEmUso(alunoId: string): Promise<number | null> {
  const planos = await listarPlanos('dieta', alunoId);
  const ativa = planos.find((p) => p.ativo && p.versaoPublicada > 0);
  if (!ativa) return null;
  const versao = await versaoPlano<ConteudoDieta>('dieta', ativa.id, ativa.versaoPublicada);
  return versao.conteudo.aguaLitros ?? null;
}

const estilos = StyleSheet.create({
  dias: { gap: espaco(0.75) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: espaco(1) },
  data: { minWidth: 110 },
});
