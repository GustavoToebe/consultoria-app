import { linkParaAbrir } from '../dominio/links';
import type { BuscarLinkDePagamento, ResultadoDoPagamento } from './abrirPagamentoTipos';

/**
 * Web: abre o pagamento em outra aba, sem token nem cookie. Tem de ser chamada **dentro do clique**: a aba é aberta na
 * primeira linha, antes de qualquer `await`, senão o navegador bloqueia o pop-up. A aba espera em branco; quando a API
 * devolve o link (só `https`, por `linkParaAbrir`) ela navega para lá. Se a API falhar, a aba é fechada e o erro volta
 * para a tela mostrar.
 *
 * Sem `noopener` (com ele `window.open` devolve `null` e não dá para navegar a aba depois): o `opener` é zerado à mão
 * antes de sair do nosso site, para a página de pagamento não alcançar o app.
 */
export async function abrirPagamento(buscar: BuscarLinkDePagamento): Promise<ResultadoDoPagamento> {
  const aba = window.open('about:blank', '_blank');
  if (!aba) return 'bloqueada';
  try {
    aba.opener = null;
    aba.document.title = 'Pagamento';
    aba.document.body.textContent = 'Abrindo o pagamento...';
  } catch {
    // A aba em branco é nossa; se o navegador não deixar escrever nela, ela só fica vazia até a navegação.
  }
  try {
    const { url } = await buscar();
    const seguro = linkParaAbrir(url);
    if (!seguro) {
      aba.close();
      return 'link-invalido';
    }
    aba.location.href = seguro;
    return 'aberta';
  } catch (erro) {
    aba.close();
    throw erro;
  }
}
