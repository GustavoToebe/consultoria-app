import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { mfaPreparar, mfaStatus } from '../../api/rotas';
import type { MfaPreparacao } from '../../api/tipos';
import { codigoPreenchido, codigosParaCopiar, normalizarCodigo, segredoEmBlocos } from '../../dominio/mfa';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoSenha } from '../../ui/CampoSenha';
import { Cartao } from '../../ui/Cartao';
import { CodigoQr } from '../../ui/CodigoQr';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

type Etapa = 'repouso' | 'senha' | 'configurar' | 'recuperacao' | 'desativar';

/**
 * Verificação em duas etapas do treinador (Perfil › Segurança). Ativar: senha atual → QR code (ou segredo, ou link
 * `otpauth://` para quem configura no mesmo aparelho) → código de 6 dígitos → códigos de recuperação, mostrados uma única
 * vez. Ativar e desativar encerram as outras sessões; esta continua aberta com a sessão nova que a API devolve.
 */
export function VerificacaoEmDuasEtapas() {
  const sessao = useSessao();
  const { avisar } = useAviso();
  const status = useCarregar(sessao.offline ? null : 'mfa', () => mfaStatus());
  const [etapa, setEtapa] = useState<Etapa>('repouso');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [preparacao, setPreparacao] = useState<MfaPreparacao | null>(null);
  const [recuperacao, setRecuperacao] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const voltar = () => {
    setEtapa('repouso');
    setSenha('');
    setCodigo('');
    setPreparacao(null);
    setErro(null);
  };

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = (texto: string, oque: string) => {
    Clipboard.setStringAsync(texto).then(
      () => avisar(`${oque} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const preparar = () =>
    executar(async () => {
      setPreparacao(await mfaPreparar(senha));
      setEtapa('configurar');
    });

  const ativar = () =>
    executar(async () => {
      const codigos = await sessao.ativarMfa(senha, normalizarCodigo(codigo));
      setRecuperacao(codigos);
      setSenha('');
      setCodigo('');
      setPreparacao(null);
      setEtapa('recuperacao');
      status.recarregar();
    });

  const desativar = () =>
    executar(async () => {
      await sessao.desativarMfa(senha, normalizarCodigo(codigo));
      voltar();
      status.recarregar();
      avisar('Verificação em duas etapas desativada. As outras sessões foram encerradas.', 'sucesso');
    });

  if (sessao.offline) return null;
  if (status.erro) {
    return (
      <Cartao titulo="Verificação em duas etapas">
        <MensagemErro texto={textoDoErro(status.erro)} />
        <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={status.recarregar} />
      </Cartao>
    );
  }
  if (!status.dados) {
    return (
      <Cartao titulo="Verificação em duas etapas">
        <Carregando />
      </Cartao>
    );
  }
  const ativa = status.dados.ativo;

  if (etapa === 'recuperacao') {
    return (
      <Cartao titulo="Guarde os códigos de recuperação"
        descricao="Cada código vale uma única vez, no lugar do código do aplicativo, se você perder o celular. Eles não aparecem de novo.">
        <View style={estilos.codigos} accessibilityLabel="Códigos de recuperação">
          {recuperacao.map((c) => (
            <Texto key={c} selectable numerico style={estilos.codigo}>{c}</Texto>
          ))}
        </View>
        <LinhaDeAcoes>
          <Botao rotulo="Copiar códigos" tipo="secundario" Icone={Copy} aoTocar={() => copiar(codigosParaCopiar(recuperacao), 'Códigos')} />
          <Botao rotulo="Guardei os códigos" aoTocar={() => { setRecuperacao([]); voltar(); }} />
        </LinhaDeAcoes>
      </Cartao>
    );
  }

  return (
    <Cartao titulo="Verificação em duas etapas" descricao="Além da senha, o login pede um código de 6 dígitos de um aplicativo autenticador.">
      <View style={estilos.linhaDeSelo}>
        <Selo texto={ativa ? 'Ativa' : 'Desativada'} tipo={ativa ? 'sucesso' : 'neutro'} />
        {ativa ? <Texto variante="suave">{textoDosCodigos(status.dados.codigosRestantes)}</Texto> : null}
      </View>

      {etapa === 'repouso' && !ativa ? <Botao rotulo="Ativar" aoTocar={() => setEtapa('senha')} /> : null}
      {etapa === 'repouso' && ativa ? <Botao rotulo="Desativar" tipo="perigoTexto" aoTocar={() => setEtapa('desativar')} /> : null}

      {etapa === 'senha' ? (
        <>
          <CampoSenha rotulo="Senha atual" valor={senha} aoMudar={setSenha} autoComplete="current-password" onSubmitEditing={preparar} />
          {erro ? <MensagemErro texto={erro} /> : null}
          <LinhaDeAcoes>
            <Botao rotulo="Continuar" aoTocar={preparar} carregando={ocupado} desabilitado={!senha} motivo="Informe a senha atual." />
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={voltar} />
          </LinhaDeAcoes>
        </>
      ) : null}

      {etapa === 'configurar' && preparacao ? (
        <>
          <Texto variante="secao">1. Adicione ao aplicativo autenticador</Texto>
          <Texto variante="suave">
            Escaneie o QR code com o aplicativo (Google Authenticator, Microsoft Authenticator, Authy…). No próprio celular, use o botão
            Abrir no autenticador ou digite o segredo.
          </Texto>
          <View style={estilos.centro}>
            <CodigoQr conteudo={preparacao.otpauthUri} tamanho={200} descricao="QR code para o aplicativo autenticador" />
          </View>
          <Texto variante="rotulo">Segredo</Texto>
          <Texto selectable numerico style={estilos.codigo}>{segredoEmBlocos(preparacao.segredo)}</Texto>
          <LinhaDeAcoes>
            <Botao rotulo="Copiar segredo" tipo="secundario" Icone={Copy} aoTocar={() => copiar(preparacao.segredo, 'Segredo')} />
            {Platform.OS !== 'web' ? (
              <Botao rotulo="Abrir no autenticador" tipo="secundario" Icone={ExternalLink}
                aoTocar={() => {
                  Linking.openURL(preparacao.otpauthUri).catch(() =>
                    avisar('Nenhum aplicativo autenticador abriu o link. Use o QR code ou o segredo.', 'perigo'));
                }} />
            ) : null}
          </LinhaDeAcoes>
          <Texto variante="secao">2. Confirme com o código</Texto>
          <Campo rotulo="Código de 6 dígitos" valor={codigo} aoMudar={setCodigo} numerico inputMode="numeric"
            autoComplete="one-time-code" onSubmitEditing={ativar} />
          {erro ? <MensagemErro texto={erro} /> : null}
          <LinhaDeAcoes>
            <Botao rotulo="Ativar verificação" aoTocar={ativar} carregando={ocupado} desabilitado={!codigoPreenchido(codigo)}
              motivo="Digite o código de 6 dígitos que o aplicativo mostra." />
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={voltar} />
          </LinhaDeAcoes>
        </>
      ) : null}

      {etapa === 'desativar' ? (
        <>
          <Texto variante="suave">Para desativar, informe a senha e um código do aplicativo (ou de recuperação).</Texto>
          <CampoSenha rotulo="Senha atual" valor={senha} aoMudar={setSenha} autoComplete="current-password" />
          <Campo rotulo="Código" valor={codigo} aoMudar={setCodigo} autoComplete="one-time-code" autoCapitalize="none" />
          {erro ? <MensagemErro texto={erro} /> : null}
          <LinhaDeAcoes>
            <Botao rotulo="Desativar verificação" tipo="perigoTexto" aoTocar={desativar} carregando={ocupado}
              desabilitado={!senha || !codigoPreenchido(codigo)} motivo="Informe a senha e um código válido." />
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={voltar} />
          </LinhaDeAcoes>
        </>
      ) : null}
    </Cartao>
  );
}

function textoDosCodigos(restantes: number): string {
  if (restantes === 0) return 'Sem códigos de recuperação restantes.';
  return restantes === 1 ? '1 código de recuperação restante.' : `${restantes} códigos de recuperação restantes.`;
}

const estilos = StyleSheet.create({
  linhaDeSelo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  centro: { alignItems: 'center', paddingVertical: espaco(1) },
  codigos: { gap: espaco(0.5) },
  codigo: { letterSpacing: 1 },
});
