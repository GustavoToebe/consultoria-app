import { router, useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { painelFinanceiro } from '../../api/rotas';
import { hojeEmBrasilia, periodoDoMes } from '../../dominio/financeiro';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { type Responsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { AbaCobrancas } from '../../treinador/financeiro/AbaCobrancas';
import { AbaLancamentos } from '../../treinador/financeiro/AbaLancamentos';
import { AbaLembretes } from '../../treinador/financeiro/AbaLembretes';
import { AbaPlanos } from '../../treinador/financeiro/AbaPlanos';
import { AbaRecebimentoOnline } from '../../treinador/financeiro/AbaRecebimentoOnline';
import { AvisoDoHistoricoParcial } from '../../treinador/financeiro/AvisoDoHistoricoParcial';
import { FolhaDeExportacao } from '../../treinador/financeiro/FolhaDeExportacao';
import { VisaoGeral } from '../../treinador/financeiro/VisaoGeral';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

type Aba = 'visao' | 'cobrancas' | 'planos' | 'lancamentos' | 'lembretes' | 'recebimento';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'cobrancas', rotulo: 'Cobranças' },
  { valor: 'planos', rotulo: 'Planos' },
  { valor: 'lancamentos', rotulo: 'Lançamentos' },
  { valor: 'lembretes', rotulo: 'Lembretes' },
  // Formas de recebimento (Pix, link próprio, Manual) e, com o módulo da InfinitePay ligado, a conta InfinitePay.
  { valor: 'recebimento', rotulo: 'Recebimento' },
];

/** Abas que mostram valores do histórico: só nelas a ressalva do histórico parcial aparece (Lembretes e Recebimento não têm valores dele). */
const ABAS_COM_VALORES: readonly Aba[] = ['visao', 'cobrancas', 'planos', 'lancamentos'];

/**
 * Financeiro: o que os alunos pagam ao treinador (planos comerciais, cobranças, painel e lançamentos avulsos). Só com
 * `FINANCEIRO_LER` e o módulo de pagamentos ligado para a consultoria (a guarda é `podeAcessarTela`); `FINANCEIRO_ALTERAR`
 * liberta os botões que mudam algo. Só online: nada do financeiro fica guardado no aparelho. Não confundir com a
 * assinatura da consultoria, que fica em Assinatura e faturas.
 */
export default function FinanceiroDoTreinador() {
  const { pode } = useSessao();
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz. Os filtros das
  // Cobranças e dos Lançamentos moram no endereço também (cada aba lê os seus); os mini-cartões do Início trazem o ponto
  // de partida das Cobranças (`?situacao=VENCIDA`, ou `ABERTA&vencimento=PROXIMOS_7_DIAS`) e o `?meus=true` de lá.
  const { aba: abaPedida, meus } = useLocalSearchParams<{ aba?: string; meus?: string }>();
  const aba: Aba = ABAS.find((a) => a.valor === abaPedida)?.valor ?? 'visao';
  // Com alteração não salva (Lembretes, Recebimento), trocar de aba pergunta antes: a rota é a mesma, então o `beforeRemove`
  // da guarda não dispara sozinho (lembretes e recebimento, 19/11).
  const { confirmar } = useSaidaGuardada();
  const setAba = (valor: Aba) => { if (valor !== aba) confirmar(() => router.push({ pathname: '/treinador/financeiro', params: { aba: valor } })); };
  const [escopo, setEscopo] = useState<Responsabilidade>(meus === 'true' ? 'meus' : 'todos');
  const [exportando, setExportando] = useState(false);
  const podeAlterar = pode('FINANCEIRO_ALTERAR');
  // O `historicoFinanceiroParcial` só vem no `/financeiro/painel` (da consultoria, não do período). Uma busca por visita à tela, daqui,
  // serve às abas com valores (`ABAS_COM_VALORES`: Visão geral, Cobranças, Planos e Lançamentos; Lembretes e Recebimento
  // não mostram valores do histórico), inclusive a quem abre direto numa delas (`?aba=`), e à explicação da exportação. A aba
  // Lançamentos usa a mesma resposta para o resultado do mês. Falha aqui não esconde lista nem bloqueia aba: sem dado, sem
  // ressalva (e sem erro novo).
  const mes = periodoDoMes(hojeEmBrasilia());
  const painelDoMes = useCarregar(`financeiro-painel-do-mes|${mes.de}`, () => painelFinanceiro({ ...mes, meus: false }));

  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Financeiro" mostrarMarca="celular"
        subtitulo="O que os seus alunos pagam a você: planos, cobranças e recebimentos. O aluno vê o plano e as cobranças na Conta dele. O app não recebe nem guarda dinheiro."
        acoes={pode('FINANCEIRO_LER') ? <Botao rotulo="Exportar CSV" tipo="secundario" Icone={Download} aoTocar={() => setExportando(true)} /> : undefined} />
      {/* Ativação manual, como na ficha do aluno: com a pergunta de saída, a aba que recebe o foco de volta (Continuar editando)
          não pode trocar sozinha e perguntar de novo. */}
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} ativacao="manual" />
      <View style={{ gap: espaco(2) }}>
        {ABAS_COM_VALORES.includes(aba) ? <AvisoDoHistoricoParcial painel={painelDoMes.dados} /> : null}
        {aba === 'visao' ? <VisaoGeral escopo={escopo} aoMudarEscopo={setEscopo} podeAlterar={podeAlterar} /> : null}
        {aba === 'cobrancas' ? <AbaCobrancas podeAlterar={podeAlterar} /> : null}
        {aba === 'planos' ? <AbaPlanos podeAlterar={podeAlterar} /> : null}
        {aba === 'lancamentos' ? <AbaLancamentos podeAlterar={podeAlterar} resultado={painelDoMes} /> : null}
        {aba === 'lembretes' ? <AbaLembretes podeAlterar={podeAlterar} /> : null}
        {aba === 'recebimento' ? <AbaRecebimentoOnline podeAlterar={podeAlterar} /> : null}
      </View>
      <FolhaDeExportacao visivel={exportando} aoFechar={() => setExportando(false)} painel={painelDoMes.dados} />
    </Tela>
  );
}
