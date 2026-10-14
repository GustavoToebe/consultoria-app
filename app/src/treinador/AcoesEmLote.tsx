import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { desativarEmLote, opcoesDeQuestionario, responsaveisEquipe, trocarQuestionarioEmLote, trocarResponsavelEmLote } from '../api/rotas';
import type { ResultadoLote } from '../api/tipos';
import { type AcaoDoLote, mensagemDaConfirmacao, textoDoResultado } from '../dominio/loteDeAlunos';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Escolha } from '../ui/Escolha';
import { textoDoErro } from '../ui/erros';
import { MensagemErro } from '../ui/Estados';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const PADRAO = 'padrao';

interface Props {
  /** Ids marcados na lista (1 a 100). */
  alunoIds: string[];
  /** Depois de aplicar (ou de a API recusar com 404): a lista sai do modo selecionar e recarrega. */
  aoConcluir: () => void;
}

/**
 * Ações em lote sobre os alunos marcados: trocar responsável, trocar questionário e desativar. Cada uma tem a sua
 * confirmação; a API faz tudo ou nada e responde só contagens, então o aviso também só traz contagens.
 */
export function AcoesEmLote({ alunoIds, aoConcluir }: Props) {
  const { avisar } = useAviso();
  const [aberta, setAberta] = useState<AcaoDoLote | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [responsavel, setResponsavel] = useState('');
  const [questionario, setQuestionario] = useState('');
  const responsaveis = useCarregar(aberta === 'responsavel' ? 'lote-responsaveis' : null, () => responsaveisEquipe());
  const questionarios = useCarregar(aberta === 'questionario' ? 'lote-questionarios' : null, () => opcoesDeQuestionario());

  const fechar = () => { if (!aplicando) setAberta(null); };
  const abrir = (acao: AcaoDoLote) => { setResponsavel(''); setQuestionario(''); setAberta(acao); };

  const aplicar = () => {
    if (!aberta || alunoIds.length === 0) return;
    const acao = aberta;
    let chamada: Promise<ResultadoLote>;
    if (acao === 'responsavel') chamada = trocarResponsavelEmLote(alunoIds, responsavel);
    else if (acao === 'questionario') chamada = trocarQuestionarioEmLote(alunoIds, questionario === PADRAO ? null : questionario);
    else chamada = desativarEmLote(alunoIds);
    setAplicando(true);
    chamada.then(
      (r) => {
        avisar(textoDoResultado(acao, r), 'sucesso');
        setAberta(null);
        aoConcluir();
      },
      // Nada mudou (tudo ou nada): a seleção fica para o treinador tentar de novo ou desmarcar.
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    ).finally(() => setAplicando(false));
  };

  const quantos = alunoIds.length;
  const semMarcados = quantos === 0 ? 'Marque ao menos um aluno.' : undefined;
  const opcoesDeResponsavel = (responsaveis.dados ?? []).map((r) => ({ valor: r.id, rotulo: r.nome }));
  const opcoesDeQuestionarios = [
    { valor: PADRAO, rotulo: 'Padrão da consultoria' },
    ...(questionarios.dados ?? []).map((q) => ({ valor: q.id, rotulo: q.padrao ? `${q.nome} (padrão)` : q.nome })),
  ];
  const faltaEscolher = (aberta === 'responsavel' && !responsavel) || (aberta === 'questionario' && !questionario);

  return (
    <View style={estilos.acoes}>
      <Botao rotulo="Trocar responsável" tipo="secundario" desabilitado={quantos === 0} motivo={semMarcados} aoTocar={() => abrir('responsavel')} />
      <Botao rotulo="Trocar questionário" tipo="secundario" desabilitado={quantos === 0} motivo={semMarcados} aoTocar={() => abrir('questionario')} />
      <Botao rotulo="Desativar" tipo="perigoTexto" desabilitado={quantos === 0} motivo={semMarcados} aoTocar={() => abrir('desativar')} />
      <PainelConfirmacao
        visivel={aberta !== null}
        titulo={aberta === 'responsavel' ? 'Trocar o responsável?' : aberta === 'questionario' ? 'Trocar o questionário?' : 'Desativar os alunos marcados?'}
        mensagem={aberta ? mensagemDaConfirmacao(aberta, quantos) : undefined}
        rotuloConfirmar={aberta === 'desativar' ? 'Desativar' : 'Aplicar'}
        perigo={aberta === 'desativar'}
        carregando={aplicando}
        desabilitado={faltaEscolher || (aberta === 'responsavel' && responsaveis.carregando) || (aberta === 'questionario' && questionarios.carregando)}
        motivo={faltaEscolher ? 'Escolha uma opção antes de aplicar.' : undefined}
        aoConfirmar={aplicar}
        aoCancelar={fechar}>
        {aberta === 'responsavel' ? (
          responsaveis.erro ? <MensagemErro texto={textoDoErro(responsaveis.erro)} erro={responsaveis.erro} tentarDeNovo={responsaveis.recarregar} />
            : responsaveis.dados ? <Escolha rotulo="Novo responsável" opcoes={opcoesDeResponsavel} valor={responsavel} aoMudar={setResponsavel} />
              : <Texto variante="suave">Carregando a equipe…</Texto>
        ) : null}
        {aberta === 'questionario' ? (
          questionarios.erro ? <MensagemErro texto={textoDoErro(questionarios.erro)} erro={questionarios.erro} tentarDeNovo={questionarios.recarregar} />
            : questionarios.dados ? <Escolha rotulo="Questionário" opcoes={opcoesDeQuestionarios} valor={questionario} aoMudar={setQuestionario} />
              : <Texto variante="suave">Carregando os questionários…</Texto>
        ) : null}
      </PainelConfirmacao>
    </View>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
