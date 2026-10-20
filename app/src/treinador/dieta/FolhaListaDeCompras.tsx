import { consultoria, fatoresDosAlimentos } from '../../api/rotas';
import type { ConteudoDieta, FatoresDoAlimento } from '../../api/tipos';
import { alimentosDaDieta, comFatoresDaBiblioteca, NOTA_DA_PREVIA } from '../../dominio/listaDeCompras';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoListaDeCompras } from '../../pdf/pdfListaDeCompras';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { ListaDeCompras, type EscolhaDaLista } from '../../ui/ListaDeCompras';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Mesmo teto da rota `GET /alimentos/fatores`. */
const IDS_POR_PEDIDO = 200;

/** Fatores atuais dos alimentos, em pedidos de até 200 ids (uma dieta de verdade cabe em um). */
async function buscarFatores(ids: string[]): Promise<FatoresDoAlimento[]> {
  const partes: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_POR_PEDIDO) partes.push(ids.slice(i, i + IDS_POR_PEDIDO));
  return (await Promise.all(partes.map(fatoresDosAlimentos))).flat();
}

/**
 * Prévia da lista de compras no editor da dieta (plano do aluno ou modelo do Planejamento), para o treinador conferir
 * antes de publicar. Calcula sobre o conteúdo da tela, mesmo não salvo, com os fatores **atuais** da biblioteca
 * (buscados ao abrir a folha: o rascunho não os guarda); a lista do aluno sai dos fatores copiados na publicação.
 */
export function FolhaListaDeCompras({
  conteudo,
  titulo,
  aluno,
  aoFechar,
}: {
  conteudo: ConteudoDieta;
  /** Título do plano ou do modelo, para o PDF. */
  titulo: string;
  /** Nome do aluno no plano; nulo no modelo (ou ainda carregando). */
  aluno: string | null;
  aoFechar: () => void;
}) {
  const ids = alimentosDaDieta(conteudo);
  // A folha cobre o editor: o conteúdo não muda enquanto ela está aberta, então a chave só serve para buscar uma vez.
  const fatores = useCarregar(ids.length ? ids.join(',') : null, () => buscarFatores(ids));
  const prontos = ids.length ? fatores.dados : [];

  const pdf = async ({ periodo, opcoes, linhas }: EscolhaDaLista) => {
    const { marca } = await consultoria();
    await imprimir(
      documentoListaDeCompras({
        marca,
        logoDataUri: await logoComoDataUri(marca),
        aluno,
        titulo: titulo.trim() || 'Dieta',
        versao: null,
        periodo,
        opcoes,
        linhas,
        emitidoEm: new Date(),
      }),
    );
  };

  return (
    <Folha visivel titulo="Lista de compras" aoFechar={aoFechar}>
      <Selo texto="Prévia" tipo="atencao" />
      <Texto variante="suave">{NOTA_DA_PREVIA}</Texto>
      {fatores.erro ? <MensagemErro texto={textoDoErro(fatores.erro)} erro={fatores.erro} tentarDeNovo={fatores.recarregar} /> : null}
      {!fatores.erro && !prontos ? <Esqueleto /> : null}
      {!fatores.erro && prontos ? <ListaDeCompras papel="treinador" conteudo={comFatoresDaBiblioteca(conteudo, prontos)} aoGerarPdf={pdf} /> : null}
    </Folha>
  );
}
