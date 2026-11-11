import { usePathname } from 'expo-router';
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { contextoDoTopo, naConta } from '../dominio/gruposDoMenu';
import { telasPermitidas } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Botao } from './Botao';
import { CartaoDoUsuario } from './CartaoDoUsuario';
import { BuscaGlobal } from './BuscaGlobal';
import { IconeBotao } from './IconeBotao';
import { useMenuLateral } from './Navegacao';
import { Texto } from './Texto';
import { TodasAsTelas } from './TodasAsTelas';
import { useFavoritos } from './useFavoritos';
import { useFundoDaArea } from './fundoDaArea';

/**
 * Barra de topo do treinador na web (o `Navegacao` só a monta com o menu lateral), 52 px como a prévia de 11/11. À
 * esquerda, o recolher/expandir do menu (fora do trilho, que não recolhe) e o contexto curto (o grupo do menu da tela,
 * "Início" ou "Conta"); à direita, a busca global, "Todas as telas" (com favoritos) e o cartão do usuário. O nome da tela
 * não se repete aqui: ele é o h1 da própria tela, e a trilha continua no `Cabecalho`. Com pouco painel os controles
 * compactam aos poucos: "Todas as telas" vira só ícone, a busca encolhe e o cartão fica só com o nome. No celular não existe.
 */
export function BarraTopo() {
  const caminho = usePathname();
  const { pode, perfilEquipe, funcionalidadesDoPlano, pagamentosHabilitados } = useSessao();
  const { cores } = useTema();
  // A barra é o cabeçalho fino do painel do conteúdo: mesma cor dele, filete discreto embaixo.
  const fundo = useFundoDaArea();
  const { width } = useWindowDimensions();
  const menu = useMenuLateral();
  const administrador = !!perfilEquipe?.acessoTotal;
  const permitidas = useMemo(() => telasPermitidas(pode, undefined, funcionalidadesDoPlano, pagamentosHabilitados, administrador), [pode, funcionalidadesDoPlano, pagamentosHabilitados, administrador]);
  const { favoritos, alternar } = useFavoritos();
  const [todas, setTodas] = useState(false);
  // Largura do painel (janela menos o menu e a folga de 8): é o que a barra tem para os controles.
  const painel = width - menu.larguraDoMenu - espaco(1);
  const media = painel < 1000;
  const estreita = painel < 840;
  const contexto = contextoDoTopo(caminho);
  const IconeDoMenu = menu.recolhido ? PanelLeftOpen : PanelLeftClose;
  return (
    <View style={[estilos.barra, !menu.podeRecolher && estilos.semAlternar, { backgroundColor: fundo, borderColor: cores.divisor }]}>
      <View style={estilos.esquerda}>
        {menu.podeRecolher ? (
          <IconeBotao Icone={IconeDoMenu} rotulo={menu.recolhido ? 'Expandir menu' : 'Minimizar menu'} aoTocar={menu.alternar} cor={cores.textoSuave} />
        ) : null}
        {menu.podeRecolher && contexto ? <View aria-hidden style={[estilos.separador, { backgroundColor: cores.divisor }]} /> : null}
        {/* Texto de apoio, não link nem título: o leitor de tela já ouve o lugar no menu (grupo e item atual). */}
        {contexto ? <Texto aria-hidden numberOfLines={1} style={estilos.contexto}>{contexto}</Texto> : null}
      </View>
      <View style={estilos.direita}>
        <View style={[estilos.busca, { width: estreita ? 200 : media ? 240 : 280 }]}>
          <BuscaGlobal permitidas={permitidas} favoritos={favoritos} />
        </View>
        {media
          ? <IconeBotao Icone={LayoutGrid} rotulo="Todas as telas" aoTocar={() => setTodas(true)} />
          : <Botao rotulo="Todas as telas" tipo="fantasma" Icone={LayoutGrid} aoTocar={() => setTodas(true)} />}
        <CartaoDoUsuario compacto={estreita} ativo={naConta(caminho)} />
      </View>
      <TodasAsTelas visivel={todas} aoFechar={() => setTodas(false)} permitidas={permitidas} favoritos={favoritos} aoAlternarFavorito={alternar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  // 44 dos controles + 4 em cima e embaixo; o filete de 1 px fica por fora (53 renderizados).
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(2),
    minHeight: 52,
    paddingLeft: espaco(1),
    paddingRight: espaco(2),
    paddingVertical: espaco(0.5),
    borderBottomWidth: 1,
    zIndex: 20,
  },
  // O botão de 44 já tem folga em volta do ícone; sem ele (trilho), o contexto pede a margem de sempre.
  semAlternar: { paddingLeft: espaco(2) },
  esquerda: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, minWidth: 0 },
  separador: { width: 1, height: 16 },
  contexto: { flexShrink: 1, fontFamily: fontes.medio, fontSize: 14, lineHeight: 20 },
  // A busca encolhe antes dos botões, que nunca encostam nela; abaixo de 160 px ela deixaria de ser usável.
  direita: { marginLeft: 'auto', flexShrink: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: espaco(1) },
  busca: { flexShrink: 1, minWidth: 160 },
});
