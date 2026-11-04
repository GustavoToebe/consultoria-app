import { Camera, ImagePlus, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { ErroApi } from '../api/cliente';
import { baixarFotoDePerfilDoAluno, removerFotoDePerfilDoAluno, trocarFotoDePerfilDoAluno } from '../api/rotas';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from '../aluno/atualizacao/fotos/prepararFoto';
import { avisarQueAFotoMudou, useVersaoDaFotoDePerfil } from '../aluno/versaoDaFotoDePerfil';
import { fotoNaFicha, LIMITES_FOTO_PERFIL } from '../dominio/fotoDePerfil';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, CAMADA_DA_FOTO, espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { textoDoErro } from '../ui/erros';
import { FotoDePerfil } from '../ui/FotoDePerfil';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useComMouse } from '../ui/useComMouse';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { FolhaDeAcoes } from './FolhaDeAcoes';

const MOTIVO_ENVIANDO = 'Enviando a foto';
/** Desenho do botão do canto (o alvo continua com 44 px). */
const BOTAO_DO_CANTO = 32;

interface Props {
  alunoId: string;
  alunoNome: string;
  anonimizado: boolean;
  /** A API disse que o aluno foi anonimizado (409): a ficha busca de novo e a edição some. */
  aoAnonimizado: () => void;
}

/**
 * Foto de perfil do topo da ficha, com a troca e a remoção no próprio círculo (C44). Quem pode editar (`fotoNaFicha`):
 * no PC com mouse, uma camada escura no hover ou no foco com câmera e lixeira; no toque, um botão no canto que abre a
 * Folha "Foto de perfil". Galeria (e câmera no celular), reduzida a 512 px e sem EXIF no aparelho; o servidor confere e
 * limpa de novo. Depois do sucesso a versão da foto muda e o círculo baixa de novo. A foto não fica guardada no aparelho.
 */
