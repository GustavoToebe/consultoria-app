import { router } from 'expo-router';
import { FileX2, WifiOff } from 'lucide-react-native';
import { useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { assinarContrato, baixarMeuArquivoDeContrato, obterMeuContrato, LIMITES_DO_CONTRATO, type ContratoDoAlunoDetalhe } from '../../api/contratos';
import { baixarComprovanteDoAluno } from '../../contratos/comprovante';
import { ROTULO_DO_PDF, VERBO_DO_PDF } from '../../contratos/abrirPdf';
import { useAbrirPdf } from '../../contratos/useAbrirPdf';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { linhasDeEvidencia, seloDoContratoDoAluno } from '../../dominio/contratos';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { NUMERICO } from '../../ui/tipografia';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';
import { useContratosDoAluno } from './ContratosDoAlunoProvider';

const INDISPONIVEIS = new Set(['NAO_ENCONTRADO', 'CONTRATOS_INDISPONIVEL']);
const ehIndisponivel = (e: unknown) => {
  const status = (e as { status?: number } | null)?.status;
  return status === 404 || INDISPONIVEIS.has(codigoApi(e) ?? '');
};

/**
 * Contrato do aluno (`/aluno/contrato/[id]`, `docs/planos/contrato-digital-telas.md`, tela C). Pendente: o texto (ou, no PDF
 * próprio, "Abrir o PDF") e a
 * assinatura (nome completo + aceite), que manda o `sha256` do detalhe lido (o app nunca calcula hash). Assinado: as
 * evidências que o aluno vê (nome digitado, data e hora de Brasília, código) e o comprovante. Só com internet; nada fica no
 * aparelho. 404 e 503 dizem que o contrato não está mais disponível.
 */
export function TelaDoContrato({ id }: { id: string }) {
  const { online, tentarDeNovo } = useAluno();
  const { contratosHabilitados, usuario, marca, recarregarPerfil } = useSessao();
  const contratos = useContratosDoAluno();
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_MENU_LATERAL;
  const carga = useCarregar(contratosHabilitados && online && id ? `meu-contrato:${id}` : null, () => obterMeuContrato(id));
  const [nome, setNome] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState<{ nome?: string; aceite?: string }>({});
  const [alerta, setAlerta] = useState<{ tom: 'perigo' | 'atencao'; texto: string } | null>(null);
  const [semFormulario, setSemFormulario] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const pdf = useAbrirPdf(() => baixarMeuArquivoDeContrato(id));
  const nomeRef = useRef<TextInput>(null);
  const alertaRef = useRef<View>(null);
  const seloRef = useRef<View>(null);
  const d = carga.dados;

  const focar = (ref: RefObject<View | null>) => setTimeout(() => {
    const alvo = ref.current as unknown as { focus?: (o?: FocusOptions) => void } | null;
    alvo?.focus?.();
    if (Platform.OS === 'web') (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
  }, 0);

  const assinar = () => {
    if (!d || assinando) return;
    const locais = {
      nome: nome.trim() ? undefined : 'Escreva seu nome completo.',
      aceite: aceite ? undefined : 'Marque que leu e concorda com o contrato.',
    };
    setErros(locais);
    setAlerta(null);
    if (locais.nome || locais.aceite) {
      focarPrimeiroComErro(locais as Record<string, string>, [['nome', nomeRef]]);
      return;
    }
    setAssinando(true);
    assinarContrato(d.id, { sha256: d.sha256, nome: nome.trim(), aceite: true }).then(
      (assinado) => {
        setAssinando(false);
        carga.definir(assinado);
        contratos.recarregar();
        // Assinar libera na hora (D5): o /eu novo tira a trava do contrato, se era ela.
        void recarregarPerfil().catch(() => undefined);
        avisar('Contrato assinado.', 'sucesso');
        focar(seloRef);
      },
      (e: unknown) => {
        setAssinando(false);
        const codigo = codigoApi(e);
        if (codigo === 'CONTRATO_ALTERADO') {
          // O texto mudou: busca o novo (com o novo código), mantém o nome e pede o aceite de novo.
          carga.recarregar();
          setAceite(false);
          setAlerta({ tom: 'atencao', texto: 'O contrato mudou desde que você abriu. Leia de novo antes de assinar.' });
          focar(alertaRef);
        } else if (codigo === 'CONTRATO_SIGNATARIO') {
          setSemFormulario(textoDoErro(e));
        } else if (codigo === 'CONFLITO_EDICAO') {
          carga.recarregar();
          setAlerta({ tom: 'atencao', texto: textoDoErro(e) });
        } else if (codigo === 'ASSINATURA_INVALIDA') {
          const campos = errosPorCampo(e);
          if (campos.nome || campos.aceite) {
            setErros({ nome: campos.nome, aceite: campos.aceite });
            focarPrimeiroComErro(campos, [['nome', nomeRef]]);
          } else setAlerta({ tom: 'perigo', texto: textoDoErro(e) });
        } else if (ehIndisponivel(e)) {
          carga.recarregar();
        } else {
          setAlerta({ tom: 'perigo', texto: erroDeConexao(e) ? 'Confira a internet e tente de novo.' : textoDoErro(e) });
        }
      },
    );
  };

  const baixar = (det: ContratoDoAlunoDetalhe) => {
    if (!marca || baixando) return;
    setBaixando(true);
    baixarComprovanteDoAluno(det, marca, usuario?.nome ?? null).then(
      () => setBaixando(false),
      (e: unknown) => { setBaixando(false); avisar(textoDoErro(e), 'perigo'); },
    );
  };

  const voltarAoInicio = () => { contratos.recarregar(); router.replace('/aluno'); };
  const indisponivel = !contratosHabilitados || (carga.erro !== undefined && !d && ehIndisponivel(carga.erro));

  const corpo = () => {
    if (indisponivel) {
      return <Vazio Icone={FileX2} titulo="Contrato indisponível" texto="Este contrato não está mais disponível. Fale com o seu treinador." acao={{ rotulo: 'Voltar ao início', aoTocar: voltarAoInicio }} />;
    }
    if (!online && !d) {
      return <Vazio Icone={WifiOff} titulo="Sem internet" texto="O contrato só abre com conexão." acao={{ rotulo: 'Tentar de novo', aoTocar: () => { void tentarDeNovo(); } }} />;
    }
    if (carga.erro && !d) return <MensagemErro texto={erroDeConexao(carga.erro) ? 'Confira a internet e tente de novo.' : textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} />;
    if (!d) return <Esqueleto texto="Carregando o contrato" cartoes={2} />;
    const selo = seloDoContratoDoAluno(d);
    const assinado = d.situacao === 'ASSINADO' && d.assinatura;
    return (
      <View style={estilos.corpo}>
        {alerta ? (
          <View ref={alertaRef} tabIndex={-1} accessibilityLiveRegion="polite"><Alerta tom={alerta.tom} texto={alerta.texto} /></View>
        ) : null}
        <View style={estilos.linhaDoSelo}>
          <Texto variante="suave">{`Enviado em ${dataParaTela(dataEmBrasilia(d.geradoEm))}`}</Texto>
          <View ref={seloRef} tabIndex={-1} accessibilityLabel={`Situação: ${selo.texto}`}><Selo texto={selo.texto} tipo={selo.tipo} /></View>
        </View>
        {assinado ? (
          <View style={estilos.bloco}>
            <ListaDeDados>
              {linhasDeEvidencia({ nome: d.assinatura!.nome, assinadoEm: d.assinatura!.assinadoEm, sha256: d.sha256 }).map((l) => (
                <LinhaDeDado key={l.rotulo} rotulo={l.rotulo} valor={l.valor}
                  conteudo={l.rotulo.startsWith('Código') ? <Texto selectable style={[NUMERICO, estilos.codigo]}>{l.valor}</Texto> : undefined} />
              ))}
            </ListaDeDados>
            <Botao rotulo="Baixar comprovante" cheio={celular} carregando={baixando} desabilitado={!marca} motivo="Aguarde a marca da consultoria carregar." aoTocar={() => baixar(d)} />
          </View>
        ) : null}
        {d.origem === 'PDF' ? (
          <View style={estilos.texto}>
            <Texto variante="bloco" nivel={2}>Contrato</Texto>
            <Texto>{assinado ? 'O contrato que você assinou está no PDF.' : `O contrato está no PDF. ${VERBO_DO_PDF} e leia antes de assinar.`}</Texto>
            <Botao rotulo={ROTULO_DO_PDF} tipo="secundario" cheio={celular} carregando={pdf.abrindo} desabilitado={!online}
              motivo="Sem internet: conecte-se para abrir o PDF." aoTocar={pdf.abrir} />
          </View>
        ) : (
          <View style={estilos.texto}>
            <Texto variante="bloco" nivel={2}>Texto do contrato</Texto>
            <TextoFormatado texto={d.texto} selecionavel />
          </View>
        )}
        {!assinado && d.situacao === 'PENDENTE' ? (
          <View style={estilos.texto}>
            <Texto variante="bloco" nivel={2}>Assinatura</Texto>
            {semFormulario ? <Alerta tom="atencao" texto={semFormulario} /> : (
              <>
                <Campo ref={nomeRef} rotulo="Seu nome completo" valor={nome} aoMudar={(t) => { setNome(t); setErros((e) => ({ ...e, nome: undefined })); }}
                  autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={LIMITES_DO_CONTRATO.nomeDoAssinante}
                  erro={erros.nome} ajuda={usuario?.nome ? `Como no seu cadastro: ${usuario.nome}` : undefined} />
                <View>
                  <CaixaSelecao rotulo="Li o contrato e concordo com os termos." marcado={aceite} aoMudar={(v) => { setAceite(v); setErros((e) => ({ ...e, aceite: undefined })); }} />
                  {erros.aceite ? <MensagemDeErro erro={erros.aceite} /> : null}
                </View>
                <Texto variante="pequeno">Ao assinar, guardamos a data e a hora, o aparelho e {`um código que identifica ${d.origem === 'PDF' ? 'este arquivo' : 'este texto'}.`}</Texto>
                <Botao rotulo="Assinar contrato" cheio={celular} carregando={assinando} desabilitado={!online} motivo="Sem internet: conecte-se para assinar." aoTocar={assinar} />
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Tela largura={720} bordas={['top']}>
      <Cabecalho titulo={d?.titulo ?? 'Contrato'} voltar="/aluno" />
      {corpo()}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
  linhaDoSelo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  bloco: { gap: espaco(2) },
  texto: { gap: espaco(1.5), maxWidth: LARGURA_TEXTO_CORRIDO },
  codigo: { fontSize: 13 },
});
