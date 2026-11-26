import { FileDown } from 'lucide-react-native';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { DatasDaMobilidade } from '../../aluno/DatasDaMobilidade';
import { CartaoDaSecaoDaMobilidade, CartaoDasOrientacoesDaMobilidade } from '../../aluno/PecasDaMobilidade';
import { useMarcadoAgora } from '../../aluno/useMarcadoAgora';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import type { ConteudoMobilidadeApi, VersaoDetalhe } from '../../api/tipos';
import { dataCurta, hojeIso } from '../../dominio/formatos';
import { TEXTO_PACOTE_RECUSADO } from '../../dominio/inicioDoAluno';
import { mobilidadeParaExibir, normalizarMobilidade } from '../../dominio/mobilidade';
import { contagemDoDia, dataInicialDaMobilidade, datasDaMobilidade, feitosDoDia, textoDaContagem } from '../../dominio/mobilidadeFeita';
import { tituloDoPlano } from '../../dominio/tituloDoPlano';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoMobilidade } from '../../pdf/pdfMobilidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { BotaoMarcar } from '../../ui/BotaoMarcar';
import { NoPlano } from '../../ui/NoPlano';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { Texto } from '../../ui/Texto';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { colunasDaGradeDoAluno } from '../../dominio/telaLargaDoAluno';

/**
 * Mobilidade publicada: nome, prescrição e vídeo, e o aluno marca cada item como feito no dia (sem cronômetro: só feito
 * ou não feito). A marca grava no aparelho na hora e vai para o treinador pela mesma fila das séries, então funciona sem
 * internet. A mobilidade vem do aparelho, que guarda a última vista online. Plano de outra pasta é só consulta.
 */
export default function MobilidadeAluno() {
  const { mobilidade, escolhida, pacote, pacoteRecusado, carregando, erroPacote, tentarDeNovo } = useAluno();
  const versao = mobilidadeParaExibir(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);
  return (
    <TelaDoAluno bordas={['top']}>
      {(largo) => (<>
      <Cabecalho titulo="Mobilidade" />
      <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
      <SeletorPlano rotulo={null} />
      {!pacote && pacoteRecusado ? <View testID="pacote-recusado"><Alerta tom="atencao" texto={TEXTO_PACOTE_RECUSADO} /></View> : null}
      {!pacote && !pacoteRecusado && carregando ? <Esqueleto texto="Carregando a mobilidade" cartoes={2} /> : null}
      {!pacote && !pacoteRecusado && !carregando && erroPacote ? (
        <MensagemErro texto={`${textoDoErro(erroPacote)} Conecte-se uma vez para baixar a mobilidade; depois ela funciona sem internet.`} erro={erroPacote} tentarDeNovo={() => void tentarDeNovo()} />
      ) : null}
      {versao ? <ConteudoDaMobilidade versao={versao} largo={largo} /> : pacote ? <Vazio titulo="Sem mobilidade" texto={escolhida ? 'Este plano não tem mobilidade publicada.' : 'Seu treinador ainda não publicou a mobilidade.'} /> : null}
      </>)}
    </TelaDoAluno>
  );
}

/**
 * O bloco da mobilidade, usado na aba Treino e no endereço antigo `/aluno/mobilidade`. `largo` (tela larga, 24/11): as seções
 * ganham colunas e o PDF fica do tamanho do texto, em vez de cartões e botão da largura da tela.
 */
