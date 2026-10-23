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
  MAXIMO_DATAS,
  MINIMO_DATAS,
  colunasNaTela,
  datasDaPosicao,
  fotoEmUso,
  fotosDaData,
  posicoesDe,
  primeiraEUltima,
  proximaFoto,
  rotuloDaData,
  textoDaDiferenca,
} from '../dominio/comparacaoDeFotos';
import { dataParaTela, numeroParaTela, SEM_DADO } from '../dominio/formatos';
import { alternarComLimite } from '../dominio/selecaoMultipla';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { Botao } from '../ui/Botao';
import { Interruptor } from '../ui/Campos';
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
          gerar={alunoId ? (ids, comLogo) => gerarComparacao(alunoId, ids, comLogo) : undefined}
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
  gerar?: (fotoIds: string[], comLogo: boolean) => Promise<Blob>;
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
  const [gerando, setGerando] = useState(false);
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
  const colunas = colunasNaTela(escolhidas.length, estreita);

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
            <View style={estilos.grade} accessibilityLabel="Prévia da comparação">
              {escolhidas.map((foto) => {
                const varias = fotosDaData(grupo.fotos, foto.data).length > 1;
                return (
                  <View key={foto.fotoId} style={{ width: `${Math.floor(100 / colunas) - 2}%` }}>
                    <ImagemProtegida
                      chave={`comparar:${foto.fotoId}`}
                      carregar={() => baixar(foto)}
                      descricao={`${foto.posicao} ${rotuloDaData(grupo.fotos, foto.data)}`}
                      tamanho={estreita ? 140 : 180}
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
            <Botao rotulo="Gerar imagem" tipo="secundario" desabilitado={escolhidas.length < MINIMO_DATAS} aoTocar={() => setGerando(true)} />
          ) : null}
        </View>
      ) : null}
      <Folha titulo="Foto" visivel={ampliada !== null} aoFechar={() => setAmpliada(null)} largura={LARGURA_EDITOR}>
        {ampliada ? (
          <ImagemProtegida chave={`grande:${ampliada.fotoId}`} carregar={() => baixar(ampliada)} descricao={ampliada.posicao} tamanho={360} altura={450} />
        ) : null}
      </Folha>
      {gerar ? (
        <Folha titulo="Gerar imagem" visivel={gerando} aoFechar={() => setGerando(false)} largura={LARGURA_EDITOR}>
          {gerando ? (
            <FolhaGerar
              fotos={escolhidas}
              baixar={baixar}
              gerar={gerar}
              autorizadoEm={autorizadoEm}
              aoFechar={() => setGerando(false)}
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

function FolhaGerar({ fotos, baixar, gerar, autorizadoEm, aoFechar, aoRecarregar }: {
  fotos: FotoDaLinha[];
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  gerar: (fotoIds: string[], comLogo: boolean) => Promise<Blob>;
  autorizadoEm: string | null;
  aoFechar: () => void;
  aoRecarregar?: () => void;
}) {
  const { preferencias, escolherPreferencia } = useTema();
  const { marca } = useSessao();
  const { cores } = useTema();
  const temLogo = !!marca?.logoUrl;
  const [comLogo, setComLogo] = useState(preferencias.logoNaComparacao && temLogo);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [recusado, setRecusado] = useState(false);
  const autorizado = !recusado && !!autorizadoEm;
  const colunas = fotos.length === 4 ? 2 : fotos.length;
  const [largura, setLargura] = useState(320);
  const tile = Math.max(80, Math.floor((largura - (colunas - 1) * 8) / colunas));

  const mudarLogo = (ligada: boolean) => {
    if (!temLogo) return;
    setComLogo(ligada);
    escolherPreferencia({ logoNaComparacao: ligada });
  };

  const baixarImagem = () => {
    setBaixando(true);
    setErro(null);
    gerar(fotos.map((f) => f.fotoId), comLogo && temLogo).then(
      async (blob) => {
        await baixarComparacao(blob);
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

  return (
    <View style={estilos.corpo}>
      <View
        accessibilityLabel="Prévia da imagem"
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        style={[estilos.previa, { backgroundColor: '#000' }]}
      >
        <View style={[estilos.grade, { gap: 8 }]}>
          {fotos.map((foto) => (
            <ImagemProtegida
              key={foto.fotoId}
              chave={`gerar:${foto.fotoId}`}
              carregar={() => baixar(foto)}
              descricao={foto.posicao}
              tamanho={tile}
              altura={Math.floor(tile * 5 / 4)}
            />
          ))}
        </View>
        {comLogo && temLogo && marca?.logoUrl ? (
          <View style={estilos.logo} pointerEvents="none">
            <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={estilos.logoImagem} contentFit="contain" accessibilityLabel="Logo da consultoria" />
          </View>
        ) : null}
      </View>
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
        rotulo={Platform.OS === 'web' ? 'Baixar imagem' : 'Compartilhar imagem'}
        desabilitado={!autorizado || fotos.length < MINIMO_DATAS}
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
  envio: { gap: espaco(1) },
  previa: { position: 'relative', padding: 8, borderRadius: RAIO, overflow: 'hidden' },
  logo: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  logoImagem: { width: '30%', height: 48 },
});
