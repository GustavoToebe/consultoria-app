import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { definirAcessoDoAluno, gerarConvite } from '../api/rotas';
import type { AlunoDetalhe, ConviteGerado } from '../api/tipos';
import { seloDoAcesso } from '../dominio/cadastroDoAluno';
import { ultimoAcessoNaFicha } from '../dominio/fichaDados';
import { dataHoraParaTela } from '../dominio/formatos';
import { gerarSenhaProvisoria } from '../dominio/senhaProvisoria';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Acesso do aluno ao app. Sem conta: gera o convite (código de 10 letras e link, válidos por 7 dias; gerar outro
 * invalida o anterior) ou o treinador define e-mail e senha provisória. Com conta: "Definir nova senha" troca a senha
 * (e o e-mail de login, se mudou) e encerra as sessões do aluno. A senha provisória o aluno troca no primeiro login; ela
 * e o código do convite só aparecem nesta tela, uma vez. Cartão próprio e compacto (Ficha › Dados, 23/11): o selo e a
 * frase "Entra com <e-mail>" numa linha, o último login embaixo (`dominio/fichaDados.ultimoAcessoNaFicha`) e as ações no
 * cabeçalho.
 */
export function CartaoAcesso({ aluno, aoAlterar }: { aluno: AlunoDetalhe; aoAlterar: (aluno: AlunoDetalhe) => void }) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
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

  const rotuloDaSenha = aluno.temAcesso ? (aluno.aguardandoPrimeiroAcesso ? 'Definir outra senha' : 'Definir nova senha') : 'Definir e-mail e senha';
  const ultimo = ultimoAcessoNaFicha(aluno.ultimoAcesso);
  // Sem conta, o convite é o caminho em destaque e "Definir e-mail e senha" a alternativa, ao lado (duas ações: cabem no
  // cabeçalho sem o ⋯); com conta, só a senha. Abertos o formulário, o convite ou a senha, as ações saem do cabeçalho.
  const acoes = mostrarAcoes && pode('ALUNO_CONVITE') ? (
    aluno.temAcesso ? <Botao rotulo={rotuloDaSenha} tipo="secundario" aoTocar={abrirForm} /> : (
      <View style={estilos.caminhos}>
        <Botao
          rotulo={convite || conviteAnterior ? 'Gerar outro convite' : 'Gerar convite'}
          tipo={convite ? 'secundario' : 'primario'}
          carregando={gerando}
          aoTocar={() => (convite || conviteAnterior ? setConfirmar(true) : gerar())}
        />
        <Botao rotulo={rotuloDaSenha} tipo="secundario" aoTocar={abrirForm} />
      </View>
    )
  ) : undefined;
  return (
    // Cartão compacto (23/11): situação e "Entra com <e-mail>" numa linha, o último login embaixo e as ações no cabeçalho.
    // O rótulo do bloco envolve o cartão inteiro (cabeçalho incluído): é por ele que o "Abrir acesso ao app" do Resumo chega.
    <View accessibilityLabel="Acesso ao app">
      <Cartao titulo="Acesso ao app" acoes={acoes}>
        <View style={estilos.bloco}>
          <View style={estilos.linhaDoSelo}>
            <View accessibilityLabel={`Acesso ao app: ${selo.texto}`}><Selo texto={selo.texto} tipo={selo.tipo} /></View>
            {/* Com a senha ou o convite na tela, eles dizem o que fazer; a frase de sempre volta depois. */}
            {definido || convite ? null : <Texto variante="suave" style={estilos.explicacao}>{explicacao}</Texto>}
          </View>
          {ultimo ? <UltimoAcesso texto={ultimo.texto} exata={ultimo.exata} /> : null}
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
          ) : null}
          {!podeAgir ? (
            <Texto variante="pequeno">
              {aluno.anonimizado ? 'Aluno anonimizado: o acesso não muda mais.' : 'Aluno inativo: reative pelo menu ⋯ para mudar o acesso.'}
            </Texto>
          ) : null}
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
        </View>
      </Cartao>
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

/**
 * "Último login: há 2 dias" em texto suave; a data exata vai na dica do mouse (na web, o `title` direto no elemento: o
 * react-native-web não o repassa) e no nome acessível, porque o hover não pode ser o único caminho até ela.
 */
function UltimoAcesso({ texto, exata }: { texto: string; exata: string }) {
  const comDica = (el: View | null) => {
    if (Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', exata);
  };
  return (
    <View ref={comDica} accessibilityLabel={`${texto} (${exata})`} style={estilos.ultimo}>
      <Texto variante="pequeno">{texto}</Texto>
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
  linhaDoSelo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  explicacao: { flexShrink: 1, minWidth: 0 },
  ultimo: { alignSelf: 'flex-start' },
  caminhos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
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
