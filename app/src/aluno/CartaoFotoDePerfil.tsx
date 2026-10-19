import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDePerfil, removerFotoDePerfil, trocarFotoDePerfil } from '../api/rotas';
import { LIMITES_FOTO_PERFIL } from '../dominio/fotoDePerfil';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { FotoDePerfil } from '../ui/FotoDePerfil';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { apagarTemporaria } from './atualizacao/fotos/fotosLocais';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from './atualizacao/fotos/prepararFoto';
import { avisarQueAFotoMudou, useVersaoDaFotoDePerfil } from './versaoDaFotoDePerfil';

/**
 * Foto de perfil do aluno (opcional): escolher da galeria ou tirar na hora (celular), trocar e remover. A foto é reduzida
 * a 512 px e reencodada sem EXIF no aparelho; o servidor confere e limpa de novo. Precisa de internet: a foto não fica
 * guardada no aparelho.
 */
export function CartaoFotoDePerfil() {
  const { usuario } = useSessao();
  const { avisar } = useAviso();
  const versao = useVersaoDaFotoDePerfil();
  const [temFoto, setTemFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const trocar = async (origem: OrigemDaFoto) => {
    let uri: string | null = null;
    setEnviando(true);
    try {
      const pronta = await escolherFoto(origem, LIMITES_FOTO_PERFIL);
      if (!pronta) return;
      uri = pronta.uri;
      const dados = new FormData();
      if (Platform.OS === 'web') {
        dados.append('arquivo', await (await fetch(pronta.uri)).blob(), 'foto.jpg');
      } else {
        // React Native aceita {uri, name, type} no FormData; o nome original não sai do aparelho.
        dados.append('arquivo', { uri: pronta.uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
      }
      await trocarFotoDePerfil(dados);
      avisarQueAFotoMudou();
      avisar('Foto de perfil salva.', 'sucesso');
    } catch (erro) {
      avisar(erro instanceof FotoRecusada ? erro.message : textoDoErro(erro), 'perigo');
    } finally {
      if (uri && Platform.OS !== 'web') await apagarTemporaria(uri);
      setEnviando(false);
    }
  };

  const remover = () => {
    setRemovendo(true);
    removerFotoDePerfil().then(
      () => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        avisarQueAFotoMudou();
        avisar('Foto de perfil removida.', 'sucesso');
      },
      (erro: unknown) => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        avisar(textoDoErro(erro), 'perigo');
      },
    );
  };

  return (
    <Cartao titulo="Foto de perfil" descricao="Opcional. Aparece no seu início e para a equipe do seu treinador.">
      <View style={estilos.linha}>
        <FotoDePerfil chave={`perfil:${versao}`} carregar={baixarFotoDePerfil} nome={usuario?.nome} tamanho={88} aoSaber={setTemFoto} />
        <View style={estilos.acoes}>
          <LinhaDeAcoes>
            <Botao rotulo={temFoto ? 'Trocar foto' : 'Escolher foto'} tipo="secundario" Icone={ImagePlus} carregando={enviando}
              aoTocar={() => void trocar('galeria')} />
            {Platform.OS === 'web' ? null : (
              <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} desabilitado={enviando} motivo="Enviando a foto"
                aoTocar={() => void trocar('camera')} />
            )}
            {temFoto ? <Botao rotulo="Remover" tipo="perigoTexto" Icone={Trash2} aoTocar={() => setConfirmarRemocao(true)} /> : null}
          </LinhaDeAcoes>
          <Texto variante="pequeno">Precisa de internet. A foto não fica salva no aparelho.</Texto>
        </View>
      </View>
      <PainelConfirmacao visivel={confirmarRemocao} titulo="Remover a foto de perfil?" mensagem="Você pode escolher outra quando quiser."
        rotuloConfirmar="Remover" perigo carregando={removendo} aoConfirmar={remover} aoCancelar={() => setConfirmarRemocao(false)} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), flexWrap: 'wrap' },
  acoes: { flex: 1, minWidth: 200, gap: espaco(1) },
});
