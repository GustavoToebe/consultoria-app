import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { ErroApi } from '../../api/cliente';
import type { ConteudoDieta, VersaoDetalhe } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoListaDeCompras } from '../../pdf/pdfListaDeCompras';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { ListaDeCompras, type EscolhaDaLista } from '../../ui/ListaDeCompras';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Lista de compras da dieta que o aluno está vendo (a do plano escolhido no topo da Dieta, ou a vigente), calculada no
 * aparelho com os fatores que a versão publicada já traz: funciona sem internet com a dieta salva. Período e opções
 * são escolhas da tela, não ficam salvas.
 */
export default function ListaDeComprasAluno() {
  const { escolhida } = useAluno();
  const { dados, erro, carregando, recarregar } = useDietaDoAluno();
  const versao = escolhida ? escolhida.planos.dieta : dados?.dieta;
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Lista de compras" voltar="/aluno/dieta" />
      {!escolhida && erro && !dados ? (
        <MensagemErro
          texto={erro instanceof ErroApi && erro.semConexao ? 'Sem conexão e a dieta ainda não foi aberta neste aparelho.' : textoDoErro(erro)}
          tentarDeNovo={recarregar}
        />
      ) : null}
      {!escolhida && !dados && carregando ? <Esqueleto /> : null}
      {(escolhida || dados) && !versao ? <Vazio titulo="Sem dieta" texto="Seu treinador ainda não publicou a dieta deste plano." /> : null}
      {versao ? <Lista versao={versao} salva={!escolhida && !!dados?.salva} /> : null}
    </Tela>
  );
}

function Lista({ versao, salva }: { versao: VersaoDetalhe<ConteudoDieta>; salva: boolean }) {
  const { pacote } = useAluno();
  const pdf = async ({ periodo, opcoes, linhas }: EscolhaDaLista) => {
    if (!pacote) return;
    const marca = pacote.pacote.marca;
    await imprimir(
      documentoListaDeCompras({
        marca,
        logoDataUri: await logoComoDataUri(marca),
        aluno: pacote.pacote.aluno.nome,
        titulo: versao.titulo,
        versao: versao.numero,
        periodo,
        opcoes,
        linhas,
        emitidoEm: new Date(),
      }),
    );
  };

  return (
    <>
      {salva ? <Selo texto="Sem conexão — usando a última dieta salva" tipo="neutro" /> : null}
      <Texto variante="suave">
        {versao.titulo} (v{versao.numero})
      </Texto>
      <ListaDeCompras conteudo={normalizarDieta(versao.conteudo)} aoGerarPdf={pdf} />
    </>
  );
}
