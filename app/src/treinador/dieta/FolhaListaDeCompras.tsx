import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultoria } from '../../api/rotas';
import type { ConteudoDieta } from '../../api/tipos';
import { contagemDoGrupo } from '../../dominio/gruposDaLista';
import {
  alimentosDaDieta,
  comFatoresDaBiblioteca,
  listaDeCompras,
  NOTA_DA_LISTA_TREINADOR,
  NOTA_DA_PREVIA,
  textoDoPeriodo,
  textosDasOpcoes,
  type EscolhasDeOpcao,
  type PeriodoDaLista,
} from '../../dominio/listaDeCompras';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoListaDeCompras } from '../../pdf/pdfListaDeCompras';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { EscolhaDoPeriodo, ListaDeCompras, OpcoesDaLista, textoDasVariacoes } from '../../ui/ListaDeCompras';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { buscarFatores } from './buscarFatores';
import { DicaDaPrevia } from './DicaDaPrevia';

/**
 * Prévia da lista de compras no editor da dieta (plano do aluno ou modelo do Planejamento), para o treinador conferir
 * antes de publicar. Calcula sobre o conteúdo da tela, mesmo não salvo, com os fatores **atuais** da biblioteca
 * (buscados ao abrir a folha: o rascunho não os guarda); a lista do aluno sai dos fatores copiados na publicação.
 * Folha média (26/11): numa linha, o selo "Prévia" com o ⓘ (as notas da prévia e do cálculo estimado), a contagem e o
 * período; a escolha da opção por refeição logo abaixo, quando há; os grupos em `ui/ListaDeCompras`; no rodapé fixo,
 * "Baixar PDF da lista" à esquerda e "Fechar" à direita. Período e opções são estado da folha, não ficam salvos.
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
  const { avisar } = useAviso();
  const { temFuncionalidade } = useSessao();
  const [periodo, setPeriodo] = useState<PeriodoDaLista>('semana');
  const [escolhas, setEscolhas] = useState<EscolhasDeOpcao>({});
  const [gerando, setGerando] = useState(false);
  const [dicaAberta, setDicaAberta] = useState(false);
  const ids = alimentosDaDieta(conteudo);
  // A folha cobre o editor: o conteúdo não muda enquanto ela está aberta, então a chave só serve para buscar uma vez.
  const fatores = useCarregar(ids.length ? ids.join(',') : null, () => buscarFatores(ids));
  const prontos = ids.length ? fatores.dados : [];
  const base = !fatores.erro && prontos ? comFatoresDaBiblioteca(conteudo, prontos) : null;
  const linhas = base ? listaDeCompras(base, escolhas, periodo) : [];

  const pdf = async () => {
    if (!base) return;
    setGerando(true);
    try {
      const { marca } = await consultoria();
      await imprimir(
        documentoListaDeCompras({
          marca,
          logoDataUri: await logoComoDataUri(marca),
          aluno,
          titulo: titulo.trim() || 'Dieta',
          versao: null,
          periodo,
          opcoes: textosDasOpcoes(base, escolhas),
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

  const motivoDoPdf = fatores.erro ? 'A lista não carregou.' : !base ? 'A lista ainda está carregando.' : 'A lista está vazia.';
  const comPdf = temFuncionalidade('PDF');
  const notas = [NOTA_DA_PREVIA, NOTA_DA_LISTA_TREINADOR, base ? textoDasVariacoes(base) : null].filter(Boolean).join('\n\n');

  return (
    <Folha
      visivel
      titulo="Lista de compras"
      aoFechar={aoFechar}
      largura={LARGURA_FOLHA_LARGA}
      rodape={(
        <LinhaDeAcoes alinhar={comPdf ? 'entre' : 'fim'}>
          {comPdf ? (
            <Botao rotulo="Baixar PDF da lista" tipo="secundario" Icone={FileDown} carregando={gerando} desabilitado={!linhas.length} motivo={motivoDoPdf} aoTocar={() => void pdf()} />
          ) : null}
          <Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} />
        </LinhaDeAcoes>
      )}>
      <View style={[estilos.topo, dicaAberta && estilos.porCima]}>
        {/* O resumo também sobe: o período, que vem depois, pintaria por cima do balão quando desce de linha (celular). */}
        <View style={[estilos.resumo, dicaAberta && estilos.porCima]}>
          {/* O selo se alinha pelo topo (`alignSelf`); a caixa o centra na altura do ⓘ. */}
          <View><Selo texto="Prévia" tipo="atencao" /></View>
          <DicaDaPrevia texto={notas} aoMudar={setDicaAberta} />
          {linhas.length ? <Texto variante="suave" numerico accessibilityLiveRegion="polite">{`${contagemDoGrupo(linhas.length)} · ${textoDoPeriodo(periodo)}`}</Texto> : null}
        </View>
        {/* Lista vazia: o período não muda nada (o vazio diz por quê). */}
        {linhas.length ? <EscolhaDoPeriodo periodo={periodo} aoMudar={setPeriodo} /> : null}
      </View>
      {fatores.erro ? <MensagemErro texto={textoDoErro(fatores.erro)} erro={fatores.erro} tentarDeNovo={fatores.recarregar} /> : null}
      {!fatores.erro && !base ? <Esqueleto /> : null}
      {base ? (
        <>
          <OpcoesDaLista conteudo={base} escolhas={escolhas} aoMudarEscolhas={setEscolhas} />
          <View style={estilos.lista}><ListaDeCompras linhas={linhas} /></View>
        </>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  // Selo, ⓘ e contagem à esquerda, o período à direita; sem espaço (celular, texto grande), o período desce.
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  porCima: { zIndex: 10 },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(0.5) },
  lista: { paddingTop: espaco(1) },
});
