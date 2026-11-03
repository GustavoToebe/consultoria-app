import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { removerFotoDePerfilDoAluno, trocarFotoDePerfilDoAluno } from '../api/rotas';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from '../aluno/atualizacao/fotos/prepararFoto';
import { avisarQueAFotoMudou } from '../aluno/versaoDaFotoDePerfil';
import { LIMITES_FOTO_PERFIL } from '../dominio/fotoDePerfil';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';

interface Props {
  alunoId: string;
  alunoNome: string;
  /** Se o aluno tem foto (sabido pela foto do topo da ficha); `null` = ainda não se sabe, e "Remover foto" não aparece. */
  temFoto: boolean | null;
  /** A API disse que o aluno foi anonimizado (409): a ficha busca de novo e estes botões somem. */
  aoAnonimizado: () => void;
}

/**
 * A equipe troca ou remove a foto de perfil do aluno (C44), pelo mesmo caminho do cartão do aluno: galeria (e câmera no
 * celular), reduzida a 512 px e sem EXIF no aparelho; o servidor confere e limpa de novo. Quem monta decide se aparece
 * (`ALUNO_ALTERAR` e aluno não anonimizado). Depois do sucesso, a versão da foto muda e o círculo do topo baixa de novo.
 * A foto não fica guardada no aparelho.
 */
export function FotoDePerfilPelaEquipe({ alunoId, alunoNome, temFoto, aoAnonimizado }: Props) {
  const { avisar } = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);

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

  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo">Foto de perfil</Texto>
      <LinhaDeAcoes>
        <Botao rotulo={temFoto ? 'Trocar foto' : 'Escolher foto'} tipo="secundario" Icone={ImagePlus} carregando={enviando}
          aoTocar={() => void trocar('galeria')} />
        {Platform.OS === 'web' ? null : (
          <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} desabilitado={enviando} motivo="Enviando a foto"
            aoTocar={() => void trocar('camera')} />
        )}
        {temFoto ? <Botao rotulo="Remover foto" tipo="perigoTexto" Icone={Trash2} desabilitado={enviando} motivo="Enviando a foto"
          aoTocar={() => setConfirmarRemocao(true)} /> : null}
      </LinhaDeAcoes>
      <Texto variante="pequeno">Aparece no topo da ficha e no início do aluno. Precisa de internet; a foto não fica salva no aparelho.</Texto>
      <PainelConfirmacao visivel={confirmarRemocao} titulo="Remover a foto de perfil?"
        mensagem={`A foto sai da ficha e do app de ${alunoNome}. Dá para escolher outra depois.`}
        rotuloConfirmar="Remover" perigo carregando={removendo} aoConfirmar={remover} aoCancelar={() => setConfirmarRemocao(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});
