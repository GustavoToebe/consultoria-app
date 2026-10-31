import { router, type Href } from 'expo-router';
import { Funnel, RefreshCw, SquareArrowOutUpRight } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { BlocoDoPainel as DadosDoBloco, FolhaDoPainelId } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Alerta } from '../../ui/Estados';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { BarrasDoRecebido } from './BarrasDoRecebido';
import { CartaoMini } from './CartaoMini';
import { FaixaDoPainel } from './FaixaDoPainel';
import { RoscaDosAlunos } from './RoscaDosAlunos';

/**
 * Um bloco do painel: faixa com o título (e "Últimos 7 dias" / "Só os meus alunos" embaixo dele) e três ícones (abrir a
 * tela do assunto, atualizar só este bloco, Todos/Meus); dentro, os mini-cartões, a linha neutra de baixo, o gráfico e a
 * nota. Nada carregou: os cartões dizem "Não carregou" (nunca zero) e aparece o "Atualizar"; no gráfico, um aviso com ele.
 */
export function BlocoDoPainel({ bloco, aoAtualizar, aoAlternarFiltro, aoAbrirFolha, style }: {
  bloco: DadosDoBloco;
  aoAtualizar: () => void;
  aoAlternarFiltro: () => void;
  aoAbrirFolha: (folha: FolhaDoPainelId) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { cores } = useTema();
  const descricao = [bloco.periodo, bloco.escopo].filter(Boolean).join(' · ') || null;
  const acoes = (
    <>
      <IconeBotao Icone={SquareArrowOutUpRight} rotulo={`Abrir ${bloco.titulo}`} aoTocar={() => router.push(bloco.abrir as Href)} />
      <IconeBotao Icone={RefreshCw} rotulo={`Atualizar ${bloco.titulo}`} aoTocar={aoAtualizar} />
      {bloco.temFiltro ? <IconeBotao Icone={Funnel} rotulo={bloco.rotuloDoFiltro} moldura={bloco.meus} aoTocar={aoAlternarFiltro} /> : null}
    </>
  );
  const semCartoes = bloco.cartoes.length === 0 && !bloco.linha;
  return (
    <Cartao cabecalho={<FaixaDoPainel titulo={bloco.titulo} descricao={descricao} acoes={acoes} />} style={[estilos.bloco, style]}>
      {bloco.falhou && semCartoes ? (
        <Alerta tom="perigo" texto="Não carregou.">
          <Botao rotulo="Atualizar" rotuloAcessivel={`Atualizar ${bloco.titulo}`} tipo="secundario" Icone={RefreshCw} aoTocar={aoAtualizar} />
        </Alerta>
      ) : (
        <>
          {bloco.cartoes.length ? (
            <View style={estilos.cartoes}>
              {bloco.cartoes.map((c) => <CartaoMini key={c.chave} cartao={c} aoAbrirFolha={aoAbrirFolha} />)}
            </View>
          ) : null}
          {bloco.linha ? <CartaoMini cartao={bloco.linha} aoAbrirFolha={aoAbrirFolha} linha /> : null}
          {bloco.grafico?.tipo === 'rosca' ? <RoscaDosAlunos rosca={bloco.grafico} /> : null}
          {bloco.grafico?.tipo === 'barras' ? <BarrasDoRecebido barras={bloco.grafico} /> : null}
          {semCartoes && !bloco.grafico && bloco.carregando ? (
            <View accessibilityRole="progressbar" accessibilityLabel={`${bloco.titulo}: carregando`}
              style={[estilos.esqueleto, { backgroundColor: cores.superficie2 }]} />
          ) : null}
          {bloco.nota ? <Texto variante="pequeno">{bloco.nota}</Texto> : null}
          {/* Nenhum cartão carregou: cada um já diz "Não carregou"; aqui o atalho para tentar de novo. */}
          {bloco.falhou ? <Botao rotulo="Atualizar" rotuloAcessivel={`Atualizar ${bloco.titulo}`} tipo="secundario" Icone={RefreshCw} aoTocar={aoAtualizar} /> : null}
        </>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  bloco: { minWidth: 0 },
  cartoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  esqueleto: { height: 140, borderRadius: RAIO },
});
