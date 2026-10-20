import { router, useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { type Responsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { AbaCobrancas } from '../../treinador/financeiro/AbaCobrancas';
import { AbaLancamentos } from '../../treinador/financeiro/AbaLancamentos';
import { AbaPlanos } from '../../treinador/financeiro/AbaPlanos';
import { FolhaDeExportacao } from '../../treinador/financeiro/FolhaDeExportacao';
import { VisaoGeral } from '../../treinador/financeiro/VisaoGeral';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

type Aba = 'visao' | 'cobrancas' | 'planos' | 'lancamentos';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'cobrancas', rotulo: 'Cobranças' },
  { valor: 'planos', rotulo: 'Planos' },
  { valor: 'lancamentos', rotulo: 'Lançamentos' },
];

/**
 * Financeiro: o que os alunos pagam ao treinador (planos comerciais, cobranças, painel e lançamentos avulsos). Só com
 * `FINANCEIRO_LER` e o módulo de pagamentos ligado para a consultoria (a guarda é `podeAcessarTela`); `FINANCEIRO_ALTERAR`
 * liberta os botões que mudam algo. Só online: nada do financeiro fica guardado no aparelho. Não confundir com a
 * assinatura da consultoria, que fica em Minha conta.
 */
export default function FinanceiroDoTreinador() {
  const { pode } = useSessao();
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz.
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const aba: Aba = ABAS.find((a) => a.valor === abaPedida)?.valor ?? 'visao';
  const setAba = (valor: Aba) => { if (valor !== aba) router.push({ pathname: '/treinador/financeiro', params: { aba: valor } }); };
  const [escopo, setEscopo] = useState<Responsabilidade>('todos');
  const [exportando, setExportando] = useState(false);
  const podeAlterar = pode('FINANCEIRO_ALTERAR');

  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Financeiro" mostrarMarca="celular"
        acoes={pode('FINANCEIRO_LER') ? <Botao rotulo="Exportar CSV" tipo="secundario" Icone={Download} aoTocar={() => setExportando(true)} /> : undefined} />
      <Texto variante="suave">
        Planos comerciais, cobranças e recebimentos dos seus alunos. Aqui o treinador registra o que o aluno pagou; o aluno
        não paga pelo app.
      </Texto>
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      <View style={{ gap: espaco(2) }}>
        {aba === 'visao' ? <VisaoGeral escopo={escopo} aoMudarEscopo={setEscopo} podeAlterar={podeAlterar} /> : null}
        {aba === 'cobrancas' ? <AbaCobrancas escopo={escopo} aoMudarEscopo={setEscopo} podeAlterar={podeAlterar} /> : null}
        {aba === 'planos' ? <AbaPlanos podeAlterar={podeAlterar} /> : null}
        {aba === 'lancamentos' ? <AbaLancamentos podeAlterar={podeAlterar} /> : null}
      </View>
      <FolhaDeExportacao visivel={exportando} aoFechar={() => setExportando(false)} />
    </Tela>
  );
}
