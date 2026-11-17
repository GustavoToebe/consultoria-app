import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../api/tipos';
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

interface Props {
  versaoId: string | null;
  conteudo: ConteudoTreino | null;
  hoje: string;
}

/**
 * "Treino em andamento" no Início: a sessão com série marcada hoje e ainda não concluída (`dominio/treinoEmAndamento`),
 * com "Continuar", que abre a lista do dia. Neutra e secundária: o primário do Início é o cartão Hoje. Só com o retorno
 * ligado, como a faixa do treino ao vivo e o "Concluir treino": sem a chave não há como concluir, e a faixa nunca sumiria
 * no dia. Lê só o aparelho, então funciona sem internet.
 */
export function FaixaTreinoEmAndamento({ versaoId, conteudo, hoje }: Props) {
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
  // A mesma contagem da lista do dia (só trabalho e pós-trabalho, D6).
  const metodologia = conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  const { feitas, total } = contagemDeSeries(sessao, (uid) => !!registroDe(versaoId, uid, hoje)?.concluida, metodologia);
  return (
    <Cartao>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          <Texto variante="rotulo">Treino em andamento</Texto>
          <Texto variante="subtitulo" numberOfLines={2}>{sessao.nome}</Texto>
          <Texto variante="suave" numerico>{feitas} de {contagem(total, 'série feita', 'séries feitas')}</Texto>
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
