import { router, type Href } from 'expo-router';
import { ChevronDown, LogOut, ShieldCheck, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { itensDoMenuDoUsuario, type IdDoItemDoMenu } from '../dominio/menuDoUsuario';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { ConfirmarSaida } from './ConfirmarSaida';
import { useSaidaGuardada } from './GuardaDeSaida';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useCliqueFora, useTeclado } from './usoWeb';

export const ICONES_DO_MENU: Record<IdDoItemDoMenu, LucideIcon> = {
  'meus-dados': UserRound,
  seguranca: ShieldCheck,
  'minha-conta': UserRound,
  ajustes: SlidersHorizontal,
  sair: LogOut,
};

/**
 * Cartão do usuário na barra de topo: nome, perfil na equipe e seta. Abre o menu (Meus dados, Minha conta, Ajustes,
 * Sair). Fecha com Esc e com clique fora; setas escolhem e Enter abre. Sair pede a confirmação de sempre.
 */
export function CartaoDoUsuario({ compacto }: { compacto?: boolean } = {}) {
  const { usuario, perfilEquipe, pode } = useSessao();
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [saindo, setSaindo] = useState(false);
  const caixa = useRef<View>(null);
  const itens = itensDoMenuDoUsuario(pode);

  const { confirmar } = useSaidaGuardada();
  const fechar = () => {
    setAberto(false);
    setAtivo(-1);
  };
  const escolher = (id: IdDoItemDoMenu, href: string | null) => {
    fechar();
    // Sair da conta tem a própria pergunta (que já avisa de alteração não salva): passar pela guarda perguntaria duas vezes.
    if (href === null) setSaindo(true);
    else confirmar(() => router.navigate(href as Href));
  };

  useCliqueFora(caixa, aberto, fechar);
  useTeclado(aberto, ({ key, ctrl }) => {
    // Ctrl+K abre a busca: o menu fecha para as setas e o Enter não agirem nos dois.
    if (ctrl && key.toLowerCase() === 'k') {
      fechar();
      return undefined;
    }
    if (key === 'Escape') {
      fechar();
      return true;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      setAtivo((a) => (key === 'ArrowDown' ? (a + 1) % itens.length : (a <= 0 ? itens.length : a) - 1));
      return true;
    }
    if (key === 'Enter' && ativo >= 0) {
      escolher(itens[ativo].id, itens[ativo].href);
      return true;
    }
    return undefined;
  });

  return (
    <View ref={caixa} style={estilos.caixa}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Menu do usuário, ${usuario?.nome ?? ''}`}
        accessibilityState={{ expanded: aberto }}
        onPress={() => (aberto ? fechar() : setAberto(true))}
        style={(estado) => [estilos.cartao, compacto && estilos.cartaoCompacto, { borderColor: cores.borda }, (aberto || sobre(estado)) && { backgroundColor: cores.superficie3 }]}>
        <View style={estilos.textos}>
          <Texto numberOfLines={1} style={estilos.nome}>{usuario?.nome ?? '—'}</Texto>
          {compacto ? null : <Texto variante="pequeno" numberOfLines={1}>{perfilEquipe?.nome ?? '—'}</Texto>}
        </View>
        <ChevronDown size={16} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {aberto ? (
        <View accessibilityRole="menu" style={[estilos.menu, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          {itens.map((item, i) => {
            const Icone = ICONES_DO_MENU[item.id];
            const perigo = item.id === 'sair';
            return (
              <View key={item.id}>
                {perigo ? <View style={[estilos.separador, { backgroundColor: cores.divisor }]} /> : null}
                <Pressable
                  accessibilityRole="menuitem"
                  onPress={() => escolher(item.id, item.href)}
                  onHoverIn={() => setAtivo(i)}
                  style={(estado) => [estilos.item, (i === ativo || sobre(estado)) && { backgroundColor: cores.superficie3 }]}>
                  <Icone size={18} color={perigo ? cores.perigo : cores.textoSuave} strokeWidth={2} />
                  <Texto style={[estilos.rotulo, perigo && { color: cores.perigo }]}>{item.rotulo}</Texto>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { position: 'relative', zIndex: 40 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE,
    maxWidth: 260,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    borderWidth: 1,
    borderRadius: RAIO,
  },
  // No trilho (768 a 1023 px) o cartão encurta: só o nome.
  cartaoCompacto: { maxWidth: 180 },
  textos: { flexShrink: 1, minWidth: 0 },
  nome: { fontFamily: fontes.semi, fontSize: 14 },
  menu: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: 240,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingVertical: espaco(0.5),
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5) },
  rotulo: { fontFamily: fontes.semi, fontSize: 14 },
  separador: { height: 1, marginVertical: espaco(0.5) },
});
