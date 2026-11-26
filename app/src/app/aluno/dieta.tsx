import type { ReactNode } from 'react';

import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { DietaDoAluno } from '../../aluno/DietaDoAluno';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { ErroApi } from '../../api/cliente';
import { pesosAluno } from '../../api/rotas';
import type { ConteudoDieta, VersaoDetalhe } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoDieta, type DadosPdfDieta } from '../../pdf/pdfDieta';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';

/**
 * Dieta publicada (só leitura). Busca online; sem conexão mostra a última vista neste aparelho, avisando que pode
 * estar desatualizada.
 */
export default function DietaAluno() {
  const { escolhida } = useAluno();
  const { dados, erro, carregando, recarregar } = useDietaDoAluno();
  // A água marcada é por dia, contra a meta da dieta em uso (a pasta escolhida para consulta não muda o registro).
  const agua = dados?.dieta?.conteudo.aguaLitros ? <CartaoAguaDoDia metaLitros={dados.dieta.conteudo.aguaLitros} /> : null;
  // Com a dieta na tela, a água vai com ela (`lado`: no apoio ao lado das refeições, ou no topo no celular); sem dieta, fica aqui.
  const temDieta = escolhida ? !!escolhida.planos.dieta : !!dados?.dieta;

  return (
    <TelaDoAluno bordas={['top']}>
      <Cabecalho titulo="Dieta" />
      <Texto variante="suave">A dieta que o seu treinador publicou, só para consulta.</Texto>
      <SeletorPlano rotulo={null} />
      {temDieta ? null : agua}
      {escolhida ? (
        escolhida.planos.dieta ? (
          <Dieta versao={escolhida.planos.dieta} salva={false} aguaNoCartao={!!dados?.dieta?.conteudo.aguaLitros && dados.dieta.id === escolhida.planos.dieta.id}
            lado={agua} />
        ) : (
          <Vazio titulo="Sem dieta neste plano" texto="Este plano só tem treino publicado." />
        )
      ) : null}
      {escolhida ? null : erro ? (
        <MensagemErro
          texto={erro instanceof ErroApi && erro.semConexao ? 'Sem conexão e a dieta ainda não foi aberta neste aparelho.' : textoDoErro(erro)}
          tentarDeNovo={recarregar}
        />
      ) : null}
      {escolhida ? null : !dados && carregando ? <Esqueleto /> : null}
      {escolhida ? null : dados && !dados.dieta ? <Vazio titulo="Sem plano de dieta" texto="Seu treinador ainda não publicou a dieta." /> : null}
      {!escolhida && dados?.dieta ? <Dieta versao={dados.dieta} salva={dados.salva} aguaNoCartao={!!dados.dieta.conteudo.aguaLitros} lado={agua} /> : null}
    </TelaDoAluno>
  );
}

/** A dieta do aluno com o PDF montado pelo pacote (marca e nome do aluno) e o peso dele, que só o servidor tem. */
function Dieta({ versao, salva, aguaNoCartao, lado }: { versao: VersaoDetalhe<ConteudoDieta>; salva: boolean; aguaNoCartao: boolean; lado: ReactNode }) {
  const { pacote } = useAluno();
  const pdf = async (lista?: DadosPdfDieta['lista'], variacaoUid: string | null = null) => {
    if (!pacote) return;
    const marca = pacote.pacote.marca;
    // Sem internet o PDF sai sem o acompanhamento de peso (que vem do servidor).
    const pesos = await pesosAluno().catch(() => []);
    await imprimir(
      documentoDieta({
        marca,
        logoDataUri: await logoComoDataUri(marca),
        aluno: pacote.pacote.aluno.nome,
        titulo: versao.titulo,
        versao: versao.numero,
        conteudo: normalizarDieta(versao.conteudo),
        variacaoUid,
        pesos,
        rodapePdf: null,
        emitidoEm: new Date(),
        lista,
      }),
    );
  };
  return <DietaDoAluno versao={versao} salva={salva} aguaNoCartao={aguaNoCartao} aoBaixarPdf={pdf} largo lado={lado} />;
}
