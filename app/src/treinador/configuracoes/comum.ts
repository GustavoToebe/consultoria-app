import { useWindowDimensions } from 'react-native';

import { cartoesVisiveis } from '../../dominio/configuracoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { LARGURA_FAIXA_NORMAL } from '../../tema/tokens';

/**
 * Configurações em duas colunas (lista à esquerda, item à direita) a partir da faixa normal medida pela JANELA, não pela área
 * (exceção à 4.10): com o menu aberto, 1280 de janela dá ~1040 de área, ainda `compacta`, e o pedido é duas colunas já em
 * 1280. 1024 é também onde o menu lateral fica completo. O layout, o índice e o item leem daqui, para nunca discordarem.
 */
export function useDuasColunas(): boolean {
  return useWindowDimensions().width >= LARGURA_FAIXA_NORMAL;
}

/** Cartões que o perfil vê (a mesma regra do menu e da guarda; tudo vem da sessão, sem carregar nada). */
export function useCartoesDoPerfil() {
  const { pode, perfilEquipe, pagamentosHabilitados, funcionalidadesDoPlano, recebimentoOnlineHabilitado, overtrainingPayHabilitado, whatsappHabilitado, contratosHabilitados, regrasAtencaoHabilitada } = useSessao();
  const administrador = !!perfilEquipe?.acessoTotal;
  return cartoesVisiveis({ pode, administrador, pagamentosHabilitados, liberadas: funcionalidadesDoPlano, chaves: { recebimentoOnlineHabilitado, overtrainingPayHabilitado, whatsappHabilitado, contratosHabilitados, regrasAtencaoHabilitada } });
}

export const textoDoResultado = (n: number) => (n === 1 ? '1 configuração encontrada' : `${n} configurações encontradas`);
export const nadaEncontrado = (termo: string) => `Nada encontrado para “${termo.trim()}”`;
