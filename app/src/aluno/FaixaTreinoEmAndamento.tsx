import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ConteudoTreino, Sessao } from '../api/tipos';
import { contagemDeSeries } from '../dominio/conclusaoDoTreino';
import { contagem } from '../dominio/contagens';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { treinoEmAndamento } from '../dominio/treinoEmAndamento';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
import { caminhoDaSessao } from './useSessaoDoDia';

export interface TreinoEmAndamento {
  sessao: Sessao;
  /** "1 de 6 séries feitas": a mesma contagem da lista do dia (só trabalho e pós-trabalho, D6). */
  texto: string;
}

/**
 * A sessão com série marcada hoje e ainda não concluída (`dominio/treinoEmAndamento`), com o texto do progresso. Só com
 * o retorno ligado, como a faixa do treino ao vivo e o "Concluir treino": sem a chave não há como concluir, e o andamento
 * nunca acabaria no dia. Lê só o aparelho, então funciona sem internet. Calculado uma vez no Início e repassado à faixa,
 * ao cartão Hoje e ao "Sua semana".
 */
export function useTreinoEmAndamento(versaoId: string | null, conteudo: ConteudoTreino | null, hoje: string): TreinoEmAndamento | null {
  const { retornoHabilitado } = useSessao();
  const { registros, registroDe, sessaoConcluidaDe } = useAluno();
  if (!retornoHabilitado || !versaoId || !conteudo) return null;
  const sessao = treinoEmAndamento({
    versaoId,
    sessoes: conteudo.sessoes,
    registros,
    hoje,
    concluidaHoje: (uid) => !!sessaoConcluidaDe(versaoId, uid, hoje)?.concluida,
  });
  if (!sessao) return null;
  const metodologia = conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  const { feitas, total } = contagemDeSeries(sessao, (uid) => !!registroDe(versaoId, uid, hoje)?.concluida, metodologia);
  return { sessao, texto: `${feitas} de ${contagem(total, 'série feita', 'séries feitas')}` };
}

/**
 * "Treino em andamento" no Início, com "Continuar", que abre a lista do dia. Só quando o treino começado não é o do
 * cartão Hoje (outra divisão, treino em dia de descanso, plano sem dia fixo): sendo o mesmo, o próprio Hoje vira
 * "Continuar treino" e a faixa não repete o botão. Neutra e secundária: o primário do Início é o cartão Hoje.
 */
export function FaixaTreinoEmAndamento({ andamento, hoje }: { andamento: TreinoEmAndamento; hoje: string }) {
  const { sessao, texto } = andamento;
  return (
    <Cartao>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          <Texto variante="rotulo">Treino em andamento</Texto>
          <Texto variante="subtitulo" numberOfLines={2}>{sessao.nome}</Texto>
          <Texto variante="suave" numerico>{texto}</Texto>
        </View>
        <Botao
          rotulo="Continuar"
          rotuloAcessivel={`Continuar treino: ${sessao.nome}`}
          tipo="secundario"
          Icone={Play}
          aoTocar={() => router.push(caminhoDaSessao(sessao.uid, hoje))}
        />
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, gap: espaco(0.25) },
});
