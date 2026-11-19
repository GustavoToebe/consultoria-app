import { Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { buscarResponsavelFinanceiro, removerResponsavelFinanceiro, type ResponsavelFinanceiro as Responsavel } from '../../api/financeiroResponsavel';
import {
  acoesDoResponsavel, leituraDoResponsavel, SEM_RESPONSAVEL, SEM_RESPONSAVEL_NA_RESPOSTA, temResponsavel, TITULO_DO_RESPONSAVEL, traduzirErroDoResponsavel,
} from '../../dominio/responsavelFinanceiro';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Divisor } from '../../ui/Divisor';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaResponsavelFinanceiro } from './FolhaResponsavelFinanceiro';

/**
 * Seção "Responsável financeiro" do cartão "Plano contratado" (D15): quem recebe os lembretes de pagamento no lugar do aluno.
 * Quem chama já conferiu `FINANCEIRO_LER` e o Financeiro ligado; `podeAlterar` = `FINANCEIRO_ALTERAR` e aluno não anonimizado
 * (sem ela, só leitura). Vale com ou sem plano contratado (a cobrança avulsa também tem lembrete). O CPF só aparece com
 * `ALUNO_SENSIVEL_LER`. Nada daqui vai a log, `console` ou título: os avisos são fixos.
 */
export function ResponsavelFinanceiro({ alunoId, podeAlterar }: { alunoId: string; podeAlterar: boolean }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const veCpf = pode('ALUNO_SENSIVEL_LER');
  const chave = `responsavel-financeiro:${alunoId}`;
  const carga = useCarregar(chave, () => buscarResponsavelFinanceiro(alunoId));
  const [editando, setEditando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoRemover, setErroDoRemover] = useState<string | null>(null);

  // Financeiro desligado no servidor: some, como o resto do Financeiro (não é erro).
  if (codigoApi(carga.erro) === 'FINANCEIRO_INDISPONIVEL') return null;
  const r = carga.dados;
  const acoes = acoesDoResponsavel(podeAlterar, r);

  const recarregarComAviso = (mensagem: string) => {
    setEditando(false);
    setRemovendo(false);
    avisar(mensagem, 'neutro');
    carga.recarregar();
  };

  const remover = () => {
    if (!r?.versao || enviando) return;
    setEnviando(true);
    setErroDoRemover(null);
    removerResponsavelFinanceiro(alunoId, r.versao).then(
      () => {
        setEnviando(false);
        setRemovendo(false);
        carga.definir(SEM_RESPONSAVEL_NA_RESPOSTA, chave);
        avisar('Responsável financeiro removido.', 'sucesso');
      },
      (e: unknown) => {
        setEnviando(false);
        const t = traduzirErroDoResponsavel(e, veCpf);
        if (t.recarregar || t.esconder) recarregarComAviso(t.mensagem);
        else setErroDoRemover(t.mensagem);
      },
    );
  };

  const salvo = (novo: Responsavel) => {
    setEditando(false);
    carga.definir(novo, chave);
    avisar('Responsável financeiro salvo.', 'sucesso');
  };

  return (
    <View style={estilos.bloco}>
      <Divisor />
      <Texto variante="secao" nivel={3}>{TITULO_DO_RESPONSAVEL}</Texto>
      {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
      {!r && carga.carregando ? <Esqueleto /> : null}
      {r && !temResponsavel(r) ? <Texto variante="suave">{SEM_RESPONSAVEL}</Texto> : null}
      {r && temResponsavel(r) ? leituraDoResponsavel(r, veCpf).filter((linha) => linha.length > 0).map((linha) => (
        <CamposEmLinha key={linha[0].rotulo} minimo={220}>
          {linha.map((p) => <CampoLeitura key={p.rotulo} rotulo={p.rotulo} valor={p.valor} numerico={p.numerico} />)}
        </CamposEmLinha>
      )) : null}
      {acoes.editar ? (
        <LinhaDeAcoes>
          <Botao rotulo={acoes.editar} tipo="secundario" Icone={acoes.remover ? Pencil : Plus} aoTocar={() => setEditando(true)} />
          {acoes.remover ? <Botao rotulo="Remover responsável" tipo="perigoTexto" aoTocar={() => { setErroDoRemover(null); setRemovendo(true); }} /> : null}
        </LinhaDeAcoes>
      ) : null}
      {editando && r ? (
        <FolhaResponsavelFinanceiro alunoId={alunoId} responsavel={r} veCpf={veCpf}
          aoFechar={() => setEditando(false)} aoSalvar={salvo} aoRecarregar={recarregarComAviso} />
      ) : null}
      <PainelConfirmacao visivel={removendo} titulo="Remover o responsável financeiro?"
        mensagem="Os dados dele são apagados e os lembretes de pagamento voltam a ir ao próprio aluno."
        rotuloConfirmar="Remover responsável" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={remover} aoCancelar={() => setRemovendo(false)}>
        {erroDoRemover ? <MensagemErro texto={erroDoRemover} /> : null}
      </PainelConfirmacao>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
});
