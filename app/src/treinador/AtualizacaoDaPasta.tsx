import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { ICONE_DO_SELO } from './iconesDosSelos';

/**
 * Fecho do período na folha da pasta, logo abaixo das ações: situação (selo curto no cabeçalho, o cartão já diz que é
 * a atualização), data e feedback, com o botão para abrir ou revisar. `destaque`: com a atualização para revisar, o
 * botão é a ação principal da folha. `children` é o questionário do período (bloco F): na mesma linha do "Abrir
 * atualização", à direita; no celular desce para baixo dele. Sem atualização registrada, fica sozinho.
 */
export function AtualizacaoDaPasta({atualizacao,carregando,aoAbrir,destaque=false,children}:{atualizacao:Atualizacao|null;carregando:boolean;aoAbrir:(a:Atualizacao)=>void;destaque?:boolean;children?:ReactNode}) {
  const registrada = !carregando && atualizacao?.dataAtualizacao ? atualizacao : null;
  const selo = registrada ? statusAtualizacaoTreinador(registrada) : null;
  const quando = registrada ? dataRelativa(registrada.dataAtualizacao) : '';
  return (
    <Cartao titulo="Atualização do período" acoes={selo ? <Selo texto={selo.curto} tipo={selo.tipo} Icone={ICONE_DO_SELO[selo.tipo]} /> : undefined}>
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
        </View>}
      {/* A linha fica sempre no mesmo lugar e o seletor sempre na segunda posição dela: terminar de carregar não o
          remonta (perderia a lista aberta, o "Salvando…" e o foco). */}
      {registrada || children ? (
        <View style={estilos.linha}>
          {registrada ? <Botao rotulo={registrada.fase === 'ENVIADA' ? 'Revisar atualização' : 'Abrir atualização'} tipo={destaque ? 'primario' : 'secundario'} aoTocar={() => aoAbrir(registrada)} /> : null}
          {children ? <View style={estilos.seletor}>{children}</View> : null}
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  // O botão (44) e o select (52) centrados na mesma linha; quebra no celular.
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  seletor: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: 320, minWidth: 0 },
});
