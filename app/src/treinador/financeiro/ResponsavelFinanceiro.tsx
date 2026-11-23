import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { buscarResponsavelFinanceiro, removerResponsavelFinanceiro, type ResponsavelFinanceiro as Responsavel } from '../../api/financeiroResponsavel';
import {
  acoesDoResponsavel, linhaDoResponsavel, SEM_RESPONSAVEL, SEM_RESPONSAVEL_NA_RESPOSTA, temResponsavel, TITULO_DO_RESPONSAVEL, traduzirErroDoResponsavel,
} from '../../dominio/responsavelFinanceiro';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Divisor } from '../../ui/Divisor';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { FolhaResponsavelFinanceiro } from './FolhaResponsavelFinanceiro';

/**
 * Seção "Responsável financeiro" do cartão "Plano contratado" (D15): quem recebe os lembretes de pagamento no lugar do aluno.
 * Linha própria, separada por fio (23/11): sem responsável, a frase e "Adicionar responsável" (construção, `acao`); com ele,
 * nome, contato e o ⋯ com Editar e Remover (destrutivo, com texto e confirmação).
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
  const [menu, setMenu] = useState(false);

  // Financeiro desligado no servidor: some, como o resto do Financeiro (não é erro).
  if (codigoApi(carga.erro) === 'FINANCEIRO_INDISPONIVEL') return null;
  const r = carga.dados;
  const acoes = acoesDoResponsavel(podeAlterar, r);
  const linha = r && temResponsavel(r) ? linhaDoResponsavel(r, veCpf) : null;

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
      {/* Linha própria (23/11): o título e quem recebe os lembretes à esquerda; a ação (ou o ⋯) à direita. */}
      <View style={estilos.linha}>
        <View style={estilos.texto}>
          <Texto variante="secao" nivel={3}>{TITULO_DO_RESPONSAVEL}</Texto>
          {!r && carga.carregando ? <Esqueleto /> : null}
          {r && !temResponsavel(r) ? <Texto variante="suave">{SEM_RESPONSAVEL}</Texto> : null}
          {linha ? (
            <>
              <Texto>{linha.quem}</Texto>
              {linha.contato ? <Texto variante="suave" numerico>{linha.contato}</Texto> : null}
              {linha.cpf ? <Texto variante="pequeno" numerico>CPF {linha.cpf}</Texto> : null}
            </>
          ) : null}
        </View>
        {acoes.editar && !acoes.remover ? (
          <Botao rotulo={acoes.editar} tipo="acao" Icone={Plus} aoTocar={() => setEditando(true)} />
        ) : null}
        {acoes.remover ? <IconeBotao Icone={Ellipsis} moldura rotulo="Mais ações do responsável financeiro" aoTocar={() => setMenu(true)} /> : null}
      </View>
      {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
      {menu && acoes.editar ? (
        <FolhaDeAcoes titulo={TITULO_DO_RESPONSAVEL} aoFechar={() => setMenu(false)} acoes={[
          { rotulo: acoes.editar, Icone: Pencil, aoTocar: () => depoisDoMenu(() => setEditando(true)) },
          { rotulo: 'Remover responsável', Icone: Trash2, perigo: true, aoTocar: () => depoisDoMenu(() => { setErroDoRemover(null); setRemovendo(true); }) },
        ]} />
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

/** No celular, a folha ou o painel seguinte só abre depois de o ⋯ fechar (a mesma espera do ⋯ da ficha). */
const depoisDoMenu = (f: () => void) => (Platform.OS === 'web' ? f() : setTimeout(f, 350));

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, gap: espaco(0.5) },
});
