import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useState } from 'react';

import { ErroApi, urlDaApi } from '../api/cliente';
import {
  baixarFotoDaAnamnese,
  baixarFotoDoAluno,
  baixarFotoDoTreinador,
  fotosDoAluno,
  gerarComparacao,
  linhaDoTempoDeFotos,
} from '../api/rotas';
import type { FotoDaLinha } from '../api/tipos';
import {
  ALTURA_FEED,
  ALTURA_STORIES,
  LARGURA_IMAGEM,
  MAXIMO_DATAS,
  MINIMO_DATAS,
  colunasNaTela,
  comparacaoEmZip,
  datasDaPosicao,
  formatoDaPrevia,
  fotoEmUso,
  fotosDaData,
  nomeDaComparacao,
  paresNaOrdem,
  posicoesDe,
  type ImagemDaComparacao,
  primeiraEUltima,
  proximaFoto,
  rotuloDaData,
  textoDaDiferenca,
  type FormatoComparacao,
  type PedidoDeComparacao,
} from '../dominio/comparacaoDeFotos';
import { dataParaTela, numeroParaTela, SEM_DADO } from '../dominio/formatos';
import { alternarComLimite } from '../dominio/selecaoMultipla';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { Botao } from '../ui/Botao';
import { Interruptor } from '../ui/Campos';
import { Escolha } from '../ui/Escolha';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { baixarComparacao } from './baixarComparacao';

const AVISO_AUTORIZACAO = 'O aluno ainda não autorizou o uso das fotos. Ele autoriza em Conta › Uso das suas fotos.';

/**
 * Fotos do aluno: lista e comparação. Na ficha do treinador também gera a imagem.
 * No Histórico do aluno é o mesmo cartão, sem "Gerar imagem".
 */
export function CartaoFotos({ alunoId, autorizadoEm, aoRecarregar }: {
  alunoId?: string;
  autorizadoEm?: string | null;
  aoRecarregar?: () => void;
}) {
  const doAluno = !alunoId;
  const { dados, erro, carregando, recarregar } = useCarregar(
    doAluno ? 'fotos:aluno' : `fotos:${alunoId}`,
    () => (doAluno ? linhaDoTempoDeFotos() : fotosDoAluno(alunoId)),
  );
  const baixar = (foto: FotoDaLinha) => {
    if (doAluno) return baixarFotoDoAluno(foto.fotoId);
    return foto.origem === 'ANAMNESE'
      ? baixarFotoDaAnamnese(foto.origemId, foto.fotoId)
      : baixarFotoDoTreinador(foto.origemId, foto.fotoId);
  };
  return (
    <Cartao titulo="Fotos" descricao="Fotos enviadas na anamnese e nas atualizações.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhuma foto enviada ainda.</Texto> : null}
      {dados && dados.length > 0 ? (
        <Corpo
          fotos={dados}
          baixar={baixar}
          gerar={alunoId ? (pedido) => gerarComparacao(alunoId, pedido) : undefined}
          autorizadoEm={autorizadoEm ?? null}
          aoRecarregar={aoRecarregar}
        />
      ) : null}
    </Cartao>
  );
}

