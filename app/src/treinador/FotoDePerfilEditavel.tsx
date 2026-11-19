import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { ErroApi } from '../api/cliente';
import { baixarFotoDePerfilDoAluno, removerFotoDePerfilDoAluno, trocarFotoDePerfilDoAluno } from '../api/rotas';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from '../aluno/atualizacao/fotos/prepararFoto';
import { avisarQueAFotoMudou, useVersaoDaFotoDePerfil } from '../aluno/versaoDaFotoDePerfil';
import { fotoNaFicha, LIMITES_FOTO_PERFIL } from '../dominio/fotoDePerfil';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, CAMADA_DA_FOTO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { textoDoErro } from '../ui/erros';
import { FotoDePerfil } from '../ui/FotoDePerfil';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { FolhaDeAcoes } from './FolhaDeAcoes';

const MOTIVO_ENVIANDO = 'Enviando a foto';
/** Desenho da câmera no canto do círculo: só indica que o círculo é tocável (o alvo é o círculo). */
const SELO_DA_CAMERA = 20;

/** Mouse em cima ou foco (web): o `Pressable` do react-native-web passa os dois no estado. */
const realcado = (estado: PressableStateCallbackType) => {
  const e = estado as PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
  return !!e.hovered || !!e.focused;
};

interface Props {
  alunoId: string;
  alunoNome: string;
  anonimizado: boolean;
  /** A API disse que o aluno foi anonimizado (409): a ficha busca de novo e a edição some. */
  aoAnonimizado: () => void;
  /** A Folha "Foto de perfil" é da ficha: o círculo e o "Trocar foto" do ⋯ abrem a mesma. */
  folhaAberta: boolean;
  aoMudarFolha: (aberta: boolean) => void;
}

/**
 * Foto de perfil ao lado do nome, no cabeçalho da ficha (18/11), com a troca e a remoção no próprio círculo (C44). Quem pode
 * editar (`fotoNaFicha`) toca o círculo, o botão "Trocar foto", que abre a Folha "Foto de perfil"; o selo da câmera só
 * aparece com o mouse em cima ou com o foco (no toque não há hover: o nome acessível e a ação ficam). Galeria (e câmera no
 * celular), reduzida a 512 px e sem EXIF no aparelho; o servidor confere e limpa de novo. Enviando, o círculo fica
 * desabilitado com o indicador por cima. Depois do sucesso a versão da foto muda e o círculo baixa de novo. A foto não fica
 * guardada no aparelho.
 */
export function FotoDePerfilEditavel({ alunoId, alunoNome, anonimizado, aoAnonimizado, folhaAberta, aoMudarFolha }: Props) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const [temFoto, setTemFoto] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const { tamanho, edicao, lixeira } = fotoNaFicha({ podeAlterar: pode('ALUNO_ALTERAR'), anonimizado, temFoto });

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
  // O selo da câmera é decorativo e fica no ponto de 45° da borda: o alvo é o círculo inteiro (nunca menor que 44 px).
  const pontoDoSelo = (tamanho / 2) * (1 + Math.SQRT1_2) - SELO_DA_CAMERA / 2;
  const foto = (
    <FotoDePerfil chave={`perfil:${alunoId}:${versaoDaFoto}`} carregar={() => baixarFotoDePerfilDoAluno(alunoId)} nome={alunoNome}
      tamanho={tamanho} aoSaber={setTemFoto} />
  );

  return (
    <View>
      {edicao === 'canto' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Trocar foto"
          accessibilityHint={enviando ? MOTIVO_ENVIANDO : undefined} accessibilityState={{ disabled: enviando, busy: enviando }} disabled={enviando}
          onPress={() => aoMudarFolha(true)} style={[circulo, estilos.alvo]}>
          {(estado) => (
            <>
              {foto}
              {enviando ? (
                <View style={[StyleSheet.absoluteFill, circulo, estilos.camada, { backgroundColor: CAMADA_DA_FOTO.fundo }]}>
                  <ActivityIndicator color={CAMADA_DA_FOTO.icone} accessibilityLabel={MOTIVO_ENVIANDO} />
                </View>
              ) : realcado(estado) ? (
                <View accessible={false} testID="selo-da-camera" style={[estilos.selo, { left: pontoDoSelo, top: pontoDoSelo, borderColor: cores.bordaCampo,
                  backgroundColor: cores.superficie }]}>
                  <Camera size={12} strokeWidth={2.25} color={cores.texto} aria-hidden />
                </View>
              ) : null}
            </>
          )}
        </Pressable>
      ) : (
        <View style={circulo}>{foto}</View>
      )}
      {folhaAberta && edicao === 'canto' ? (
        <FolhaDeAcoes titulo="Foto de perfil" aoFechar={() => aoMudarFolha(false)} acoes={[
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

const estilos = StyleSheet.create({
  alvo: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE },
  camada: { alignItems: 'center', justifyContent: 'center' },
  selo: {
    position: 'absolute', width: SELO_DA_CAMERA, height: SELO_DA_CAMERA, borderRadius: SELO_DA_CAMERA / 2, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
