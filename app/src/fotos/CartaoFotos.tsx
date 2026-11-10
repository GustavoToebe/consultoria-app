import { CircleCheck } from 'lucide-react-native';
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
import { periodoDesdeOPrimeiro } from '../dominio/historicoDoAluno';
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
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { baixarComparacao } from './baixarComparacao';
import { PreviaDaImagem } from './PreviaDaImagem';

const AVISO_AUTORIZACAO = 'O aluno ainda não autorizou o uso das fotos. Ele autoriza em Conta › Uso das suas fotos.';
/** Teto da largura de cada foto na comparação: em tela larga o par fica junto, em vez de espalhado pelo cartão. */
const LARGURA_MAXIMA_DA_FOTO = 280;
const ESPACO_ENTRE_FOTOS = espaco(1);
/** Mesma área para todas as fotos, em retrato (3:4, o formato comum da câmera do celular em pé). */
const PROPORCAO_DA_FOTO = 3 / 4;

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
    <Cartao titulo="Fotos" periodo={dados ? periodoDesdeOPrimeiro(dados.map((f) => f.data)) : undefined} descricao="Fotos enviadas na anamnese e nas atualizações.">
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
  const { cores } = useTema();
  const [larguraDaFileira, setLarguraDaFileira] = useState(0);
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
  // Largura de cada foto: a fileira dividida pelas fotos, até o teto (em tela larga o par fica junto, não espalhado).
  const foto = larguraDaFileira > 0
    ? Math.min(LARGURA_MAXIMA_DA_FOTO, Math.floor((larguraDaFileira - ESPACO_ENTRE_FOTOS * (colunas - 1)) / colunas))
    : 0;
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
            // O par e o resumo formam um bloco: o resumo fica colado embaixo das fotos, as ações vêm depois.
            <View style={estilos.par}>
              {/* A fileira ocupa a largura do cartão só para ser medida; as fotos têm largura fixa e ficam juntas à esquerda. */}
              <View style={estilos.fileira} role="group" accessibilityLabel="Prévia da comparação" onLayout={(e) => setLarguraDaFileira(e.nativeEvent.layout.width)}>
                {foto > 0 ? escolhidas.map((f) => {
                  const varias = fotosDaData(grupo.fotos, f.data).length > 1;
                  return (
                    <View key={f.fotoId} style={[estilos.celula, { width: foto }]}>
                      {/* Mesma área para todas e a foto inteira (`contain`): nada é cortado de um lado só. */}
                      <ImagemProtegida
                        chave={`comparar:${f.fotoId}`}
                        carregar={() => baixar(f)}
                        descricao={`${f.posicao} ${rotuloDaData(grupo.fotos, f.data)}`}
                        tamanho={foto}
                        altura={Math.round(foto / PROPORCAO_DA_FOTO)}
                        ajuste="contain"
                        aoTocar={varias ? () => setTrocas((atual) => ({ ...atual, [f.data]: proximaFoto(grupo.fotos, f.data, f.fotoId) })) : undefined}
                      />
                      <Texto numerico variante="rotulo" cor={cores.texto}>{rotuloDaData(grupo.fotos, f.data)}</Texto>
                      <Texto numerico>{f.pesoKg == null ? SEM_DADO : `${numeroParaTela(f.pesoKg)} kg`}</Texto>
                    </View>
                  );
                }) : null}
              </View>
              {/* Variação neutra: sem cor nem "melhorou", porque subir ou descer de peso só tem sentido com a meta. */}
              {pontas ? <Texto numerico>{pontas}</Texto> : null}
            </View>
          ) : (
            <Texto variante="suave">Escolha de 2 a 4 datas.</Texto>
          )}
          {gerar ? (
            <LinhaDeAcoes>
              <Botao
                rotulo="Gerar imagem"
                tipo="secundario"
                desabilitado={escolhidas.length < MINIMO_DATAS}
                aoTocar={() => setFolha('imagem')}
              />
              {carrossel.length >= 2 ? (
                <Botao rotulo="Gerar carrossel" tipo="secundario" aoTocar={() => setFolha('carrossel')} />
              ) : null}
            </LinhaDeAcoes>
          ) : null}
        </View>
      ) : null}
      <Folha titulo="Foto" visivel={ampliada !== null} aoFechar={() => setAmpliada(null)} largura={LARGURA_EDITOR}>
        {ampliada ? (
          <ImagemProtegida chave={`grande:${ampliada.fotoId}`} carregar={() => baixar(ampliada)} descricao={ampliada.posicao} tamanho={360} altura={450} />
        ) : null}
      </Folha>
      {gerar && folha ? (
        <FolhaGerar
          titulo={folha === 'carrossel' ? 'Gerar carrossel' : 'Gerar imagem'}
          imagens={imagensDaFolha}
          baixar={baixar}
          gerar={gerar}
          autorizadoEm={autorizadoEm}
          aoFechar={() => setFolha(null)}
          aoRecarregar={aoRecarregar}
        />
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
      // Seleção invertida (fundo `texto`, letra `fundo`), como no `Escolha`: reconhecível sem depender só da borda.
      style={[estilos.chip, { borderColor: marcado ? cores.texto : cores.borda, backgroundColor: marcado ? cores.texto : cores.superficie }]}
    >
      <Texto cor={marcado ? cores.fundo : cores.texto}>{rotulo}</Texto>
    </Pressable>
  );
}

