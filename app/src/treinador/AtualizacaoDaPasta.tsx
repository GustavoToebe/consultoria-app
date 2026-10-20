import { View } from 'react-native';
import type { Atualizacao } from '../api/tipos';
import { statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataRelativa } from '../dominio/datasRelativas';
import { dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { Esqueleto } from '../ui/Esqueleto';
import { Texto } from '../ui/Texto';

/**
 * Fecho do período na folha da pasta, logo abaixo das ações: situação (selo curto no cabeçalho, o cartão já diz que é
 * a atualização), data e feedback, com o botão para abrir ou revisar. `destaque`: com a atualização para revisar, o
 * botão é a ação principal da folha.
 */
export function AtualizacaoDaPasta({atualizacao,carregando,aoAbrir,destaque=false}:{atualizacao:Atualizacao|null;carregando:boolean;aoAbrir:(a:Atualizacao)=>void;destaque?:boolean}) {
  const registrada = !carregando && atualizacao?.dataAtualizacao ? atualizacao : null;
  const selo = registrada ? statusAtualizacaoTreinador(registrada) : null;
  const quando = registrada ? dataRelativa(registrada.dataAtualizacao) : '';
  return (
    <Cartao titulo="Atualização do período" acoes={selo ? <Selo texto={selo.curto} tipo={selo.tipo} /> : undefined}>
      {carregando ? <Esqueleto texto="Carregando atualização" cartoes={1} />
        : !registrada ? <Texto variante="suave">Nenhuma atualização registrada nesta pasta.</Texto>
        : <View style={{gap:espaco(1)}}>
          <View style={{gap:espaco(0.25)}}>
            <Texto variante="rotulo">Data da atualização</Texto>
            <Texto numerico variante="bloco">{dataParaTela(registrada.dataAtualizacao)}{/^\d/.test(quando) ? '' : ` (${quando})`}</Texto>
          </View>
          {registrada.questionarioNome ? <Texto variante="suave">Questionário: {registrada.questionarioNome}</Texto> : null}
          <Texto variante="suave">{registrada.feedback
            ? `Feedback enviado${registrada.feedback.naoLido ? ' · o aluno ainda não leu' : ' · lido pelo aluno'}`
            : registrada.enviadaEm ? 'Respostas recebidas, aguardando seu feedback.' : 'O aluno ainda não enviou.'}</Texto>
          <Botao rotulo={registrada.fase === 'ENVIADA' ? 'Revisar atualização' : 'Abrir atualização'} tipo={destaque ? 'primario' : 'secundario'} aoTocar={() => aoAbrir(registrada)} />
        </View>}
    </Cartao>
  );
}
