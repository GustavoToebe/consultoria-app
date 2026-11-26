import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarLiberacao, liberarAgora } from '../../api/liberacaoDePlano';
import type { PlanoResumo, TipoPlano } from '../../api/tipos';
import {
  AJUDA_DO_AVISO,
  avisarAoLiberarAgora,
  destinoDoErro,
  rotuloDoAviso,
  erroDoCampo,
  rotuloAgendado,
  TEXTO_DO_ALTERAR_DATA,
  textoDaFaixa,
  textoDoLiberarAgora,
  validarDataDeLiberacao,
} from '../../dominio/liberacaoDePlano';
import { dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { CampoData } from '../../ui/Campos';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

/**
 * Erro das duas ações: 409 `PLANO_NAO_AGENDADO` (já liberado, pela rotina ou por outra pessoa) e o resto viram aviso e a
 * lista recarrega; 422 `LIBERACAO_INVALIDA` vai ao campo (só no "Alterar data"). Devolve a mensagem do campo, se houver.
 */
function tratarErro(erro: unknown, avisar: ReturnType<typeof useAviso>['avisar'], aoMudou: () => void): string | null {
  const destino = erro instanceof ErroApi ? destinoDoErro(erro) : null;
  if (destino && 'campo' in destino) return destino.campo;
  avisar(destino?.aviso ?? textoDoErro(erro), destino ? 'atencao' : 'perigo');
  aoMudou();
  return null;
}

/**
 * "Alterar data" do plano agendado (bloco E): só o dia muda; a versão e o aviso ficam. A data é conferida na hora do toque
 * e de novo pela API. Sucesso ou erro que não é do campo recarregam a lista (`aoMudou`): a ação sobe a `versao` do plano.
 */
export function FolhaAlterarLiberacao({ tipo, plano, aoFechar, aoMudou }: { tipo: TipoPlano; plano: PlanoResumo; aoFechar: () => void; aoMudou: () => void }) {
  const { avisar } = useAviso();
  const [texto, setTexto] = useState(plano.liberarEm ? dataParaTela(plano.liberarEm) : '');
  const [tentou, setTentou] = useState(false);
  const [erroDaApi, setErroDaApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<TextInput>(null);
  const erro = erroDaApi ?? erroDoCampo(texto, tentou);
  const salvar = () => {
    setTentou(true);
    const { iso } = validarDataDeLiberacao(texto);
    if (!iso) {
      ref.current?.focus();
      return;
    }
    setSalvando(true);
    alterarLiberacao(tipo, plano.id, iso).then(
      (p) => {
        aoFechar();
        avisar(`${p.liberarEm ? rotuloAgendado(p.liberarEm) : 'Data alterada'}. ${TEXTO_DO_ALTERAR_DATA}`, 'sucesso');
        aoMudou();
      },
      (erro: unknown) => {
        setSalvando(false);
        const campo = tratarErro(erro, avisar, aoMudou);
        if (campo) setErroDaApi(campo);
        else aoFechar();
      },
    );
  };
  return (
    <Folha visivel titulo="Alterar data de liberação" aoFechar={salvando ? () => undefined : aoFechar}
      rodape={(
        <>
          <Botao rotulo="Cancelar" tipo="secundario" desabilitado={salvando} aoTocar={aoFechar} />
          <Botao rotulo="Salvar data" carregando={salvando} aoTocar={salvar} />
        </>
      )}>
      <Texto variante="suave">{`“${plano.titulo}”, v${plano.versaoPublicada}. ${TEXTO_DO_ALTERAR_DATA}`}</Texto>
      <View style={estilos.campo}>
        <CampoData ref={ref} rotulo="Liberar em" valor={texto} erro={erro}
          aoMudar={(t) => { setTexto(t); setErroDaApi(null); }} />
        {erro ? null : <Texto variante="pequeno">{textoDaFaixa()}</Texto>}
      </View>
    </Folha>
  );
}

/**
 * "Liberar agora": antecipa a liberação do plano agendado, com confirmação e a caixa "Avisar o aluno", que nasce com o que
 * foi escolhido ao agendar (`avisarAoLiberarAgora`; marcada se nada foi escolhido) a cada abertura.
 */
export function PainelLiberarAgora({ tipo, plano, aoFechar, aoMudou }: { tipo: TipoPlano; plano: PlanoResumo | null; aoFechar: () => void; aoMudou: () => void }) {
  const { avisar } = useAviso();
  const [liberando, setLiberando] = useState(false);
  const [avisarAluno, setAvisarAluno] = useState(true);
  // A caixa recomeça a cada abertura (ajuste de estado no render, sem efeito): o painel fica montado para o foco voltar.
  const [aberto, setAberto] = useState<PlanoResumo | null>(null);
  if (plano !== aberto) {
    setAberto(plano);
    if (plano) setAvisarAluno(avisarAoLiberarAgora(plano));
  }
  const liberar = () => {
    if (!plano) return;
    setLiberando(true);
    liberarAgora(tipo, plano.id, avisarAluno).then(
      () => {
        setLiberando(false);
        aoFechar();
        avisar(`“${plano.titulo}” liberado. O aluno já vê esta versão.`, 'sucesso');
        aoMudou();
      },
      (erro: unknown) => {
        setLiberando(false);
        aoFechar();
        tratarErro(erro, avisar, aoMudou);
      },
    );
  };
  return (
    <PainelConfirmacao visivel={!!plano?.liberarEm} titulo="Liberar agora?" rotuloConfirmar="Liberar agora" carregando={liberando}
      mensagem={plano?.liberarEm ? textoDoLiberarAgora(plano.liberarEm) : undefined}
      aoConfirmar={liberar} aoCancelar={aoFechar}>
      <CaixaSelecao rotulo={rotuloDoAviso('agora')} ajuda={AJUDA_DO_AVISO} marcado={avisarAluno} aoMudar={setAvisarAluno} />
    </PainelConfirmacao>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
});
