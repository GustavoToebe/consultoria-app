import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { ErroApi } from '../../api/cliente';
import type { ConteudoDieta, VersaoDetalhe } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import {
  listaDeCompras,
  NOTA_DA_LISTA,
  quantidadeParaTela,
  refeicoesComEscolha,
  type EscolhasDeOpcao,
  type LinhaDaLista,
  type PeriodoDaLista,
} from '../../dominio/listaDeCompras';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoListaDeCompras } from '../../pdf/pdfListaDeCompras';
import { espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { NoPlano } from '../../ui/NoPlano';
import { Selo } from '../../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

const PERIODOS: { valor: PeriodoDaLista; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

const COLUNAS: ColunaDaTabela<LinhaDaLista>[] = [
  { chave: 'nome', titulo: 'Alimento', principal: true, flex: 2, render: (l) => <Texto numerico>{l.nome}</Texto> },
  {
    chave: 'quantidade',
    titulo: 'Quantidade',
    alinhar: 'direita',
    render: (l) => (
      <Texto numerico style={estilos.forte}>
        {quantidadeParaTela(l.quantidade, l.unidade)}
        {l.cru ? <Texto variante="suave"> cru</Texto> : null}
      </Texto>
    ),
  },
];

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
  const { avisar } = useAviso();
  const [periodo, setPeriodo] = useState<PeriodoDaLista>('semana');
  const [escolhas, setEscolhas] = useState<EscolhasDeOpcao>({});
  const [gerando, setGerando] = useState(false);
  const conteudo = normalizarDieta(versao.conteudo);
  const comEscolha = refeicoesComEscolha(conteudo);
  const linhas = listaDeCompras(conteudo, escolhas, periodo);
  const opcaoDe = (r: (typeof comEscolha)[number]) => r.opcoes.find((o) => o.uid === escolhas[r.uid]) ?? r.opcoes[0];

  const pdf = async () => {
    if (!pacote) return;
    setGerando(true);
    try {
      const marca = pacote.pacote.marca;
      await imprimir(
        documentoListaDeCompras({
          marca,
          logoDataUri: await logoComoDataUri(marca),
          aluno: pacote.pacote.aluno.nome,
          titulo: versao.titulo,
          versao: versao.numero,
          periodo,
          opcoes: comEscolha.map((r) => `${r.nome || 'Refeição'}: opção ${opcaoDe(r)?.rotulo ?? '—'}`),
          linhas,
          emitidoEm: new Date(),
        }),
      );
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      {salva ? <Selo texto="Sem conexão — usando a última dieta salva" tipo="neutro" /> : null}
      <Texto variante="suave">
        {versao.titulo} (v{versao.numero})
      </Texto>
      <Cartao titulo="Para quanto tempo">
        <Escolha descricao="Período da lista" opcoes={PERIODOS} valor={periodo} aoMudar={setPeriodo} />
        {comEscolha.length ? (
          <View style={estilos.opcoes}>
            <Texto variante="suave">Nas refeições com mais de uma opção, escolha a que vai comprar.</Texto>
            {comEscolha.map((r) => (
              <Escolha
                key={r.uid}
                rotulo={`${r.horario ? `${r.horario} · ` : ''}${r.nome || 'Refeição'}`}
                opcoes={r.opcoes.map((o) => ({ valor: o.uid, rotulo: `Opção ${o.rotulo}` }))}
                valor={opcaoDe(r)?.uid ?? ''}
                aoMudar={(uid) => setEscolhas((atual) => ({ ...atual, [r.uid]: uid }))}
              />
            ))}
          </View>
        ) : null}
      </Cartao>
      <Cartao titulo={periodo === 'semana' ? 'Lista da semana' : 'Lista do mês'}>
        {linhas.length ? (
          <Tabela rotulo="Lista de compras" colunas={COLUNAS} linhas={linhas} chave={(l) => l.chave} />
        ) : (
          <Vazio titulo="Nada para listar" texto="A dieta não tem itens com quantidade." />
        )}
        <Texto variante="suave">{NOTA_DA_LISTA}</Texto>
      </Cartao>
      <NoPlano funcionalidade="PDF">
        <Botao rotulo="Baixar PDF da lista" tipo="secundario" cheio Icone={FileDown} carregando={gerando} desabilitado={!linhas.length} motivo="A lista está vazia." aoTocar={() => void pdf()} />
      </NoPlano>
    </>
  );
}

const estilos = StyleSheet.create({
  forte: { fontFamily: fontes.semi },
  opcoes: { gap: espaco(1.5), paddingTop: espaco(1) },
});
