import type { Href } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { buscarCartoes, cartoesVisiveis, gruposDeCartoes } from '../../dominio/configuracoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { iconeDaConfiguracao } from './icones';

/** Duas colunas a partir de 760 px de conteúdo (a regra da `Grade`), nunca três: o hub é um índice de leitura. */
const ATE_DUAS_COLUNAS = (largura: number) => (largura >= 760 ? 2 : 1);

const textoDoResultado = (n: number) => (n === 1 ? '1 configuração encontrada' : `${n} configurações encontradas`);

/**
 * Hub de Configurações (`docs/planos/configuracoes-centralizadas.md`, passo 2): um índice. Busca no topo e um cartão por
 * grupo, com os atalhos (`ItemDeLista`: ícone neutro, título, descrição e seta; a linha inteira é o link) para as telas e
 * abas que já existem. Só aparece o que o perfil pode abrir (`cartoesVisiveis`, a mesma regra do menu e da guarda); tudo
 * vem da sessão, então não há carregando nem erro e a tela abre sem internet. Sem botão principal: nada aqui é ação.
 */
export function TelaConfiguracoes() {
  const { pode, perfilEquipe, pagamentosHabilitados, funcionalidadesDoPlano, recebimentoOnlineHabilitado, whatsappHabilitado } = useSessao();
  const [busca, setBusca] = useState('');
  const campo = useRef<TextInput>(null);
  const administrador = !!perfilEquipe?.acessoTotal;
  const visiveis = useMemo(
    () => cartoesVisiveis({ pode, administrador, pagamentosHabilitados, liberadas: funcionalidadesDoPlano, chaves: { recebimentoOnlineHabilitado, whatsappHabilitado } }),
    [pode, administrador, pagamentosHabilitados, funcionalidadesDoPlano, recebimentoOnlineHabilitado, whatsappHabilitado],
  );
  const achados = buscarCartoes(busca, visiveis);
  const grupos = gruposDeCartoes(achados);
  const buscando = busca.trim().length > 0;
  const limpar = () => {
    setBusca('');
    campo.current?.focus();
  };

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Configurações" subtitulo="Sua conta, a consultoria, a equipe e o atendimento, num lugar só." />
      <View style={estilos.busca}>
        <Campo ref={campo} rotulo="Pesquisar configuração" valor={busca} aoMudar={setBusca} placeholder="Ex.: senha, logo, lembrete…"
          inputMode="search" autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" enterKeyHint="search" />
        {/* O número de resultados é anunciado enquanto a pessoa digita, sem tirar o foco do campo. */}
        <View accessibilityLiveRegion="polite" aria-live="polite">
          {buscando ? <Texto variante="suave" numerico>{textoDoResultado(achados.length)}</Texto> : null}
        </View>
      </View>
      {grupos.length === 0 ? (
        <Vazio Icone={SearchX} titulo="Nenhuma configuração encontrada" nivel={2}
          texto="Tente outra palavra ou um sinônimo, como “senha”, “logo” ou “cobrança”."
          acao={{ rotulo: 'Limpar busca', aoTocar: limpar }} />
      ) : (
        <Grade gap={espaco(3)} colunas={ATE_DUAS_COLUNAS}>
          {grupos.map(({ grupo, cartoes }) => (
            <Cartao key={grupo} titulo={grupo} style={estilos.cartao}>
              <View style={estilos.lista}>
                {cartoes.map((c) => (
                  <ItemDeLista key={c.id} titulo={c.titulo} detalhe={c.descricao} Icone={iconeDaConfiguracao(c.id)} href={c.href as Href} />
                ))}
              </View>
            </Cartao>
          ))}
        </Grade>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  busca: { gap: espaco(1), maxWidth: 640, width: '100%' },
  // Esticado pela grade (os dois cartões de uma linha ficam da mesma altura).
  cartao: { flexGrow: 1 },
  lista: { gap: espaco(1) },
});
