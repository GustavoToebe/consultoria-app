import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDePerfil, removerFotoDePerfil, trocarFotoDePerfil } from '../../api/rotas';
import { seloDoPlano } from '../../dominio/contaDoAluno';
import { LIMITES_FOTO_PERFIL } from '../../dominio/fotoDePerfil';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { apagarTemporaria } from '../atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from '../atualizacao/fotos/prepararFoto';
import { avisarQueAFotoMudou, useVersaoDaFotoDePerfil } from '../versaoDaFotoDePerfil';
import { useRecuoDaConta } from './SecaoDaConta';

const FOTO = 72;

/**
 * Cartão do Perfil, no topo da Conta (23/11; cartão único em 28/11): foto, nome como os colegas veem, e-mail de acesso, o selo
 * do plano ("Trimestral · Ativo"; sem plano, nada), "Trocar foto" e, embaixo do fio, a linha que a tela passa em `children`
 * ("Perfil na comunidade", rente às bordas como as linhas dos outros cartões). "Trocar foto" abre a folha "Foto de perfil" (galeria; câmera só no celular; remover com confirmação), como na ficha
 * do treinador. A foto é reduzida a 512 px e sem EXIF no aparelho, o servidor confere de novo e nada fica guardado: sem
 * internet o botão fica desabilitado com o motivo.
 */
export function CabecalhoDoPerfil({ nome, email, plano, online, children }: {
  nome: string;
  email: string | null | undefined;
  plano: Parameters<typeof seloDoPlano>[0];
  online: boolean;
  children?: ReactNode;
}) {
  const { cores, bordas } = useTema();
  const recuo = useRecuoDaConta();
  const { avisar } = useAviso();
  const versao = useVersaoDaFotoDePerfil();
  const [temFoto, setTemFoto] = useState(false);
  const [folha, setFolha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const selo = seloDoPlano(plano);

  const trocar = async (origem: OrigemDaFoto) => {
    let uri: string | null = null;
    setEnviando(true);
    try {
      const pronta = await escolherFoto(origem, LIMITES_FOTO_PERFIL);
      if (!pronta) return;
      uri = pronta.uri;
      const dados = new FormData();
      await anexarFoto(dados, pronta);
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

  // No celular o seletor da galeria e a câmera não abrem enquanto o Modal da folha ainda está saindo (iOS).
  const depoisDaFolha = (agir: () => void) => (Platform.OS === 'web' ? agir() : setTimeout(agir, 350));

  return (
    <Cartao style={estilos.cartao}>
      <View style={[estilos.topo, { padding: recuo }]}>
        <View style={estilos.linha} testID="cabecalho-do-perfil">
          <FotoDePerfil chave={`perfil:${versao}`} carregar={baixarFotoDePerfil} nome={nome} tamanho={FOTO} aoSaber={setTemFoto} />
          <View style={estilos.textos}>
            <Texto variante="subtitulo" numberOfLines={2} accessibilityLabel={`Nome para os colegas: ${nome}`}>{nome}</Texto>
            {email ? <Texto variante="suave" numberOfLines={1}>{email}</Texto> : null}
            {selo ? <Selo texto={selo.texto} tipo={selo.tom} Icone={ICONE_DO_SELO[selo.tom]} /> : null}
          </View>
        </View>
        <Botao rotulo="Trocar foto" tipo="secundario" Icone={ImagePlus} carregando={enviando}
          desabilitado={!online} motivo="Sem conexão. A foto precisa de internet." aoTocar={() => setFolha(true)} />
      </View>
      {children ? <View style={{ borderTopWidth: bordas.item, borderTopColor: cores.divisor }}>{children}</View> : null}
      {folha ? (
        <FolhaDeAcoes titulo="Foto de perfil" aoFechar={() => setFolha(false)} acoes={[
          { rotulo: 'Escolher da galeria', Icone: ImagePlus, aoTocar: () => depoisDaFolha(() => void trocar('galeria')) },
          Platform.OS === 'web' ? null : { rotulo: 'Tirar foto', Icone: Camera, aoTocar: () => depoisDaFolha(() => void trocar('camera')) },
          temFoto ? { rotulo: 'Remover foto', Icone: Trash2, perigo: true, aoTocar: () => setConfirmarRemocao(true) } : null,
        ]}>
          <Texto variante="pequeno">Opcional. Aparece no seu início e para a equipe do seu treinador. A foto não fica salva no aparelho.</Texto>
        </FolhaDeAcoes>
      ) : null}
      <PainelConfirmacao visivel={confirmarRemocao} titulo="Remover a foto de perfil?" mensagem="Você pode escolher outra quando quiser."
        rotuloConfirmar="Remover" perigo carregando={removendo} aoConfirmar={remover} aoCancelar={() => setConfirmarRemocao(false)} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  // Sem o recuo do `Cartao`: o topo leva o dele e a linha de baixo vai rente às bordas.
  cartao: { padding: 0, gap: 0, overflow: 'hidden' },
  // O mesmo vão de 16 do `Cartao` entre o perfil e o "Trocar foto".
  topo: { gap: espaco(2) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2) },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.5), alignItems: 'flex-start' },
});
