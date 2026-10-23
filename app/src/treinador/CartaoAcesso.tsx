import { Permitido } from '../ui/Permitido';
import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { definirAcessoDoAluno, gerarConvite } from '../api/rotas';
import type { AlunoDetalhe, ConviteGerado } from '../api/tipos';
import { dataHoraParaTela } from '../dominio/formatos';
import { gerarSenhaProvisoria } from '../dominio/senhaProvisoria';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoLeitura } from '../ui/CampoLeitura';
import { CampoSenha } from '../ui/CampoSenha';
import { CamposEmLinha } from '../ui/CamposEmLinha';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/** Selo do acesso ao app (também no "Cadastro" dos dados do aluno). */
export function seloDoAcesso(aluno: AlunoDetalhe): { texto: string; tipo: 'sucesso' | 'atencao' | 'neutro' } {
  if (!aluno.temAcesso) return { texto: 'Sem acesso', tipo: 'neutro' };
  if (aluno.aguardandoPrimeiroAcesso) return { texto: 'Aguardando primeiro acesso', tipo: 'atencao' };
  return { texto: 'Com acesso', tipo: 'sucesso' };
}

/**
 * Acesso do aluno ao app. Sem conta: gera o convite (código de 10 letras e link, válidos por 7 dias; gerar outro
 * invalida o anterior) ou o treinador define e-mail e senha provisória. Com conta: "Definir nova senha" troca a senha
 * (e o e-mail de login, se mudou) e encerra as sessões do aluno. A senha provisória o aluno troca no primeiro login; ela
 * e o código do convite só aparecem nesta tela, uma vez.
 */
