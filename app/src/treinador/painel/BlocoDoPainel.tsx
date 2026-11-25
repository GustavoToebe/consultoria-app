import { router, type Href } from 'expo-router';
import { Funnel, RefreshCw, SquareArrowOutUpRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TEXTO_RECURSO_DESATIVADO } from '../../dominio/financeiroDesligado';
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
 * tela do assunto, atualizar só este bloco, Todos/Meus); dentro, o {@link CorpoDoBloco}.
 * `children`: corpo próprio do bloco sem cartões (a lista dos Aniversários), no lugar deles, depois de carregar.
 */
export function BlocoDoPainel({ bloco, aoAtualizar, aoAlternarFiltro, aoAbrirFolha, style, children }: {
  bloco: DadosDoBloco;
  aoAtualizar: () => void;
  aoAlternarFiltro: () => void;
  aoAbrirFolha: (folha: FolhaDoPainelId) => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const descricao = [bloco.periodo, bloco.escopo].filter(Boolean).join(' · ') || null;
  const acoes = (
    <>
      <IconeBotao Icone={SquareArrowOutUpRight} rotulo={`Abrir ${bloco.titulo}`} aoTocar={() => router.push(bloco.abrir as Href)} />
      <IconeBotao Icone={RefreshCw} rotulo={`Atualizar ${bloco.titulo}`} aoTocar={aoAtualizar} />
      {bloco.temFiltro ? <IconeBotao Icone={Funnel} rotulo={bloco.rotuloDoFiltro} moldura={bloco.meus} aoTocar={aoAlternarFiltro} /> : null}
    </>
  );
  return (
    <Cartao cabecalho={<FaixaDoPainel titulo={bloco.titulo} descricao={descricao} acoes={acoes} />} style={[estilos.bloco, style]}>
      <CorpoDoBloco bloco={bloco} aoAtualizar={aoAtualizar} aoAbrirFolha={aoAbrirFolha}>{children}</CorpoDoBloco>
    </Cartao>
  );
}

/**
 * O que vai dentro do bloco, sem a faixa: os mini-cartões, a linha neutra de baixo, o gráfico, a nota ou o corpo próprio
 * (`children`). Nada carregou: os cartões dizem "Não carregou" (nunca zero) e aparece o "Atualizar"; no gráfico, um aviso
 * com ele. A edição do Início usa só isto, sob a barra de controles (a faixa repetiria o nome).
 */
export function CorpoDoBloco({ bloco, aoAtualizar, aoAbrirFolha, children }: {
  bloco: DadosDoBloco;
  aoAtualizar: () => void;
  aoAbrirFolha: (folha: FolhaDoPainelId) => void;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const semCartoes = bloco.cartoes.length === 0 && !bloco.linha;
  if (bloco.falhou && semCartoes) {
    return (
      <Alerta tom="perigo" texto="Não carregou.">
        <Botao rotulo="Atualizar" rotuloAcessivel={`Atualizar ${bloco.titulo}`} tipo="secundario" Icone={RefreshCw} aoTocar={aoAtualizar} />
      </Alerta>
    );
  }
  return (
    <View style={estilos.corpo}>
      {bloco.cartoes.length ? (
        <View style={estilos.cartoes}>
          {bloco.cartoes.map((c) => <CartaoMini key={c.chave} cartao={c} aoAbrirFolha={aoAbrirFolha} />)}
        </View>
      ) : null}
      {bloco.linha ? <CartaoMini cartao={bloco.linha} aoAbrirFolha={aoAbrirFolha} linha /> : null}
      {bloco.grafico?.tipo === 'rosca' ? <RoscaDosAlunos rosca={bloco.grafico} /> : null}
      {bloco.grafico?.tipo === 'barras' ? <BarrasDoRecebido barras={bloco.grafico} /> : null}
      {bloco.desativado ? <Texto variante="suave">{TEXTO_RECURSO_DESATIVADO}</Texto> : null}
      {bloco.carregando ? null : children}
      {semCartoes && !bloco.grafico && bloco.carregando ? (
        <View accessibilityRole="progressbar" accessibilityLabel={`${bloco.titulo}: carregando`}
          style={[estilos.esqueleto, { backgroundColor: cores.superficie2 }]} />
      ) : null}
      {bloco.nota ? <Texto variante="pequeno">{bloco.nota}</Texto> : null}
      {/* Nenhum cartão carregou: cada um já diz "Não carregou"; aqui o atalho para tentar de novo. */}
      {bloco.falhou ? <Botao rotulo="Atualizar" rotuloAcessivel={`Atualizar ${bloco.titulo}`} tipo="secundario" Icone={RefreshCw} aoTocar={aoAtualizar} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { minWidth: 0, borderRadius: 16 },
  // O mesmo vão do corpo do `Cartao`.
  corpo: { gap: espaco(2) },
  cartoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  esqueleto: { height: 140, borderRadius: RAIO },
});