/** Largura útil do corpo a partir da qual prévia e configurações ficam lado a lado (no celular, empilhadas). */
const LARGURA_LADO_A_LADO = 640;
/** Coluna das configurações no PC: curta, para o switch ficar perto do rótulo e o formato caber numa linha. */
const LARGURA_CONFIGURACOES = 320;
/** Altura da prévia de uma imagem: o Stories cabe inteiro no corpo da folha sem rolar (cabeçalho, rodapé e rótulo à parte). */
const ALTURA_MINIMA_PREVIA = 240;
const ALTURA_MAXIMA_PREVIA = 560;
const FOLGA_DA_FOLHA = 230;
/** No carrossel, cada prévia é menor para caberem lado a lado. */
const ALTURA_MAXIMA_CARROSSEL = 220;

function FolhaGerar({ titulo, imagens, baixar, gerar, autorizadoEm, aoFechar, aoRecarregar }: {
  titulo: string;
  imagens: ImagemDaComparacao[];
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  gerar: (pedido: PedidoDeComparacao) => Promise<Blob>;
  autorizadoEm: string | null;
  aoFechar: () => void;
  aoRecarregar?: () => void;
}) {
  const { cores, preferencias, escolherPreferencia } = useTema();
  const { marca } = useSessao();
  const { width, height } = useWindowDimensions();
  // Mesmo corte da `Folha`: caixa centralizada a partir dele, folha de baixo no celular.
  const centralizada = width >= LARGURA_MENU_LATERAL;
  const [larguraUtil, setLarguraUtil] = useState(0);
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

  const ladoALado = larguraUtil >= LARGURA_LADO_A_LADO;
  const areaDaPrevia = ladoALado ? larguraUtil - espaco(3) - LARGURA_CONFIGURACOES : larguraUtil;
  const varias = imagens.length > 1;
  const alturaLimite = varias
    ? ALTURA_MAXIMA_CARROSSEL
    : Math.max(ALTURA_MINIMA_PREVIA, Math.min(ALTURA_MAXIMA_PREVIA, centralizada ? Math.round(height * 0.9) - FOLGA_DA_FOLHA : Math.round(height * 0.5)));
  // A vaga de cada prévia é calculada pelo formato mais largo (Feed): Stories e Feed têm a mesma altura e a mesma vaga,
  // então trocar o formato não move as configurações nem o rodapé. No carrossel cabem ao menos duas por linha.
  const porLinha = varias ? 2 : 1;
  const vaga = Math.floor((areaDaPrevia - espaco(2) * (porLinha - 1)) / porLinha) - 2;
  const alturaPrevia = Math.max(1, Math.min(alturaLimite, Math.floor((vaga * ALTURA_FEED) / LARGURA_IMAGEM)));
  const larguraDaVaga = Math.round((alturaPrevia * LARGURA_IMAGEM) / ALTURA_FEED) + 2;
  const larguraPrevia = Math.max(1, Math.round((alturaPrevia * LARGURA_IMAGEM) / alturaCheia));
  const logoUrl = comLogo && temLogo && marca?.logoUrl ? urlDaApi(marca.logoUrl) : null;

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

  const verbo = Platform.OS === 'web' ? 'Baixar' : 'Compartilhar';
  const rotuloBaixar = zip ? `${verbo} imagens (.zip)` : `${verbo} imagem`;
  const explicacaoDosDois = varias
    ? `Sai um .zip com ${imagens.length} imagens em cada pasta, Stories e Feed. A prévia mostra o Stories.`
    : 'Sai um .zip com duas imagens: o Stories na pasta Stories e o Feed retrato na pasta Feed. A prévia mostra o Stories.';

  // A autorização aparece uma vez só: autorizado, como status ao lado da ação; sem autorização, como o motivo do botão.
  const acao = (
    <Botao
      rotulo={rotuloBaixar}
      desabilitado={!autorizado || grupos.length === 0}
      motivo={autorizado ? undefined : AVISO_AUTORIZACAO}
      carregando={baixando}
      cheio={!centralizada}
      aoTocar={baixarImagem}
    />
  );
  const status = autorizado ? (
    <View style={estilos.status}>
      <CircleCheck size={16} color={cores.sucesso} strokeWidth={2.5} />
      <Texto variante="suave" style={estilos.textoDoStatus}>Aluno autorizou em {dataParaTela(autorizadoEm)}</Texto>
    </View>
  ) : null;
  // shortcut: arranjo do rodapé montado aqui (status à esquerda, ação à direita; em coluna no celular), trocar pelo rodapé único da Folha (passo 4a).
  // O erro do "Baixar" fica no rodapé, junto da ação: no celular o corpo empilhado o esconderia abaixo da prévia.
  // O rodapé fica preso ao pé da folha, então o erro cresce para cima e o botão não sai do lugar.
  const rodape = (
    <View style={[estilos.rodape, estilos.rodapeEmColuna]}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      {centralizada
        ? <LinhaDeAcoes alinhar={autorizado ? 'entre' : 'fim'}>{status}{acao}</LinhaDeAcoes>
        : <View style={estilos.rodapeEmColuna}>{status}{acao}</View>}
    </View>
  );

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} largura={LARGURA_EDITOR} rodape={rodape}>
      <View style={[estilos.gerar, ladoALado && estilos.gerarLadoALado]} onLayout={(e) => setLarguraUtil(Math.floor(e.nativeEvent.layout.width))}>
        <View style={[estilos.previas, ladoALado && estilos.previasLadoALado]}>
          {larguraUtil > 0 ? imagens.map((imagem) => (
            <View key={imagem.chave} style={[estilos.vaga, { width: larguraDaVaga }]}>
              <Texto variante="rotulo" style={estilos.rotuloDaVaga}>{imagem.rotulo}</Texto>
              <PreviaDaImagem
                chave={imagem.chave}
                rotulo={imagem.rotulo}
                fotos={imagem.fotos}
                formato={visual}
                largura={larguraPrevia}
                altura={alturaPrevia}
                logoUrl={logoUrl}
                baixar={baixar}
              />
            </View>
          )) : null}
        </View>
        <View style={[estilos.configuracoes, ladoALado && { width: LARGURA_CONFIGURACOES }]}>
          <View style={estilos.grupo}>
            <Escolha
              rotulo="Formato"
              valor={formato}
              aoMudar={setFormato}
              distribuida
              opcoes={[
                { valor: 'STORIES', rotulo: 'Stories' },
                { valor: 'FEED', rotulo: 'Feed retrato' },
                { valor: 'AMBOS', rotulo: 'Os dois' },
              ]}
            />
            {formato === 'AMBOS' ? <Texto variante="pequeno">{explicacaoDosDois}</Texto> : null}
          </View>
          {/* O `Interruptor` estica o rótulo até a borda; numa caixa do tamanho do conteúdo o switch fica junto dele. */}
          <View style={estilos.junto}>
            <Interruptor
              rotulo="Com a logo da consultoria"
              valor={comLogo && temLogo}
              aoMudar={mudarLogo}
              ajuda={temLogo ? undefined : 'A consultoria não tem logo.'}
            />
          </View>
        </View>
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1), minHeight: 44, justifyContent: 'center' },
  par: { gap: espaco(1) },
  fileira: { flexDirection: 'row', gap: ESPACO_ENTRE_FOTOS },
  celula: { gap: 2 },
  envio: { gap: espaco(1) },
  gerar: { gap: espaco(3) },
  gerarLadoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  previas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: espaco(2) },
  previasLadoALado: { flex: 1, minWidth: 0 },
  vaga: { alignItems: 'center', gap: espaco(1) },
  rotuloDaVaga: { textAlign: 'center' },
  configuracoes: { gap: espaco(2) },
  grupo: { gap: espaco(0.5) },
  junto: { alignSelf: 'flex-start', maxWidth: '100%' },
  // Ocupa a linha do rodapé da `Folha` inteira (sem isso, um erro comprido o alargaria além da folha).
  rodape: { width: '100%' },
  rodapeEmColuna: { gap: espaco(1) },
  status: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexShrink: 1 },
  textoDoStatus: { flexShrink: 1 },
});
