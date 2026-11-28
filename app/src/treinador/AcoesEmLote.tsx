import { useState } from 'react';

import { desativarEmLote, opcoesDeQuestionario, responsaveisEquipe, trocarQuestionarioEmLote, trocarResponsavelEmLote } from '../api/rotas';
import type { ResultadoLote } from '../api/tipos';
import { rotuloDaAcao } from '../dominio/convitesEmLote';
import { type AcaoDoLote, LIMITE_LOTE, mensagemDaConfirmacao, textoDoResultado } from '../dominio/loteDeAlunos';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Escolha } from '../ui/Escolha';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { textoDoErro } from '../ui/erros';
import { MensagemErro } from '../ui/Estados';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const PADRAO = 'padrao';

interface Props {
  /** Ids marcados na lista (as três ações valem até 100; os convites, qualquer quantidade). */
  alunoIds: string[];
  /** Depois de aplicar: a lista sai do modo selecionar e recarrega. Se a API recusar, a seleção fica para tentar de novo. */
  aoConcluir: () => void;
  /** "Gerar convites (N)" (`ALUNO_CONVITE`): quem chama fecha esta folha e abre o fluxo dos convites, que vive na tela. */
  aoGerarConvites: () => void;
}

/**
 * Ações em lote sobre os alunos marcados: trocar responsável, trocar questionário e desativar. Cada uma tem a sua
 * confirmação; a API responde só contagens (o desativar pula quem tem contrato fechado vigente e o conta em `recusados`),
 * então o aviso também só traz contagens. As três pedem `ALUNO_ALTERAR` e no máximo 100 marcados; "Gerar convites" pede
 * `ALUNO_CONVITE` e aceita todos os do filtro (o fluxo divide em chamadas de 100).
 */
export function AcoesEmLote({ alunoIds, aoConcluir, aoGerarConvites }: Props) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const [aberta, setAberta] = useState<AcaoDoLote | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [responsavel, setResponsavel] = useState('');
  const [questionario, setQuestionario] = useState('');
  const responsaveis = useCarregar(aberta === 'responsavel' ? 'lote-responsaveis' : null, () => responsaveisEquipe());
  const questionarios = useCarregar(aberta === 'questionario' ? 'lote-questionarios' : null, () => opcoesDeQuestionario());

  const fechar = () => { if (!aplicando) setAberta(null); };
  const abrir = (acao: AcaoDoLote) => { setResponsavel(''); setQuestionario(''); setAberta(acao); };

  const aplicar = () => {
    if (!aberta || alunoIds.length === 0 || alunoIds.length > LIMITE_LOTE) return;
    const acao = aberta;
    let chamada: Promise<ResultadoLote>;
    if (acao === 'responsavel') chamada = trocarResponsavelEmLote(alunoIds, responsavel);
    else if (acao === 'questionario') chamada = trocarQuestionarioEmLote(alunoIds, questionario === PADRAO ? null : questionario);
    else chamada = desativarEmLote(alunoIds);
    setAplicando(true);
    chamada.then(
      (r) => {
        // Recusado (contrato fechado vigente) é pendência de alguém: âmbar, não verde.
        avisar(textoDoResultado(acao, r), r.recusados?.length ? 'atencao' : 'sucesso');
        setAberta(null);
        aoConcluir();
      },
      // A requisição falhou e nada mudou: a seleção fica para o treinador tentar de novo ou desmarcar.
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    ).finally(() => setAplicando(false));
  };

  const quantos = alunoIds.length;
  const semMarcados = quantos === 0 ? 'Marque ao menos um aluno.' : undefined;
  const acimaDoLimite = quantos > LIMITE_LOTE;
  const motivoDasTres = semMarcados ?? (acimaDoLimite ? `Esta ação vale para até ${LIMITE_LOTE} alunos por vez.` : undefined);
  const opcoesDeResponsavel = (responsaveis.dados ?? []).map((r) => ({ valor: r.id, rotulo: r.nome }));
  const opcoesDeQuestionarios = [
    { valor: PADRAO, rotulo: 'Padrão da consultoria' },
    ...(questionarios.dados ?? []).map((q) => ({ valor: q.id, rotulo: q.padrao ? `${q.nome} (padrão)` : q.nome })),
  ];
  const faltaEscolher = (aberta === 'responsavel' && !responsavel) || (aberta === 'questionario' && !questionario);

  return (
    <LinhaDeAcoes>
      {pode('ALUNO_CONVITE') ? (
        <Botao rotulo={rotuloDaAcao(quantos)} tipo="secundario" desabilitado={quantos === 0} motivo={semMarcados} aoTocar={aoGerarConvites} />
      ) : null}
      {pode('ALUNO_ALTERAR') ? (
        <>
          <Botao rotulo="Trocar responsável" tipo="secundario" desabilitado={!!motivoDasTres} motivo={motivoDasTres} aoTocar={() => abrir('responsavel')} />
          <Botao rotulo="Trocar questionário" tipo="secundario" desabilitado={!!motivoDasTres} motivo={motivoDasTres} aoTocar={() => abrir('questionario')} />
          <Botao rotulo="Desativar" tipo="perigoTexto" desabilitado={!!motivoDasTres} motivo={motivoDasTres} aoTocar={() => abrir('desativar')} />
        </>
      ) : null}
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
    </LinhaDeAcoes>
  );
}
