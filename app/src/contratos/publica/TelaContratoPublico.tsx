import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import { LIMITES_DO_CONTRATO } from '../../api/contratos';
import {
  abrirContratoPublico, arquivoDoContratoPublico, assinarContratoPublico, consultarContratoPublico, type ContratoPublicoAberto,
  type ContratoPublicoAssinado, type ContratoPublicoConsulta,
} from '../../api/contratosPublicos';
import { mascaraCpf } from '../../dominio/cadastroDoAluno';
import {
  erroDoCpfDoResponsavel, errosDaAssinatura, normalizarNome, TEXTO_CONTRATO_ALTERADO, TEXTO_CPF_NAO_CONFERE, TEXTO_LINK_INDISPONIVEL,
  TEXTO_MUITAS_TENTATIVAS, TEXTO_SEM_INTERNET, tipoDoErroPublico, type CampoDaAssinatura,
} from '../../dominio/contratoPublico';
import { linhasDeEvidencia } from '../../dominio/contratos';
import { codigoDoFragmento } from '../../dominio/linkDeConvite';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta } from '../../ui/Estados';
import { errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { BotaoPublico, TelaPublica } from '../../ui/TelaPublica';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { NUMERICO } from '../../ui/tipografia';
import { useSemFragmentoNoEndereco } from '../../ui/useSemFragmentoNoEndereco';
import { baixarComprovanteDoResponsavel } from '../comprovante';
import { ROTULO_DO_PDF, VERBO_DO_PDF } from '../abrirPdf';
import { useAbrirPdf } from '../useAbrirPdf';

/** Onde a página está. Um estado só (não três booleanos): cada fase traz o que ela mostra. */
type Fase =
  | { tipo: 'consultando' }
  | { tipo: 'indisponivel' }
  | { tipo: 'falhou'; titulo: string; texto: string }
  | { tipo: 'cpf'; consulta: ContratoPublicoConsulta }
  | { tipo: 'leitura'; consulta: ContratoPublicoConsulta; cpf: string; aberto: ContratoPublicoAberto }
  | { tipo: 'assinado'; consulta: ContratoPublicoConsulta; assinado: ContratoPublicoAssinado };

interface AlertaDaPagina { tom: 'perigo' | 'atencao'; texto: string }

/** O que não é "link indisponível" e pode passar: tela com o motivo e "Tentar de novo". */
function falhaDaConsulta(e: unknown): Fase {
  const tipo = tipoDoErroPublico(e);
  if (tipo === 'indisponivel') return { tipo: 'indisponivel' };
  if (tipo === 'sem-internet') return { tipo: 'falhou', titulo: 'Sem internet', texto: TEXTO_SEM_INTERNET };
  if (tipo === 'limite') return { tipo: 'falhou', titulo: 'Muitas tentativas', texto: TEXTO_MUITAS_TENTATIVAS };
  return { tipo: 'falhou', titulo: 'Não foi possível abrir o contrato', texto: textoDoErro(e) };
}

/** O alerta do formulário para o erro que não é de campo (o 404 a tela troca pelo "link indisponível" antes). */
const alertaDoErro = (e: unknown): AlertaDaPagina => {
  const tipo = tipoDoErroPublico(e);
  return { tom: 'perigo', texto: tipo === 'sem-internet' ? TEXTO_SEM_INTERNET : tipo === 'limite' ? TEXTO_MUITAS_TENTATIVAS : textoDoErro(e) };
};

/** Foco num bloco que não é campo (alerta, caixa com erro): espera o toque terminar, como `focarPrimeiroComErro`. */
const focar = (ref: RefObject<View | null>) => setTimeout(() => {
  (ref.current as unknown as { focus?: () => void } | null)?.focus?.();
  if (Platform.OS === 'web') (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
}, 0);

/**
 * Página pública do contrato do responsável (`/contrato#codigo=...`, passo 4 de `docs/planos/contrato-digital.md`). O código
 * vem do fragmento, é lido no primeiro render e sai do endereço (nada no histórico); nada de dado pessoal na URL: CPF e nome
 * vão só no corpo. O link mostra a marca e o título; o CPF digitado (conferido no app e na API) abre o texto ou o PDF (S3); o
 * aceite pede nome com duas palavras, "li e concordo" e a declaração de responsável legal (D28). Assinado, mostra as
 * evidências e o comprovante. Link inválido, vencido, usado ou cancelado é um estado só. No par de 16 a 17 anos esta página
 * só assina o contrato do responsável: o do aluno é assinado no app.
 */
export function TelaContratoPublico() {
  const [codigo] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? codigoDoFragmento(window.location.hash) : ''));
  // Lido acima (valor inicial): agora o fragmento sai do endereço.
  useSemFragmentoNoEndereco();
  const { avisar } = useAviso();
  const [fase, setFase] = useState<Fase>(codigo ? { tipo: 'consultando' } : { tipo: 'indisponivel' });
  const [tentativa, setTentativa] = useState(0);
  // Passo do CPF.
  const [cpf, setCpf] = useState('');
  const [erroCpf, setErroCpf] = useState<string | undefined>();
  const [abrindo, setAbrindo] = useState(false);
  // Passo da assinatura.
  const [nome, setNome] = useState('');
  const [aceite, setAceite] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  const [erros, setErros] = useState<Partial<Record<CampoDaAssinatura, string>>>({});
  const [assinando, setAssinando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [alerta, setAlerta] = useState<AlertaDaPagina | null>(null);
  const cpfRef = useRef<TextInput>(null);
  const nomeRef = useRef<TextInput>(null);
  const aceiteRef = useRef<View>(null);
  const declaracaoRef = useRef<View>(null);
  const alertaRef = useRef<View>(null);
  const pdf = useAbrirPdf(() => arquivoDoContratoPublico(codigo, cpf));

  // A marca e o título; resposta de uma tentativa antiga (ou depois de sair) não vale.
  useEffect(() => {
    if (!codigo) return;
    let ativo = true;
    consultarContratoPublico(codigo).then(
      (consulta) => { if (ativo) setFase({ tipo: 'cpf', consulta }); },
      (e: unknown) => { if (ativo) setFase(falhaDaConsulta(e)); },
    );
    return () => { ativo = false; };
  }, [codigo, tentativa]);

  const tentarDeNovo = () => { setFase({ tipo: 'consultando' }); setTentativa((n) => n + 1); };

  const abrir = (consulta: ContratoPublicoConsulta) => {
    if (abrindo) return;
    const local = erroDoCpfDoResponsavel(cpf);
    setErroCpf(local);
    setAlerta(null);
    if (local) { focarPrimeiroComErro({ cpf: local }, [['cpf', cpfRef]]); return; }
    setAbrindo(true);
    abrirContratoPublico(codigo, cpf).then(
      (aberto) => { setAbrindo(false); setFase({ tipo: 'leitura', consulta, cpf, aberto }); },
      (e: unknown) => {
        setAbrindo(false);
        const tipo = tipoDoErroPublico(e);
        if (tipo === 'indisponivel') { setFase({ tipo: 'indisponivel' }); return; }
        if (tipo === 'cpf') {
          const noCampo = errosPorCampo(e).cpf ?? TEXTO_CPF_NAO_CONFERE;
          setErroCpf(noCampo);
          focarPrimeiroComErro({ cpf: noCampo }, [['cpf', cpfRef]]);
          return;
        }
        setAlerta(alertaDoErro(e));
      },
    );
  };

  const focarPrimeiroErroDaAssinatura = (campos: Partial<Record<CampoDaAssinatura, string>>) => {
    if (campos.nome) focarPrimeiroComErro({ nome: campos.nome }, [['nome', nomeRef]]);
    else if (campos.aceite) focar(aceiteRef);
    else if (campos.declaroResponsavelLegal) focar(declaracaoRef);
  };

  const assinar = (f: Extract<Fase, { tipo: 'leitura' }>) => {
    if (assinando) return;
    const locais = errosDaAssinatura({ nome, aceite, declaroResponsavelLegal: declaracao });
    setErros(locais);
    setAlerta(null);
    if (Object.keys(locais).length) { focarPrimeiroErroDaAssinatura(locais); return; }
    setAssinando(true);
    assinarContratoPublico({ codigo, cpf: f.cpf, sha256: f.aberto.sha256, nome: normalizarNome(nome), aceite: true, declaroResponsavelLegal: true }).then(
      (assinado) => {
        setAssinando(false);
        setFase({ tipo: 'assinado', consulta: f.consulta, assinado });
        avisar('Contrato assinado.', 'sucesso');
      },
      (e: unknown) => {
        setAssinando(false);
        const tipo = tipoDoErroPublico(e);
        if (tipo === 'indisponivel') { setFase({ tipo: 'indisponivel' }); return; }
        if (tipo === 'alterado') {
          // O documento mudou: busca o novo (com o novo código), mantém o nome e pede os dois aceites de novo.
          setAceite(false);
          setDeclaracao(false);
          setErros({});
          abrirContratoPublico(codigo, f.cpf).then(
            (aberto) => {
              setFase({ tipo: 'leitura', consulta: f.consulta, cpf: f.cpf, aberto });
              setAlerta({ tom: 'atencao', texto: TEXTO_CONTRATO_ALTERADO });
              focar(alertaRef);
            },
            (e2: unknown) => {
              if (tipoDoErroPublico(e2) === 'indisponivel') setFase({ tipo: 'indisponivel' });
              else { setAlerta(alertaDoErro(e2)); focar(alertaRef); }
            },
          );
          return;
        }
        if (tipo === 'assinatura') {
          const campos = errosPorCampo(e);
          const naTela = { nome: campos.nome, aceite: campos.aceite, declaroResponsavelLegal: campos.declaroResponsavelLegal };
          if (naTela.nome || naTela.aceite || naTela.declaroResponsavelLegal) { setErros(naTela); focarPrimeiroErroDaAssinatura(naTela); return; }
        }
        setAlerta(alertaDoErro(e));
        focar(alertaRef);
      },
    );
  };

  const baixarComprovante = (f: Extract<Fase, { tipo: 'assinado' }>) => {
    if (baixando) return;
    setBaixando(true);
    baixarComprovanteDoResponsavel(f.assinado, f.consulta.consultoria).then(
      () => setBaixando(false),
      (e: unknown) => { setBaixando(false); avisar(textoDoErro(e), 'perigo'); },
    );
  };

  const caixaDeAlerta = alerta ? (
    <View ref={alertaRef} tabIndex={-1} accessibilityLiveRegion="polite" aria-live="polite">
      <Alerta tom={alerta.tom} texto={alerta.texto} />
    </View>
  ) : null;

  switch (fase.tipo) {
    case 'consultando':
      return (
        <TelaPublica titulo="Contrato" subtitulo="Abrindo o link…">
          <Esqueleto texto="Carregando o contrato" cartoes={1} />
        </TelaPublica>
      );
    case 'indisponivel':
      return <TelaPublica titulo={TEXTO_LINK_INDISPONIVEL.titulo} subtitulo={TEXTO_LINK_INDISPONIVEL.texto}>{null}</TelaPublica>;
    case 'falhou':
      return (
        <TelaPublica titulo={fase.titulo} subtitulo={fase.texto}>
          <BotaoPublico rotulo="Tentar de novo" aoTocar={tentarDeNovo} />
        </TelaPublica>
      );
    case 'cpf': {
      const { consulta } = fase;
      return (
        <TelaPublica titulo={consulta.titulo} subtitulo="Para ler e assinar o contrato, confirme o CPF do responsável." marca={consulta.consultoria}>
          <Cartao>
            <View style={estilos.formulario}>
              <Campo ref={cpfRef} rotulo="CPF do responsável" valor={cpf} erro={erroCpf} numerico maxLength={14}
                keyboardType="number-pad" inputMode="numeric" autoComplete="off" returnKeyType="go"
                ajuda="O mesmo CPF que a consultoria tem no cadastro do responsável."
                aoMudar={(t) => { setCpf(mascaraCpf(t)); setErroCpf(undefined); }} onSubmitEditing={() => abrir(consulta)} />
              {caixaDeAlerta}
              <BotaoPublico rotulo="Continuar" aoTocar={() => abrir(consulta)} carregando={abrindo} cor={consulta.consultoria.corPrimaria} />
            </View>
          </Cartao>
        </TelaPublica>
      );
    }
    case 'leitura': {
      const { consulta, aberto } = fase;
      const ehPdf = aberto.origem === 'PDF';
      return (
        <TelaPublica titulo={aberto.titulo} subtitulo="Leia o contrato e assine no fim da página." marca={consulta.consultoria}>
          {caixaDeAlerta}
          <Cartao titulo="Contrato">
            {ehPdf ? (
              <View style={estilos.formulario}>
                <Texto>{`O contrato está no PDF. ${VERBO_DO_PDF} e leia antes de assinar.`}</Texto>
                <Botao rotulo={ROTULO_DO_PDF} tipo="secundario" cheio carregando={pdf.abrindo} aoTocar={pdf.abrir} />
              </View>
            ) : (
              <TextoFormatado texto={aberto.texto} selecionavel />
            )}
          </Cartao>
          <Cartao titulo="Assinatura">
            <View style={estilos.formulario}>
              <Campo ref={nomeRef} rotulo="Nome completo do responsável" valor={nome} erro={erros.nome}
                autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={LIMITES_DO_CONTRATO.nomeDoAssinante}
                aoMudar={(t) => { setNome(t); setErros((x) => ({ ...x, nome: undefined })); }} />
              <View ref={aceiteRef} tabIndex={-1} style={estilos.caixa}>
                <CaixaSelecao rotulo="Li o contrato e concordo com os termos." marcado={aceite}
                  aoMudar={(v) => { setAceite(v); setErros((x) => ({ ...x, aceite: undefined })); }} />
                {erros.aceite ? <MensagemDeErro erro={erros.aceite} /> : null}
              </View>
              <View ref={declaracaoRef} tabIndex={-1} style={estilos.caixa}>
                <CaixaSelecao rotulo="Declaro que sou o responsável legal do aluno." marcado={declaracao}
                  aoMudar={(v) => { setDeclaracao(v); setErros((x) => ({ ...x, declaroResponsavelLegal: undefined })); }} />
                {erros.declaroResponsavelLegal ? <MensagemDeErro erro={erros.declaroResponsavelLegal} /> : null}
              </View>
              <Texto variante="pequeno">{`Ao assinar, guardamos a data e a hora, o aparelho e um código que identifica ${ehPdf ? 'este arquivo' : 'este texto'}.`}</Texto>
              <BotaoPublico rotulo="Assinar contrato" aoTocar={() => assinar(fase)} carregando={assinando} cor={consulta.consultoria.corPrimaria} />
            </View>
          </Cartao>
        </TelaPublica>
      );
    }
    case 'assinado': {
      const { consulta, assinado } = fase;
      const linhas = linhasDeEvidencia({ nome: assinado.assinanteNome, assinadoEm: assinado.assinadoEm, sha256: assinado.sha256, responsavelLegal: true });
      return (
        <TelaPublica titulo="Contrato assinado" subtitulo="Guardamos a data, a hora e o aparelho." marca={consulta.consultoria}>
          <Cartao>
            <View style={estilos.formulario}>
              <ListaDeDados>
                <LinhaDeDado rotulo="Contrato" valor={assinado.titulo} />
                {linhas.map((l) => (
                  <LinhaDeDado key={l.rotulo} rotulo={l.rotulo} valor={l.valor}
                    conteudo={l.rotulo.startsWith('Código') ? <Texto selectable style={[NUMERICO, estilos.codigo]}>{l.valor}</Texto> : undefined} />
                ))}
              </ListaDeDados>
              <BotaoPublico rotulo="Baixar comprovante" aoTocar={() => baixarComprovante(fase)} carregando={baixando} cor={consulta.consultoria.corPrimaria} />
            </View>
          </Cartao>
        </TelaPublica>
      );
    }
  }
}

const estilos = StyleSheet.create({
  formulario: { gap: espaco(2) },
  caixa: { gap: espaco(0.5) },
  codigo: { fontSize: 13 },
});
