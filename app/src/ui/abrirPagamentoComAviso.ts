import { Platform } from 'react-native';

import { abrirPagamento } from './abrirPagamento';
import type { BuscarLinkDePagamento } from './abrirPagamentoTipos';

type Avisar = (mensagem: string, tipo?: 'sucesso' | 'atencao' | 'perigo' | 'neutro') => void;

/**
 * Abre a página de pagamento fora do app (`abrirPagamento`: só https, sem token) e diz à pessoa o que aconteceu. Devolve `true`
 * se abriu; erro da API sobe para quem chamou tratar. A baixa nunca vem daqui: a tela confere a situação ao voltar.
 */
export async function abrirPagamentoComAviso(buscar: BuscarLinkDePagamento, avisar: Avisar, rotulo: string): Promise<boolean> {
  const resultado = await abrirPagamento(buscar);
  if (resultado === 'aberta') {
    avisar(
      Platform.OS === 'web'
        ? 'Abrimos o pagamento em outra aba. Quando terminar, volte para esta.'
        : 'Abrimos o pagamento no navegador. Quando terminar, volte para o app.',
      'neutro',
    );
    return true;
  }
  if (resultado === 'bloqueada') avisar(`O navegador bloqueou a nova aba. Libere os pop-ups deste site e toque em ${rotulo} de novo.`, 'atencao');
  else avisar('Não foi possível abrir o pagamento. Tente de novo ou fale com o seu treinador.', 'perigo');
  return false;
}
