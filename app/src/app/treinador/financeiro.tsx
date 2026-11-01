import { router, useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { type Responsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { AbaCobrancas } from '../../treinador/financeiro/AbaCobrancas';
import { AbaLancamentos } from '../../treinador/financeiro/AbaLancamentos';
import { AbaLembretes } from '../../treinador/financeiro/AbaLembretes';
import { AbaPlanos } from '../../treinador/financeiro/AbaPlanos';
import { AbaRecebimentoOnline } from '../../treinador/financeiro/AbaRecebimentoOnline';
import { FolhaDeExportacao } from '../../treinador/financeiro/FolhaDeExportacao';
import { VisaoGeral } from '../../treinador/financeiro/VisaoGeral';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

type Aba = 'visao' | 'cobrancas' | 'planos' | 'lancamentos' | 'lembretes' | 'recebimento';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'cobrancas', rotulo: 'Cobranças' },
  { valor: 'planos', rotulo: 'Planos' },
  { valor: 'lancamentos', rotulo: 'Lançamentos' },
  { valor: 'lembretes', rotulo: 'Lembretes' },
];

/** Só com o recebimento online (InfinitePay) ligado na consultoria; o `?aba=recebimento` sem isso cai na Visão geral. */
const ABA_RECEBIMENTO: { valor: Aba; rotulo: string } = { valor: 'recebimento', rotulo: 'Recebimento online' };

/**
 * Financeiro: o que os alunos pagam ao treinador (planos comerciais, cobranças, painel e lançamentos avulsos). Só com
 * `FINANCEIRO_LER` e o módulo de pagamentos ligado para a consultoria (a guarda é `podeAcessarTela`); `FINANCEIRO_ALTERAR`
 * liberta os botões que mudam algo. Só online: nada do financeiro fica guardado no aparelho. Não confundir com a
 * assinatura da consultoria, que fica em Minha conta.
 */
export default function FinanceiroDoTreinador() {
  const { pode, recebimentoOnlineHabilitado } = useSessao();
  const abas = useMemo(() => (recebimentoOnlineHabilitado ? [...ABAS, ABA_RECEBIMENTO] : ABAS), [recebimentoOnlineHabilitado]);
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz. Os filtros das
  // Cobranças e dos Lançamentos moram no endereço também (cada aba lê os seus); os mini-cartões do Início trazem o ponto
  // de partida das Cobranças (`?situacao=VENCIDA`, ou `ABERTA&vencimento=PROXIMOS_7_DIAS`) e o `?meus=true` de lá.
  const { aba: abaPedida, meus } = useLocalSearchParams<{ aba?: string; meus?: string }>();
  const aba: Aba = abas.find((a) => a.valor === abaPedida)?.valor ?? 'visao';
  const setAba = (valor: Aba) => { if (valor !== aba) router.push({ pathname: '/treinador/financeiro', params: { aba: valor } }); };
  const [escopo, setEscopo] = useState<Responsabilidade>(meus === 'true' ? 'meus' : 'todos');
  const [exportando, setExportando] = useState(false);
  const podeAlterar = pode('FINANCEIRO_ALTERAR');

  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Financeiro" mostrarMarca="celular"
        acoes={pode('FINANCEIRO_LER') ? <Botao rotulo="Exportar CSV" tipo="secundario" Icone={Download} aoTocar={() => setExportando(true)} /> : undefined} />
      <Texto variante="suave">
        O que os seus alunos pagam a você: planos, cobranças e recebimentos. O aluno vê o plano e as cobranças na Conta dele.
        O app não recebe nem guarda dinheiro.
      </Texto>
      <Abas abas={abas} ativa={aba} aoMudar={setAba} />
      <View style={{ gap: espaco(2) }}>
        {aba === 'visao' ? <VisaoGeral escopo={escopo} aoMudarEscopo={setEscopo} podeAlterar={podeAlterar} /> : null}
        {aba === 'cobrancas' ? <AbaCobrancas podeAlterar={podeAlterar} /> : null}
        {aba === 'planos' ? <AbaPlanos podeAlterar={podeAlterar} /> : null}
        {aba === 'lancamentos' ? <AbaLancamentos podeAlterar={podeAlterar} /> : null}
        {aba === 'lembretes' ? <AbaLembretes podeAlterar={podeAlterar} /> : null}
        {aba === 'recebimento' ? <AbaRecebimentoOnline podeAlterar={podeAlterar} /> : null}
      </View>
      <FolhaDeExportacao visivel={exportando} aoFechar={() => setExportando(false)} />
    </Tela>
  );
}