export function ConteudoDaMobilidade({ versao, largo = false }: { versao: VersaoDetalhe<ConteudoMobilidadeApi>; largo?: boolean }) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const { temFuncionalidade } = useSessao();
  const { pacote, mobilidade, escolhida, marcasDeMobilidade, marcarMobilidade } = useAluno();
  const [gerando, setGerando] = useState(false);
  const [dataEscolhida, setDataEscolhida] = useState<string | null>(null);
  const c = versao.conteudo;
  const hoje = hojeIso();
  // Marcar só vale na mobilidade vigente: a de outra pasta, ou uma versão que já foi trocada, é só consulta.
  const vigente = !escolhida && versao.id === mobilidade?.id;
  const noPlano = temFuncionalidade('MOBILIDADE');
  const datas = datasDaMobilidade(versao, hoje);
  const data = dataEscolhida && datas.includes(dataEscolhida) ? dataEscolhida : dataInicialDaMobilidade(datas, hoje);
  const podeMarcar = vigente && noPlano && data !== null;
  const feitos = data ? feitosDoDia(marcasDeMobilidade, versao.id, data) : new Set<string>();
  const contagem = contagemDoDia(c, feitos);
  const pdf = async () => {
    if (!pacote) return;
    setGerando(true);
    try {
      const marca = pacote.pacote.marca;
      await imprimir(
        documentoMobilidade({
          marca,
          logoDataUri: await logoComoDataUri(marca),
          aluno: pacote.pacote.aluno.nome,
          titulo: versao.titulo,
          versao: versao.numero,
          conteudo: normalizarMobilidade(c),
          rodapePdf: null,
          emitidoEm: new Date(),
        }),
      );
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };
  const abrirVideo = (url: string) => {
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie; só link https seguro.
    void abrirLinkExterno(url).then((ok) => { if (!ok) avisar('Não foi possível abrir o vídeo.', 'perigo'); });
  };
  // O cartão da seção é o mesmo da prévia ao vivo do editor do treinador (`aluno/PecasDaMobilidade`).
  const secoes = c.secoes.map((secao) => (
    <CartaoDaSecaoDaMobilidade key={secao.uid} secao={secao} aoVerVideo={abrirVideo}
      marcar={podeMarcar && data ? (item) => {
        const feito = feitos.has(item.uid);
        return (
          <MarcarItem
            key={data}
            feito={feito}
            rotulo={`${item.nome}: ${feito ? 'feito' : 'não feito'} em ${data === hoje ? 'hoje' : dataCurta(data)}`}
            aoTocar={() => void marcarMobilidade({ planoVersaoId: versao.id, secaoUid: secao.uid, itemUid: item.uid, data, feito: !feito })}
          />
        );
      } : undefined} />
  ));
  return (
    <>
      {/* O plano em uso e o dia que se marca num cartão só, no topo (o título ficava solto no fim da tela). */}
      <Cartao titulo={tituloDoPlano(versao.titulo, 'mobilidade', pacote?.pacote.aluno.nome)} descricao={versao.inicio && versao.fim ? `${dataCurta(versao.inicio)} a ${dataCurta(versao.fim)}` : undefined}>
        {podeMarcar && data ? (
          <>
            <Texto numerico style={estilos.contagem} accessibilityLiveRegion="polite">
              {textoDaContagem(contagem, data === hoje, dataCurta(data))}
            </Texto>
            <DatasDaMobilidade
              datas={datas}
              hoje={hoje}
              atual={data}
              comAlgoFeito={(d) => feitosDoDia(marcasDeMobilidade, versao.id, d).size > 0}
              aoAbrir={setDataEscolhida}
            />
          </>
        ) : (
          <Texto variante="suave" cor={cores.textoSuave}>{semMarcar(vigente, noPlano, datas.length > 0)}</Texto>
        )}
      </Cartao>
      <CartaoDasOrientacoesDaMobilidade texto={c.orientacoes} />
      {largo ? (
        <Grade gap={espaco(2)} alinhar="inicio" colunas={(l) => colunasDaGradeDoAluno(l, c.secoes.length, espaco(2))}>{secoes}</Grade>
      ) : secoes}
      <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da mobilidade" tipo="secundario" cheio={!largo} Icone={FileDown} carregando={gerando} aoTocar={() => void pdf()} /></NoPlano>
    </>
  );
}

/** ✓ do item: verde só no marcado agora; a chave pela data faz trocar de dia não acender o que já estava feito. */
function MarcarItem(p: Omit<ComponentProps<typeof BotaoMarcar>, 'agora'>) {
  const agora = useMarcadoAgora(p.feito);
  return <BotaoMarcar {...p} agora={agora} />;
}

/** Por que a tela não oferece marcar (o aluno vê o conteúdo, mas sem os botões). */
function semMarcar(vigente: boolean, noPlano: boolean, temDatas: boolean): string {
  if (!vigente) return 'Este plano é só para consulta: marcar como feito vale na mobilidade em uso.';
  if (!noPlano) return 'A marcação da mobilidade não está disponível agora: dá para ver, mas não para marcar como feito. Fale com o seu treinador.';
  if (!temDatas) return 'Fora do período desta mobilidade: não há dia para marcar.';
  return '';
}

const estilos = StyleSheet.create({
  contagem: { fontFamily: fontes.semi, fontSize: 16 },
});