export function CartaoAcesso({ aluno, aoAlterar }: { aluno: AlunoDetalhe; aoAlterar: (aluno: AlunoDetalhe) => void }) {
  const { avisar } = useAviso();
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [definindo, setDefinindo] = useState(false);
  const [definido, setDefinido] = useState<{ email: string; senha: string } | null>(null);

  const gerar = () => {
    setConfirmar(false);
    setGerando(true);
    setErro(null);
    gerarConvite(aluno.id).then(
      (c) => {
        setGerando(false);
        setConvite(c);
      },
      (e: unknown) => {
        setGerando(false);
        setErro(e);
      },
    );
  };

  const copiar = (texto: string, oque: string) => {
    Clipboard.setStringAsync(texto).then(
      () => avisar(`${oque} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const abrirForm = () => {
    setDefinido(null);
    setConvite(null);
    setErro(null);
    setDefinindo(true);
  };

  const selo = seloDoAcesso(aluno);
  // Inativo ou anonimizado: o acesso não muda daqui (reativar primeiro).
  const podeAgir = aluno.ativo && !aluno.anonimizado;
  const mostrarAcoes = podeAgir && !definindo;
  const conviteAnterior = !convite && aluno.conviteExpiraEm;

  let explicacao: string;
  if (!aluno.temAcesso) {
    explicacao = conviteAnterior
      ? `Há um convite válido até ${dataHoraParaTela(aluno.conviteExpiraEm)}. Gerar outro invalida o anterior.`
      : 'Gere um convite para o aluno criar a conta dele no app ou defina você o e-mail e uma senha provisória.';
  } else if (aluno.aguardandoPrimeiroAcesso) {
    explicacao = aluno.emailDeAcesso
      ? `O aluno entra com ${aluno.emailDeAcesso} e a senha provisória e cria a senha dele.`
      : 'O aluno entra com a senha provisória e cria a senha dele.';
  } else {
    explicacao = aluno.emailDeAcesso ? `Entra com ${aluno.emailDeAcesso}.` : 'O aluno já criou a conta e entra com o e-mail e a senha dele.';
  }

  return (
    <View accessibilityLabel="Acesso ao app" style={estilos.bloco}>
      <CamposEmLinha minimo={180}>
        <View style={estilos.campo} accessibilityLabel={`Acesso ao app: ${selo.texto}`}>
          <Texto variante="rotulo">Acesso ao app</Texto>
          <Selo texto={selo.texto} tipo={selo.tipo} />
        </View>
        <CampoLeitura rotulo="Usuário no app" valor={aluno.emailDeAcesso} />
        {!definindo ? (
          <View style={estilos.campo}>
            <Texto variante="rotulo">Senha</Texto>
            {mostrarAcoes ? (
              <Permitido codigo="ALUNO_CONVITE">
                <Botao
                  rotulo={aluno.temAcesso ? (aluno.aguardandoPrimeiroAcesso ? 'Definir outra senha' : 'Definir nova senha') : 'Definir e-mail e senha'}
                  tipo="secundario"
                  aoTocar={abrirForm}
                />
              </Permitido>
            ) : (
              <Texto>—</Texto>
            )}
          </View>
        ) : null}
        {!aluno.temAcesso && mostrarAcoes ? (
          <View style={estilos.campo}>
            <Texto variante="rotulo">Convite</Texto>
            <Permitido codigo="ALUNO_CONVITE">
              <Botao
                rotulo={convite || conviteAnterior ? 'Gerar outro convite' : 'Gerar convite'}
                tipo={convite ? 'secundario' : 'primario'}
                carregando={gerando}
                aoTocar={() => (convite || conviteAnterior ? setConfirmar(true) : gerar())}
              />
            </Permitido>
          </View>
        ) : null}
      </CamposEmLinha>
      {definido ? (
        <View style={estilos.convite}>
          <Texto variante="suave">Passe ao aluno o e-mail e esta senha. Ela não aparece de novo.</Texto>
          <Destaque rotulo="E-mail de acesso" texto={definido.email} aoCopiar={() => copiar(definido.email, 'E-mail')} />
          <Destaque rotulo="Senha provisória" texto={definido.senha} aoCopiar={() => copiar(definido.senha, 'Senha')} grande />
        </View>
      ) : convite ? (
        <View style={estilos.convite}>
          <Texto variante="suave">
            Envie o link ou o código para o aluno. Válido até {dataHoraParaTela(convite.expiraEm)}. O código não
            aparece de novo depois que você sair desta tela.
          </Texto>
          <Destaque rotulo="Código" texto={convite.codigo} aoCopiar={() => copiar(convite.codigo, 'Código')} grande />
          <Destaque rotulo="Link" texto={convite.link} aoCopiar={() => copiar(convite.link, 'Link')} />
        </View>
      ) : (
        <Texto variante="suave">{explicacao}</Texto>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {definindo ? (
        <FormAcesso
          aluno={aluno}
          aoCancelar={() => setDefinindo(false)}
          aoSalvar={(novo, dados) => {
            setDefinindo(false);
            setDefinido(dados);
            aoAlterar(novo);
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={confirmar}
        titulo="Gerar outro convite?"
        mensagem="O código e o link anteriores param de funcionar."
        rotuloConfirmar="Gerar outro"
        aoConfirmar={gerar}
        aoCancelar={() => setConfirmar(false)}
      />
    </View>
  );
}

/** E-mail de login e senha provisória. A senha fica só no estado desta tela (nunca em armazenamento). */
function FormAcesso({ aluno, aoCancelar, aoSalvar }: {
  aluno: AlunoDetalhe;
  aoCancelar: () => void;
  aoSalvar: (aluno: AlunoDetalhe, dados: { email: string; senha: string }) => void;
}) {
  const [email, setEmail] = useState(aluno.emailDeAcesso ?? aluno.email ?? '');
  const [senha, setSenha] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const salvar = () => {
    setConfirmar(false);
    setSalvando(true);
    setErro(null);
    const dados = { email: email.trim(), senha };
    definirAcessoDoAluno(aluno.id, dados).then(
      (novo) => {
        setSalvando(false);
        aoSalvar(novo, { email: novo.emailDeAcesso ?? dados.email, senha });
      },
      (e: unknown) => {
        setSalvando(false);
        if (codigoApi(e) === 'EMAIL_EM_USO') {
          setCampos({ email: textoDoErro(e) });
          return;
        }
        setCampos(errosPorCampo(e));
        setErro(textoDoErro(e));
      },
    );
  };

  const enviar = () => {
    const locais: Record<string, string> = {};
    if (!email.trim()) locais.email = 'Informe o e-mail.';
    if (senha.length < 8) locais.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    setCampos(locais);
    if (Object.keys(locais).length) return;
    // Quem já tem conta perde as sessões abertas: confirma antes.
    if (aluno.temAcesso) setConfirmar(true);
    else salvar();
  };

  return (
    <View style={estilos.form}>
      <Campo rotulo="E-mail de acesso" valor={email} aoMudar={setEmail} erro={campos.email} autoCapitalize="none"
        keyboardType="email-address" inputMode="email" autoComplete="off" maxLength={254} />
      <CampoSenha rotulo="Senha provisória" valor={senha} aoMudar={setSenha} erro={campos.senha} autoComplete="new-password"
        ajuda="No primeiro acesso o aluno troca esta senha pela dele." maxLength={72} />
      <LinhaDeAcoes>
        <Botao rotulo="Gerar senha" tipo="fantasma" aoTocar={() => setSenha(gerarSenhaProvisoria())} />
      </LinhaDeAcoes>
      {erro ? <MensagemErro texto={erro} /> : null}
      <LinhaDeAcoes alinhar="fim">
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={aoCancelar} />
        <Botao rotulo="Salvar" aoTocar={enviar} carregando={salvando} />
      </LinhaDeAcoes>
      <PainelConfirmacao
        visivel={confirmar}
        titulo="Definir nova senha?"
        mensagem="As sessões abertas do aluno serão encerradas e ele vai precisar da senha nova."
        rotuloConfirmar="Definir senha"
        aoConfirmar={salvar}
        aoCancelar={() => setConfirmar(false)}
      />
    </View>
  );
}

function Destaque({ rotulo, texto, aoCopiar, grande }: { rotulo: string; texto: string; aoCopiar: () => void; grande?: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.destaque, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.textoDestaque}>
        <Texto variante="pequeno">{rotulo}</Texto>
        <Texto selectable style={grande ? estilos.codigo : estilos.link}>{texto}</Texto>
      </View>
      <Botao rotulo="Copiar" rotuloAcessivel={`Copiar ${rotulo.toLowerCase()}`} tipo="secundario" Icone={Copy} aoTocar={aoCopiar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  campo: { gap: espaco(0.25) },
  convite: { gap: espaco(1.5) },
  form: { gap: espaco(1.5) },
  destaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    flexWrap: 'wrap',
  },
  textoDestaque: { flex: 1, minWidth: 180, gap: 2 },
  codigo: { fontFamily: fontes.negrito, fontSize: 24, letterSpacing: 3 },
  link: { fontFamily: fontes.normal, fontSize: 14 },
});
