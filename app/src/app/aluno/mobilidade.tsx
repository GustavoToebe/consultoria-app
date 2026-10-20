import { FileDown, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { DatasDaMobilidade } from '../../aluno/DatasDaMobilidade';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import type { ConteudoMobilidadeApi, VersaoDetalhe } from '../../api/tipos';
import { dataCurta, hojeIso } from '../../dominio/formatos';
import { itemParaTela, mobilidadeParaExibir, normalizarMobilidade } from '../../dominio/mobilidade';
import { contagemDoDia, dataInicialDaMobilidade, datasDaMobilidade, feitosDoDia, textoDaContagem } from '../../dominio/mobilidadeFeita';
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
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Mobilidade publicada: nome, prescrição e vídeo, e o aluno marca cada item como feito no dia (sem cronômetro: só feito
 * ou não feito). A marca grava no aparelho na hora e vai para o treinador pela mesma fila das séries, então funciona sem
 * internet. A mobilidade vem do aparelho, que guarda a última vista online. Plano de outra pasta é só consulta.
 */
export default function MobilidadeAluno() {
  const { mobilidade, escolhida } = useAluno();
  const versao = mobilidadeParaExibir(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Mobilidade" />
      <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
      <SeletorPlano rotulo={null} />
      {versao ? <Mobilidade versao={versao} /> : <Vazio titulo="Sem mobilidade" texto={escolhida ? 'Este plano não tem mobilidade publicada.' : 'Seu treinador ainda não publicou a mobilidade.'} />}
    </Tela>
  );
}

function Mobilidade({ versao }: { versao: VersaoDetalhe<ConteudoMobilidadeApi> }) {
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
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(url).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };
  return (
    <>
      {/* O plano em uso e o dia que se marca num cartão só, no topo (o título ficava solto no fim da tela). */}
      <Cartao titulo={versao.titulo} descricao={versao.inicio && versao.fim ? `${dataCurta(versao.inicio)} a ${dataCurta(versao.fim)}` : undefined}>
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
      {c.orientacoes?.trim() ? (
        <Cartao titulo="Orientações">
          <Texto numerico>{c.orientacoes}</Texto>
        </Cartao>
      ) : null}
      {c.secoes.map((secao) => (
        <Cartao key={secao.uid} cabecalho={<CabecalhoDeGrupo titulo={secao.titulo?.trim() || 'Mobilidade'} />}>
          {secao.itens.map((item) => {
            const i = itemParaTela(item);
            const feito = feitos.has(item.uid);
            return (
              <View key={item.uid} style={estilos.linha}>
                <View style={estilos.item}>
                  <Texto numerico style={estilos.nome}>{i.nome}</Texto>
                  <Texto numerico variante="suave">{i.prescricao}</Texto>
                  {i.video ? <Botao rotulo="Ver vídeo" tipo="secundario" Icone={PlayCircle} aoTocar={() => abrirVideo(i.video!)} /> : null}
                </View>
                {podeMarcar && data ? (
                  <BotaoMarcar
                    feito={feito}
                    rotulo={`${i.nome}: ${feito ? 'feito' : 'não feito'} em ${data === hoje ? 'hoje' : dataCurta(data)}`}
                    aoTocar={() => void marcarMobilidade({ planoVersaoId: versao.id, secaoUid: secao.uid, itemUid: item.uid, data, feito: !feito })}
                  />
                ) : null}
              </View>
            );
          })}
        </Cartao>
      ))}
      <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da mobilidade" tipo="secundario" cheio Icone={FileDown} carregando={gerando} aoTocar={() => void pdf()} /></NoPlano>
    </>
  );
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
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  item: { flex: 1, minWidth: 0, gap: 4 },
  nome: { fontFamily: fontes.semi },
});
