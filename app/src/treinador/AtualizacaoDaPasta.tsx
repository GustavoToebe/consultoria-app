import { View } from 'react-native';
import type { Atualizacao } from '../api/tipos';
import { statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/** Fecho do período na folha da pasta: data, situação e feedback da atualização desta pasta. */
export function AtualizacaoDaPasta({atualizacao,carregando,aoAbrir}:{atualizacao:Atualizacao|null;carregando:boolean;aoAbrir:(a:Atualizacao)=>void}) {
  return <>
    <Texto variante="secao">Atualização do período</Texto>
    {carregando ? <Texto variante="suave">Carregando atualização…</Texto>
      : !atualizacao?.dataAtualizacao ? <Texto variante="suave">Nenhuma atualização registrada nesta pasta.</Texto>
      : <View style={{gap:espaco(0.75)}}>
        <Texto numerico>Data: {dataParaTela(atualizacao.dataAtualizacao)}</Texto>
        <Selo {...statusAtualizacaoTreinador(atualizacao)} />
        <Texto variante="suave">{atualizacao.feedback
          ? `Feedback enviado${atualizacao.feedback.naoLido ? ' · o aluno ainda não leu' : ' · lido pelo aluno'}`
          : atualizacao.enviadaEm ? 'Respostas recebidas, aguardando seu feedback.' : 'O aluno ainda não enviou.'}</Texto>
        <Botao rotulo={atualizacao.fase === 'ENVIADA' ? 'Revisar atualização' : 'Abrir atualização'} tipo="secundario" aoTocar={() => aoAbrir(atualizacao)} />
      </View>}
  </>;
}
