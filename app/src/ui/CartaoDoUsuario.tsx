import { router, usePathname, type Href } from 'expo-router';
import { ChevronUp, CreditCard, LogOut, Palette, ShieldCheck, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';
import { iniciais } from '../dominio/fotoDePerfil';
import { naConta } from '../dominio/gruposDoMenu';
import { itensDoMenuDoUsuario, type IdDoItemDoMenu } from '../dominio/menuDoUsuario';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { ConfirmarSaida } from './ConfirmarSaida';
import { useSaidaGuardada } from './GuardaDeSaida';
import { useDicaNoMenu, useMenuLateral } from './Navegacao';
import { useAlvoDoPasseio } from './Passeio';
import { sobre } from './sobre';
import { propsDeLink } from './propsDeLink';
import { Texto } from './Texto';
import { useCliqueFora, useTeclado } from './usoWeb';

export const ICONES_DO_MENU: Record<IdDoItemDoMenu, LucideIcon> = {
  'meus-dados': UserRound,
  seguranca: ShieldCheck,
  // A assinatura (plano e cobranças) tem ícone próprio: com o mesmo de Meus dados as duas linhas pareciam iguais.
  'minha-conta': CreditCard,
  marca: Palette,
  ajustes: SlidersHorizontal,
  sair: LogOut,
};

/**
 * Conta de quem está logado, no rodapé fixo do menu lateral da web (guia de 11/11, D3). Menu aberto: as iniciais, o nome
 * (longo trunca com reticências), o perfil na equipe e a seta. Minimizado: só as iniciais, com o nome na dica. Trilho:
 * as iniciais com "Conta" embaixo. Fica realçado nas telas da conta. Abre o menu de sempre (Meus dados, Segurança,
 * Assinatura e faturas, Marca para o Administrador, Ajustes, Sair, conforme a permissão): para cima no menu aberto e para
 * o lado nos estreitos, sempre dentro da janela. Fecha com Esc (o foco volta ao botão) e com clique fora; setas escolhem e
 * Enter abre. Sair pede a confirmação de sempre. Sem foto: buscar a imagem aqui seria uma chamada a mais em toda tela.
 */
export function CartaoDoUsuario() {
  const { usuario, perfilEquipe, pode } = useSessao();
  const administrador = !!perfilEquipe?.acessoTotal;
  const { cores } = useTema();
  const { recolhido, trilho, esconderDica } = useMenuLateral();
  const soIcone = recolhido && !trilho;
  const nome = usuario?.nome?.trim() || '—';
  const realce = naConta(usePathname());
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [saindo, setSaindo] = useState(false);
  const caixa = useRef<View>(null);
  const botaoRef = useRef<View | null>(null);
  const dica = useDicaNoMenu(nome, soIcone && !aberto, botaoRef);
  const alvo = useAlvoDoPasseio('menu:conta');
  const ref = useCallback((n: View | null) => {
    botaoRef.current = n;
    alvo(n);
  }, [alvo]);
  const itens = itensDoMenuDoUsuario(pode, administrador);

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
      botaoRef.current?.focus();
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
        ref={ref}
        accessibilityRole="button"
        // Começa por "Conta", o rótulo visível no trilho (WCAG 2.5.3), e contém o nome, o visível no menu aberto.
        accessibilityLabel={`Conta de ${nome}`}
        accessibilityState={{ expanded: aberto, selected: realce }}
        onPress={() => {
          esconderDica?.();
          if (aberto) fechar();
          else setAberto(true);
        }}
        {...dica}
        style={(estado) => [
          estilos.cartao,
          recolhido && (trilho ? estilos.cartaoTrilho : estilos.cartaoIcone),
          realce && { backgroundColor: cores.superficie2 },
          (aberto || sobre(estado)) && { backgroundColor: cores.superficie3 },
        ]}>
        <View aria-hidden style={[estilos.avatar, { backgroundColor: cores.superficie3, borderColor: cores.divisor }]}>
          <Texto style={[estilos.iniciais, { color: cores.texto }]}>{iniciais(usuario?.nome)}</Texto>
        </View>
        {soIcone ? null : trilho ? (
          <Texto numberOfLines={1} style={[estilos.rotuloTrilho, { color: realce ? cores.texto : cores.textoSuave }]}>Conta</Texto>
        ) : (
          <>
            <View style={estilos.textos}>
              <Texto numberOfLines={1} style={estilos.nome}>{nome}</Texto>
              <Texto variante="pequeno" numberOfLines={1}>{perfilEquipe?.nome ?? '—'}</Texto>
            </View>
            <ChevronUp size={16} color={cores.textoSuave} strokeWidth={2} />
          </>
        )}
      </Pressable>
      {aberto ? (
        <View style={[estilos.menu, recolhido ? estilos.menuAoLado : estilos.menuAcima, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
          <View style={[estilos.cabeca, { borderBottomColor: cores.divisor }]}>
            <Texto numberOfLines={2} style={estilos.nome}>{nome}</Texto>
            <Texto variante="pequeno" numberOfLines={1}>{perfilEquipe?.nome ?? '—'}</Texto>
          </View>
          <View accessibilityRole="menu" accessibilityLabel="Conta">
            {itens.map((item, i) => {
              const Icone = ICONES_DO_MENU[item.id];
              const perigo = item.id === 'sair';
              return (
                <View key={item.id}>
                  {perigo ? <View style={[estilos.separador, { backgroundColor: cores.divisor }]} /> : null}
                  <Pressable
                    accessibilityRole="menuitem"
                    {...(item.href !== null
                      ? propsDeLink(item.href as Href, () => escolher(item.id, item.href))
                      : { onPress: () => escolher(item.id, item.href) })}
                    onPress={(evento) => {
                      // Ctrl/Cmd+clique abre outra guia e o menu ficava aberto por cima da tela.
                      if (item.href !== null && deixarParaONavegador(evento as unknown as CliqueDoNavegador)) {
                        fechar();
                        return;
                      }
                      if (item.href !== null) propsDeLink(item.href as Href, () => escolher(item.id, item.href)).onPress(evento);
                      else escolher(item.id, item.href);
                    }}
                    onHoverIn={() => setAtivo(i)}
                    style={(estado) => [estilos.item, (i === ativo || sobre(estado)) && { backgroundColor: cores.superficie3 }]}>
                    <Icone size={18} color={perigo ? cores.perigo : cores.textoSuave} strokeWidth={2} />
                    <Texto style={[estilos.rotulo, perigo && { color: cores.perigo }]}>{item.rotulo}</Texto>
                  </Pressable>
                </View>
              );
            })}
          </View>
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
    gap: espaco(1),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1),
    paddingVertical: 4,
    borderRadius: RAIO_CONTROLE,
  },
  cartaoIcone: { justifyContent: 'center', paddingHorizontal: 0 },
  cartaoTrilho: { flexDirection: 'column', justifyContent: 'center', gap: 2, paddingHorizontal: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iniciais: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16 },
  textos: { flex: 1, minWidth: 0 },
  nome: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18 },
  rotuloTrilho: { alignSelf: 'stretch', textAlign: 'center', fontSize: 12, lineHeight: 16, fontFamily: fontes.medio },
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: RAIO,
    paddingBottom: espaco(0.5),
  },
  // Menu aberto: acima do botão, na largura do rodapé (o botão está no pé da janela).
  menuAcima: { bottom: '100%', marginBottom: 4, left: 0, right: 0 },
  // Minimizado e trilho: para o lado, sobre o conteúdo, com o pé alinhado ao do botão.
  menuAoLado: { left: '100%', marginLeft: espaco(1), bottom: 0, width: 240 },
  cabeca: { paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), borderBottomWidth: 1, marginBottom: espaco(0.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5) },
  rotulo: { fontFamily: fontes.semi, fontSize: 14 },
  separador: { height: 1, marginVertical: espaco(0.5) },
});