function Corpo({ fotos, baixar, gerar, autorizadoEm, aoRecarregar }: {
  fotos: FotoDaLinha[];
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  gerar?: (pedido: PedidoDeComparacao) => Promise<Blob>;
  autorizadoEm: string | null;
  aoRecarregar?: () => void;
}) {
  const { width } = useWindowDimensions();
  const estreita = width < LARGURA_MENU_LATERAL;
  const [visao, setVisao] = useState<'lista' | 'comparar'>('lista');
  const [posicaoEscolhida, setPosicaoEscolhida] = useState<string | null>(null);
  const [datasMarcadas, setDatasMarcadas] = useState<Set<string>>(new Set());
  const [posicaoDasDatas, setPosicaoDasDatas] = useState<string | null>(null);
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  const [ampliada, setAmpliada] = useState<FotoDaLinha | null>(null);
  const [folha, setFolha] = useState<'imagem' | 'carrossel' | null>(null);
  const grupos = posicoesDe(fotos);
  const grupo = grupos.find((g) => g.chave === posicaoEscolhida) ?? grupos[0];
  if (grupo && grupo.chave !== posicaoDasDatas) {
    setPosicaoDasDatas(grupo.chave);
    setDatasMarcadas(new Set());
    setTrocas({});
  }
  const datas = grupo ? datasDaPosicao(grupo.fotos) : [];
  const marcadas = datas.filter((d) => datasMarcadas.has(d));
  const escolhidas = marcadas
    .map((data) => (grupo ? fotoEmUso(grupo.fotos, data, trocas[data]) : undefined))
    .filter((f): f is FotoDaLinha => !!f);
  const pontas = escolhidas.length >= MINIMO_DATAS ? textoDaDiferenca(escolhidas[0], escolhidas[escolhidas.length - 1]) : null;
  const colunas = colunasNaTela(escolhidas.length);
  const carrossel = grupo && marcadas.length === 2 ? paresNaOrdem(grupo.fotos, marcadas[0], marcadas[1]) : [];
  const imagensDaFolha: ImagemDaComparacao[] = folha === 'carrossel'
    ? carrossel
    : (folha === 'imagem' && escolhidas.length >= MINIMO_DATAS
      ? [{ chave: 'tela', rotulo: grupo?.rotulo ?? 'Comparação', fotos: escolhidas }]
      : []);

  const alternarData = (data: string) => {
    const { marcados } = alternarComLimite(datasMarcadas, data, !datasMarcadas.has(data), MAXIMO_DATAS);
    setDatasMarcadas(marcados);
  };

  return (
    <View style={estilos.corpo}>
      <Abas
        abas={[{ valor: 'lista', rotulo: 'Lista' }, { valor: 'comparar', rotulo: 'Comparar' }]}
        ativa={visao}
        aoMudar={setVisao}
      />
      {visao === 'lista' ? <Lista fotos={fotos} baixar={baixar} aoAbrir={setAmpliada} /> : null}
      {visao === 'comparar' && grupo ? (
        <View style={estilos.corpo}>
          <View style={estilos.chips} accessibilityRole="radiogroup">
            {grupos.map((g) => (
              <Chip key={g.chave} rotulo={g.rotulo} marcado={g.chave === grupo.chave} aoTocar={() => setPosicaoEscolhida(g.chave)} />
            ))}
          </View>
          <View style={estilos.chips}>
            {datas.map((data) => (
              <Chip
                key={data}
                rotulo={rotuloDaData(grupo.fotos, data)}
                marcado={datasMarcadas.has(data)}
                aoTocar={() => alternarData(data)}
              />
            ))}
          </View>
          <Botao
            rotulo="Primeira × última"
            tipo="secundario"
            aoTocar={() => setDatasMarcadas(new Set(primeiraEUltima(datas)))}
          />
          {escolhidas.length >= MINIMO_DATAS ? (
            <View style={[estilos.grade, estilos.fileira]} accessibilityLabel="Prévia da comparação">
              {escolhidas.map((foto) => {
                const varias = fotosDaData(grupo.fotos, foto.data).length > 1;
                return (
                  <View key={foto.fotoId} style={[estilos.celula, { maxWidth: `${Math.floor(100 / colunas)}%` }]}>
                    <ImagemProtegida
                      chave={`comparar:${foto.fotoId}`}
                      carregar={() => baixar(foto)}
                      descricao={`${foto.posicao} ${rotuloDaData(grupo.fotos, foto.data)}`}
                      tamanho={400}
                      altura={estreita ? 175 : 225}
                      aoTocar={varias ? () => setTrocas((atual) => ({ ...atual, [foto.data]: proximaFoto(grupo.fotos, foto.data, foto.fotoId) })) : undefined}
                    />
                    <Texto numerico variante="pequeno">{rotuloDaData(grupo.fotos, foto.data)}</Texto>
                    <Texto numerico variante="pequeno">{foto.pesoKg == null ? SEM_DADO : `${numeroParaTela(foto.pesoKg)} kg`}</Texto>
                  </View>
                );
              })}
            </View>
          ) : (
            <Texto variante="suave">Escolha de 2 a 4 datas.</Texto>
          )}
          {pontas ? <Texto numerico>{pontas}</Texto> : null}
          {gerar ? (
            <View style={estilos.chips}>
              <Botao
                rotulo="Gerar imagem"
                tipo="secundario"
                desabilitado={escolhidas.length < MINIMO_DATAS}
                aoTocar={() => setFolha('imagem')}
              />
              {carrossel.length >= 2 ? (
                <Botao rotulo="Gerar carrossel" tipo="secundario" aoTocar={() => setFolha('carrossel')} />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      <Folha titulo="Foto" visivel={ampliada !== null} aoFechar={() => setAmpliada(null)} largura={LARGURA_EDITOR}>
        {ampliada ? (
          <ImagemProtegida chave={`grande:${ampliada.fotoId}`} carregar={() => baixar(ampliada)} descricao={ampliada.posicao} tamanho={360} altura={450} />
        ) : null}
      </Folha>
      {gerar ? (
        <Folha titulo={folha === 'carrossel' ? 'Gerar carrossel' : 'Gerar imagem'} visivel={folha !== null} aoFechar={() => setFolha(null)} largura={LARGURA_EDITOR}>
          {folha ? (
            <FolhaGerar
              imagens={imagensDaFolha}
              baixar={baixar}
              gerar={gerar}
              autorizadoEm={autorizadoEm}
              aoFechar={() => setFolha(null)}
              aoRecarregar={aoRecarregar}
            />
          ) : null}
        </Folha>
      ) : null}
    </View>
  );
}

function Lista({ fotos, baixar, aoAbrir }: {
  fotos: FotoDaLinha[];
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  aoAbrir: (foto: FotoDaLinha) => void;
}) {
  const envios = new Map<string, FotoDaLinha[]>();
  for (const foto of [...fotos].sort((a, b) => b.data.localeCompare(a.data) || a.ordem - b.ordem)) {
    const chave = `${foto.origem}:${foto.origemId}`;
    const lista = envios.get(chave) ?? [];
    lista.push(foto);
    envios.set(chave, lista);
  }
  return (
    <View style={estilos.corpo}>
      {[...envios.values()].map((grupo) => {
        const primeiro = grupo[0];
        return (
          <View key={`${primeiro.origem}:${primeiro.origemId}`} style={estilos.envio}>
            <Texto numerico>
              {dataParaTela(primeiro.data)} · {primeiro.origem === 'ANAMNESE' ? 'Anamnese' : 'Atualização'} · {primeiro.pesoKg == null ? SEM_DADO : `${numeroParaTela(primeiro.pesoKg)} kg`}
            </Texto>
            <View style={estilos.chips}>
              {grupo.map((foto) => (
                <ImagemProtegida
                  key={foto.fotoId}
                  chave={`lista:${foto.fotoId}`}
                  carregar={() => baixar(foto)}
                  descricao={foto.posicao}
                  tamanho={72}
                  aoTocar={() => aoAbrir(foto)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Chip({ rotulo, marcado, aoTocar }: { rotulo: string; marcado: boolean; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: marcado }}
      aria-selected={marcado}
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={[estilos.chip, { borderColor: marcado ? cores.texto : cores.borda, backgroundColor: marcado ? cores.superficie2 : cores.superficie }]}
    >
      <Texto>{rotulo}</Texto>
    </Pressable>
  );
}

function FolhaGerar({ imagens, baixar, gerar, autorizadoEm, aoFechar, aoRecarregar }: {
  imagens: ImagemDaComparacao[];
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  gerar: (pedido: PedidoDeComparacao) => Promise<Blob>;
  autorizadoEm: string | null;
  aoFechar: () => void;
  aoRecarregar?: () => void;
}) {
  const { preferencias, escolherPreferencia } = useTema();
  const { marca } = useSessao();
  const { cores } = useTema();
  const temLogo = !!marca?.logoUrl;
  const [formato, setFormato] = useState<FormatoComparacao>('STORIES');
  const [comLogo, setComLogo] = useState(preferencias.logoNaComparacao && temLogo);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [recusado, setRecusado] = useState(false);
  const autorizado = !recusado && !!autorizadoEm;
  const grupos = imagens.map((imagem) => ({ fotoIds: imagem.fotos.map((foto) => foto.fotoId) }));
  const zip = comparacaoEmZip(formato, grupos.length);
  const visual = formatoDaPrevia(formato);
  const alturaCheia = visual === 'FEED' ? ALTURA_FEED : ALTURA_STORIES;
  const alturaPrevia = imagens.length > 1 ? 220 : 460;
  const larguraPrevia = Math.max(1, Math.round((alturaPrevia * LARGURA_IMAGEM) / alturaCheia));
  const quantidade = Math.max(2, ...imagens.map((imagem) => imagem.fotos.length));
  const tile = Math.max(1, Math.floor((larguraPrevia - 4 * (quantidade - 1)) / quantidade));

  const mudarLogo = (ligada: boolean) => {
    if (!temLogo) return;
    setComLogo(ligada);
    escolherPreferencia({ logoNaComparacao: ligada });
  };

  const baixarImagem = () => {
    setBaixando(true);
    setErro(null);
    const pedido: PedidoDeComparacao = { formato, comLogo: comLogo && temLogo, imagens: grupos };
    gerar(pedido).then(
      async (blob) => {
        await baixarComparacao(blob, nomeDaComparacao(formato, grupos.length));
        setBaixando(false);
        aoFechar();
      },
      (e: unknown) => {
        setBaixando(false);
        if (e instanceof ErroApi && e.codigo === 'USO_DE_IMAGEM_NAO_AUTORIZADO') {
          setRecusado(true);
          aoRecarregar?.();
          return;
        }
        setErro(e);
      },
    );
  };

  const rotuloBaixar = Platform.OS === 'web'
    ? (zip ? 'Baixar zip' : 'Baixar imagem')
    : (zip ? 'Compartilhar zip' : 'Compartilhar imagem');

  return (
    <View style={estilos.corpo}>
      {imagens.map((imagem) => (
        <View key={imagem.chave} style={estilos.corpo}>
          <Texto variante="rotulo">{imagem.rotulo}</Texto>
          <View style={[estilos.previa, { width: larguraPrevia, height: alturaPrevia, backgroundColor: '#000' }]}>
            <View accessibilityLabel="Prévia da imagem" style={[estilos.grade, estilos.fileira, { gap: 4, height: '100%' }]}>
              {imagem.fotos.map((foto) => (
                <ImagemProtegida
                  key={foto.fotoId}
                  chave={`gerar:${imagem.chave}:${foto.fotoId}`}
                  carregar={() => baixar(foto)}
                  descricao={imagem.rotulo}
                  tamanho={tile}
                  altura={alturaPrevia}
                />
              ))}
            </View>
            {comLogo && temLogo && marca?.logoUrl ? (
              <View style={estilos.logo} pointerEvents="none">
                <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={estilos.logoImagem} contentFit="contain" accessibilityLabel="Logo da consultoria" />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {formato === 'AMBOS' ? <Texto variante="suave">O Feed retrato sai junto, na pasta Feed.</Texto> : null}
      <Escolha
        rotulo="Formato"
        valor={formato}
        aoMudar={setFormato}
        opcoes={[
          { valor: 'STORIES', rotulo: 'Stories' },
          { valor: 'FEED', rotulo: 'Feed retrato' },
          { valor: 'AMBOS', rotulo: 'Os dois' },
        ]}
      />
      <Interruptor
        rotulo="Com a logo da consultoria"
        valor={comLogo && temLogo}
        aoMudar={mudarLogo}
        ajuda={temLogo ? undefined : 'A consultoria não tem logo.'}
      />
      {autorizado ? (
        <Texto style={{ color: cores.sucesso }}>Aluno autorizou em {dataParaTela(autorizadoEm)}</Texto>
      ) : (
        <Texto>{AVISO_AUTORIZACAO}</Texto>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <Botao
        rotulo={rotuloBaixar}
        desabilitado={!autorizado || grupos.length === 0}
        motivo={autorizado ? undefined : AVISO_AUTORIZACAO}
        carregando={baixando}
        aoTocar={baixarImagem}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1), minHeight: 44, justifyContent: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  fileira: { flexWrap: 'nowrap' },
  celula: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  envio: { gap: espaco(1) },
  previa: { position: 'relative', alignSelf: 'center', borderRadius: RAIO, overflow: 'hidden' },
  logo: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  logoImagem: { width: '30%', height: 48 },
});
