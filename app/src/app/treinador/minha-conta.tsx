import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { consumoDoPlano, minhaConta } from '../../api/rotas';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { AbaCadastro, AbaFinanceiro, AbaPlano, CartaoConsumo } from '../../treinador/conta/PartesDaConta';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

type Aba = 'cadastro' | 'assinatura' | 'faturas';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'cadastro', rotulo: 'Cadastro' },
  { valor: 'assinatura', rotulo: 'Assinatura' },
  { valor: 'faturas', rotulo: 'Faturas' },
];

/**
 * Minha conta (só com `CONTA_LER`): cadastro, assinatura e faturas da consultoria e o consumo do plano. Só consulta. Enquanto
 * a Central não está ligada, `previa` vem verdadeiro e a tela avisa que os dados são de demonstração.
 */
export default function MinhaConta() {
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz.
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const aba: Aba = ABAS.find((a) => a.valor === abaPedida)?.valor ?? 'cadastro';
  const setAba = (valor: Aba) => { if (valor !== aba) router.push({ pathname: '/treinador/minha-conta', params: { aba: valor } }); };
  const conta = useCarregar('minha-conta', () => minhaConta());
  const consumo = useCarregar('consumo-do-plano', () => consumoDoPlano());
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Minha conta" subtitulo="Assinatura da consultoria: cadastro, plano e faturas." />
      {conta.dados?.previa ? (
        <Alerta tom="atencao" titulo="Prévia" texto="Dados de demonstração. Os dados reais virão da central de contratação." />
      ) : null}
      {conta.carregando && !conta.dados ? <Esqueleto /> : null}
      {conta.erro ? (
        <ErroOuVazio erro={conta.erro} recarregar={conta.recarregar} />
      ) : null}
      {conta.dados ? (
        <View style={{ gap: espaco(3) }}>
          <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
          {aba === 'cadastro' ? <AbaCadastro conta={conta.dados} /> : null}
          {aba === 'assinatura' ? <AbaPlano conta={conta.dados} /> : null}
          {aba === 'faturas' ? <AbaFinanceiro conta={conta.dados} /> : null}
        </View>
      ) : null}
      {consumo.erro ? <MensagemErro texto={textoDoErro(consumo.erro)} tentarDeNovo={consumo.recarregar} erro={consumo.erro} /> : null}
      {consumo.dados ? <CartaoConsumo consumo={consumo.dados} /> : null}
    </Tela>
  );
}

function ErroOuVazio({ erro, recarregar }: { erro: unknown; recarregar: () => void }) {
  const naoEncontrada = erro instanceof ErroApi && erro.status === 404;
  if (naoEncontrada) {
    return <Vazio titulo="Conta ainda não disponível" texto="Os dados comerciais desta consultoria ainda não foram registrados." />;
  }
  return <MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar} erro={erro} />;
}
