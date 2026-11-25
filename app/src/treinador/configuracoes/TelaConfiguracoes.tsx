import type { Href } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { colunasDoHub } from '../../dominio/colunasPorCelula';
import { buscarCartoes, cartoesVisiveis, gruposDeCartoes } from '../../dominio/configuracoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Alvenaria } from '../../ui/Alvenaria';
import { iconeDaConfiguracao } from './icones';

const textoDoResultado = (n: number) => (n === 1 ? '1 configuração encontrada' : `${n} configurações encontradas`);
const VAO = espaco(3);

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

  // Na largura toda do conteúdo da Tela (a mesma de Financeiro e Vitrine, que respeita "Largura do conteúdo").
  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Configurações" descricao="Sua conta, a consultoria, a equipe e o atendimento, num lugar só." />
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
        <GruposEmAlvenaria grupos={grupos} gruposDoPerfil={gruposDeCartoes(visiveis).length} />
      )}
    </Tela>
  );
}

/**
 * Alvenaria (24/11): colunas de pelo menos 360 px até o teto da faixa (1 no celular, 2, 3 na larga, 4 na ultralarga),
 * contadas pelos grupos do perfil, não pelos da busca, para as colunas não mudarem de largura enquanto a pessoa digita.
 * Fica dentro da `Tela` porque a faixa é a que ela mede (`useFaixaDaTela`, antes do recuo lateral).
 */
function GruposEmAlvenaria({ grupos, gruposDoPerfil }: { grupos: ReturnType<typeof gruposDeCartoes>; gruposDoPerfil: number }) {
  const faixa = useFaixaDaTela();
  return (
    <Alvenaria colunas={(largura) => colunasDoHub(largura, faixa, VAO, gruposDoPerfil)} vao={VAO} pecas={grupos.map(({ grupo, cartoes }) => ({
      chave: grupo,
      // Estimativa da altura: um por item e um do título.
      peso: cartoes.length + 1,
      conteudo: (
        <Cartao titulo={grupo}>
          <View style={estilos.lista}>
            {cartoes.map((c) => (
              <ItemDeLista key={c.id} titulo={c.titulo} detalhe={c.descricao} Icone={iconeDaConfiguracao(c.id)} href={c.href as Href} />
            ))}
          </View>
        </Cartao>
      ),
    }))} />
  );
}

const estilos = StyleSheet.create({
  busca: { gap: espaco(1), maxWidth: 640, width: '100%' },
  lista: { gap: espaco(1) },
});
