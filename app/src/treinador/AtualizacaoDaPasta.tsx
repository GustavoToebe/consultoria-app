import { View } from 'react-native';
import type { Atualizacao } from '../api/tipos';
import { statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Fecho do período na folha da pasta, logo abaixo das ações: situação (selo no cabeçalho), data e feedback da
 * atualização desta pasta, com o botão para abrir ou revisar.
 */
export function AtualizacaoDaPasta({atualizacao,carregando,aoAbrir}:{atualizacao:Atualizacao|null;carregando:boolean;aoAbrir:(a:Atualizacao)=>void}) {
  const registrada = !carregando && atualizacao?.dataAtualizacao ? atualizacao : null;
  return (
    <Cartao titulo="Atualização do período" acoes={registrada ? <Selo {...statusAtualizacaoTreinador(registrada)} /> : undefined}>
      {carregando ? <Texto variante="suave">Carregando atualização…</Texto>
        : !registrada ? <Texto variante="suave">Nenhuma atualização registrada nesta pasta.</Texto>
        : <View style={{gap:espaco(1)}}>
          <View style={{gap:espaco(0.25)}}>
            <Texto variante="pequeno">Data da atualização</Texto>
            <Texto numerico variante="bloco">{dataParaTela(registrada.dataAtualizacao)}</Texto>
          </View>
          {registrada.questionarioNome ? <Texto variante="suave">Questionário: {registrada.questionarioNome}</Texto> : null}
          <Texto variante="suave">{registrada.feedback
            ? `Feedback enviado${registrada.feedback.naoLido ? ' · o aluno ainda não leu' : ' · lido pelo aluno'}`
            : registrada.enviadaEm ? 'Respostas recebidas, aguardando seu feedback.' : 'O aluno ainda não enviou.'}</Texto>
          <Botao rotulo={registrada.fase === 'ENVIADA' ? 'Revisar atualização' : 'Abrir atualização'} tipo="secundario" aoTocar={() => aoAbrir(registrada)} />
        </View>}
    </Cartao>
  );
}