export function FotoDePerfilEditavel({ alunoId, alunoNome, anonimizado, aoAnonimizado }: Props) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const comMouse = useComMouse();
  const reduzido = useMovimentoReduzido();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const [temFoto, setTemFoto] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [folha, setFolha] = useState(false);
  const [porCima, setPorCima] = useState(false);
  const [focoDentro, setFocoDentro] = useState(false);
  const { tamanho, edicao, lixeira } = fotoNaFicha({ largura: width, comMouse, podeAlterar: pode('ALUNO_ALTERAR'), anonimizado, temFoto });

  const avisarErro = (erro: unknown) => {
    avisar(erro instanceof FotoRecusada ? erro.message : textoDoErro(erro), 'perigo');
    if (erro instanceof ErroApi && erro.codigo === 'ALUNO_ANONIMIZADO') aoAnonimizado();
  };

  const trocar = async (origem: OrigemDaFoto) => {
    let uri: string | null = null;
    setEnviando(true);
    try {
      const pronta = await escolherFoto(origem, LIMITES_FOTO_PERFIL);
      if (!pronta) return;
      uri = pronta.uri;
      const dados = new FormData();
      await anexarFoto(dados, pronta);
      await trocarFotoDePerfilDoAluno(alunoId, dados);
      avisarQueAFotoMudou();
      avisar('Foto de perfil salva.', 'sucesso');
    } catch (erro) {
      avisarErro(erro);
    } finally {
      if (uri && Platform.OS !== 'web') await apagarTemporaria(uri);
      setEnviando(false);
    }
  };

  const remover = () => {
    setRemovendo(true);
    removerFotoDePerfilDoAluno(alunoId).then(
      () => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        avisarQueAFotoMudou();
        avisar('Foto de perfil removida.', 'sucesso');
      },
      (erro: unknown) => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        avisarErro(erro);
      },
    );
  };

  // No celular o seletor da galeria e a câmera não abrem enquanto o Modal da Folha ainda está saindo (iOS).
  const depoisDaFolha = (agir: () => void) => (Platform.OS === 'web' ? agir() : setTimeout(agir, 350));

  const circulo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  const camadaVisivel = porCima || focoDentro || enviando;
  const transicao = (Platform.OS === 'web' && !reduzido ? { transitionProperty: 'opacity', transitionDuration: '120ms' } : null) as ViewStyle | null;
  const pontoDoCanto = (tamanho / 2) * (1 + Math.SQRT1_2) - ALVO_TOQUE / 2;

  return (
    <View style={estilos.coluna}>
      <View style={circulo} {...(edicao === 'camada' ? { onPointerEnter: () => setPorCima(true), onPointerLeave: () => setPorCima(false) } : null)}>
        <FotoDePerfil chave={`perfil:${alunoId}:${versaoDaFoto}`} carregar={() => baixarFotoDePerfilDoAluno(alunoId)} nome={alunoNome}
          tamanho={tamanho} aoSaber={setTemFoto} />
        {edicao === 'camada' ? (
          <View style={[StyleSheet.absoluteFill, circulo, estilos.camada, { backgroundColor: CAMADA_DA_FOTO.fundo, opacity: camadaVisivel ? 1 : 0 }, transicao]}>
            <BotaoSobreAFoto Icone={Camera} rotulo="Trocar foto de perfil" carregando={enviando} desabilitado={enviando}
              aoTocar={() => void trocar('galeria')} aoFocar={setFocoDentro} />
            {lixeira ? (
              <BotaoSobreAFoto Icone={Trash2} rotulo="Remover foto de perfil" desabilitado={enviando}
                aoTocar={() => setConfirmarRemocao(true)} aoFocar={setFocoDentro} />
            ) : null}
          </View>
        ) : null}
        {edicao === 'canto' && enviando ? (
          <View style={[StyleSheet.absoluteFill, circulo, estilos.camada, { backgroundColor: CAMADA_DA_FOTO.fundo }]}>
            <ActivityIndicator color={CAMADA_DA_FOTO.icone} accessibilityLabel={MOTIVO_ENVIANDO} />
          </View>
        ) : null}
        {edicao === 'canto' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Foto de perfil: trocar ou remover"
            accessibilityHint={enviando ? MOTIVO_ENVIANDO : undefined} accessibilityState={{ disabled: enviando }} disabled={enviando}
            onPress={() => setFolha(true)} style={[estilos.alvoDoCanto, { left: pontoDoCanto, top: pontoDoCanto }]}>
            {(estado) => (
              <View style={[estilos.botaoDoCanto, { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) && !enviando ? cores.superficie3 : cores.superficie }]}>
                <Camera size={16} strokeWidth={2} color={enviando ? cores.textoSuave : cores.texto} />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
      {enviando ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite" style={[estilos.enviando, { maxWidth: Math.max(tamanho, 96) }]}>{MOTIVO_ENVIANDO}…</Texto>
      ) : null}
      {folha ? (
        <FolhaDeAcoes titulo="Foto de perfil" aoFechar={() => setFolha(false)} acoes={[
          { rotulo: 'Escolher da galeria', Icone: ImagePlus, aoTocar: () => depoisDaFolha(() => void trocar('galeria')) },
          Platform.OS === 'web' ? null : { rotulo: 'Tirar foto', Icone: Camera, aoTocar: () => depoisDaFolha(() => void trocar('camera')) },
          lixeira ? { rotulo: 'Remover foto', Icone: Trash2, perigo: true, aoTocar: () => setConfirmarRemocao(true) } : null,
        ]} />
      ) : null}
      <PainelConfirmacao visivel={confirmarRemocao} titulo="Remover a foto de perfil?"
        mensagem={`A foto sai da ficha e do app de ${alunoNome}. Dá para escolher outra depois.`}
        rotuloConfirmar="Remover" perigo carregando={removendo} aoConfirmar={remover} aoCancelar={() => setConfirmarRemocao(false)} />
    </View>
  );
}

/**
 * Botão de ícone por cima da camada escura: branco sobre a camada em qualquer tema (a foto embaixo pode ter qualquer
 * cor), alvo de 44 px redondo e o anel de foco branco, porque o anel do tema (cor do texto) some sobre a camada no claro.
 */
function BotaoSobreAFoto({ Icone, rotulo, aoTocar, aoFocar, desabilitado, carregando }: {
  Icone: LucideIcon; rotulo: string; aoTocar: () => void; aoFocar: (foco: boolean) => void; desabilitado?: boolean; carregando?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityHint={desabilitado ? MOTIVO_ENVIANDO : undefined}
      accessibilityState={{ disabled: !!desabilitado, busy: !!carregando }} disabled={desabilitado} onPress={aoTocar}
      onFocus={() => aoFocar(true)} onBlur={() => aoFocar(false)}
      style={(estado) => [estilos.botaoSobreAFoto, { outlineColor: CAMADA_DA_FOTO.icone } as ViewStyle,
        sobre(estado) && !desabilitado ? { backgroundColor: CAMADA_DA_FOTO.sobre } : null]}>
      {carregando ? <ActivityIndicator color={CAMADA_DA_FOTO.icone} /> : <Icone size={22} strokeWidth={2} color={CAMADA_DA_FOTO.icone} />}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  coluna: { alignItems: 'center', gap: espaco(1.5) },
  camada: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(0.5) },
  botaoSobreAFoto: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: ALVO_TOQUE / 2, alignItems: 'center', justifyContent: 'center' },
  alvoDoCanto: { position: 'absolute', width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  botaoDoCanto: { width: BOTAO_DO_CANTO, height: BOTAO_DO_CANTO, borderRadius: BOTAO_DO_CANTO / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  enviando: { textAlign: 'center' },
});
