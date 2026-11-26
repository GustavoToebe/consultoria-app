import { useRef, type ReactNode } from 'react';
import type { TextInput } from 'react-native';

import type { PlanoResumo } from '../../api/tipos';
import { corpoDaLiberacao, erroDoCampo, rotuloAgendado, type EscolhaDaLiberacao } from '../../dominio/liberacaoDePlano';
import type { CorpoDaLiberacao } from '../../api/liberacaoDePlano';
import { Botao } from '../../ui/Botao';
import { Alerta } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { EscolhaDaLiberacaoDoPlano } from './EscolhaDaLiberacao';

/**
 * "Publicar treino/dieta/mobilidade" do editor do plano do aluno (bloco E): antes de publicar, a escolha de quando o aluno
 * vê ("Liberar agora" por padrão) e se é avisado (marcado por padrão, nos dois modos). Plano já agendado abre com a data e
 * o aviso gravados e diz que publicar de novo substitui o agendamento. A data é conferida na hora do toque (foco no campo)
 * e de novo pela API (422 vai ao campo).
 * `children` = o painel "Publicar com avisos?", que precisa nascer dentro da Folha para não ficar atrás dela.
 */
export function FolhaPublicarComData({ titulo, plano, escolha, tentou, erroDaApi, publicando, aoMudar, aoPublicar, aoFechar, children }: {
  titulo: string;
  plano: Pick<PlanoResumo, 'liberarEm'>;
  escolha: EscolhaDaLiberacao;
  tentou: boolean;
  erroDaApi: string | null;
  publicando: boolean;
  aoMudar: (v: EscolhaDaLiberacao) => void;
  /** Só com a escolha válida; `tentou` liga quando a pessoa toca no botão com a data errada. */
  aoPublicar: (corpo: CorpoDaLiberacao | null) => void;
  aoFechar: () => void;
  children?: ReactNode;
}) {
  const refData = useRef<TextInput>(null);
  const erro = escolha.modo === 'agendar' ? erroDaApi ?? erroDoCampo(escolha.dataTexto, tentou) : null;
  const enviar = () => {
    const r = corpoDaLiberacao(escolha);
    if ('erro' in r) {
      aoPublicar(null);
      refData.current?.focus();
      return;
    }
    aoPublicar(r.corpo);
  };
  return (
    <Folha visivel titulo={titulo} aoFechar={publicando ? () => undefined : aoFechar}
      rodape={(
        <>
          <Botao rotulo="Cancelar" tipo="secundario" desabilitado={publicando} aoTocar={aoFechar} />
          <Botao rotulo={escolha.modo === 'agendar' ? 'Publicar e agendar' : 'Publicar agora'} carregando={publicando} aoTocar={enviar} />
        </>
      )}>
      {plano.liberarEm ? (
        <Alerta tom="atencao"texto={`${rotuloAgendado(plano.liberarEm)}. Publicar de novo substitui esse agendamento.`} />
      ) : null}
      <EscolhaDaLiberacaoDoPlano valor={escolha} aoMudar={aoMudar} erro={erro} refData={refData} />
      {children}
    </Folha>
  );
}
