import * as Clipboard from 'expo-clipboard';
import { Copy, Ellipsis } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alunosEmAtraso } from '../api/financeiroContrato';
import { definirAcessoDoAluno, desativarAcessoDoAluno, gerarConvite, pausarAcessoDoAluno, reativarAcessoDoAluno, reativarAcessoPausadoDoAluno } from '../api/rotas';
import type { AlunoDetalhe, ConviteGerado } from '../api/tipos';
import { seloDoAcesso } from '../dominio/cadastroDoAluno';
import { acoesDoAcesso, motivoDoAcesso, notaDoAcessoDesativado, textoDoEmailAlterado, traduzirErroDoAcesso, ultimoLoginNaLinha } from '../dominio/acessoAoApp';
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
import { IconeBotao } from '../ui/IconeBotao';
import { errosPorCampo } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { LinhaDeDado, ListaDeDados } from '../ui/ListaDeDados';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { FolhaAlterarEmailDeAcesso } from './FolhaAlterarEmailDeAcesso';
import { FolhaDeAcoes } from './FolhaDeAcoes';

/**
 * Acesso do aluno ao app. Sem conta: gera o convite (código de 10 letras e link, válidos por 7 dias; gerar outro
 * invalida o anterior) ou o treinador define e-mail e senha provisória. Com conta: "Definir nova senha" troca a senha
 * (e o e-mail de login, se mudou) e encerra as sessões do aluno. A senha provisória o aluno troca no primeiro login; ela
 * e o código do convite só aparecem nesta tela, uma vez. Desde 24/11 (`docs/planos/ficha-acesso-ao-app.md`) é uma
 * `ListaDeDados` (Situação, Convite só sem conta, E-mail de acesso, Último login de `dominio/acessoAoApp`, Senha) com as
 * ações na coluna da direita, todas secundárias; o cabeçalho fica só com o título. Ações só com `ALUNO_CONVITE` e aluno
 * ativo e não anonimizado. Desde 25/11 (`docs/planos/ajustes-da-tarde-25-11.md`, D3): "Alterar e-mail" na linha do e-mail
 * (folha `FolhaAlterarEmailDeAcesso`). Desde 26/11 (`docs/planos/pausar-acesso-por-atraso.md`): um cartão e um selo para
 * o acesso desativado pela equipe (`MANUAL`, "Acesso desativado" neutro com ●) e o pausado por atraso (`ATRASO`, "Acesso
 * pausado" âmbar), com a data na nota e "Reativar acesso" na Situação; o ⋯ "Ações do acesso" no cabeçalho traz "Pausar
 * acesso até quitar" (`FINANCEIRO_ALTERAR`, desabilitado sem cobrança vencida) e "Desativar acesso" (perigo, com painel).
 * Quem vê o quê: `dominio/acessoAoApp.acoesDoAcesso`. Desativado, saem "Alterar e-mail" e a senha (a API os recusa);
 * pausado, ficam (o aluno continua entrando).
 */
export function CartaoAcesso({ aluno, aoAlterar }: { aluno: AlunoDetalhe; aoAlterar: (aluno: AlunoDetalhe) => void }) {
  const { avisar } = useAviso();
  const { pode, pagamentosHabilitados } = useSessao();
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alterandoEmail, setAlterandoEmail] = useState(false);
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);
  const [confirmarPausar, setConfirmarPausar] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mudando, setMudando] = useState<'desativar' | 'reativar' | 'pausar' | null>(null);
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
        setErro(traduzirErroDoAcesso(e).mensagem);
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

  // A cobrança vencida (o mesmo dado da pílula da lista de alunos) só para quem pode pausar; 403/503 ou falha somem: o
  // item fica habilitado e a API decide (409 `SEM_COBRANCA_VENCIDA`).
  // shortcut: a rota devolve até 2000 ids (`truncado`); fora da lista truncada o item fica habilitado; trocar por um campo da ficha se passar disso.
  const podeFinanceiro = pode('FINANCEIRO_ALTERAR');
  const pausarVisivel = pagamentosHabilitados && pode('FINANCEIRO_LER') && pode('ALUNO_LER');
  const consultaAtraso = podeFinanceiro && pausarVisivel && aluno.ativo && !aluno.anonimizado && aluno.temAcesso && !aluno.acessoDesativadoMotivo;
  const atraso = useCarregar(consultaAtraso ? 'alunos-em-atraso|false' : null, () => alunosEmAtraso(false).catch(() => null)).dados;
  const emAtraso = !atraso ? null : atraso.alunoIds.includes(aluno.id) ? true : atraso.truncado ? null : false;
  const motivo = motivoDoAcesso(aluno);
  const acoes = acoesDoAcesso(aluno, { convite: pode('ALUNO_CONVITE'), financeiro: podeFinanceiro, pausarVisivel }, emAtraso);

  // Desativar, pausar ou reativar: o destaque da senha ou do convite some (numa conta desativada ele enganaria).
  const mudarAcesso = (qual: 'desativar' | 'reativar' | 'pausar') => {
    if (mudando) return;
    setMudando(qual);
    setErro(null);
    const chamada = qual === 'desativar' ? desativarAcessoDoAluno(aluno.id)
      : qual === 'pausar' ? pausarAcessoDoAluno(aluno.id)
        : acoes.reativar === 'pausa' ? reativarAcessoPausadoDoAluno(aluno.id) : reativarAcessoDoAluno(aluno.id);
    chamada.then(
      (novo) => {
        setMudando(null);
        setConfirmarDesativar(false);
        setConfirmarPausar(false);
        setDefinido(null);
        setConvite(null);
        setDefinindo(false);
        aoAlterar(novo);
        avisar(qual === 'desativar' ? 'Acesso desativado. As sessões do aluno foram encerradas.'
          : qual === 'pausar' ? 'Acesso pausado até o aluno quitar as cobranças vencidas.' : 'Acesso reativado.', 'sucesso');
      },
      (e: unknown) => {
        setMudando(null);
        setConfirmarDesativar(false);
        setConfirmarPausar(false);
        setErro(traduzirErroDoAcesso(e).mensagem);
      },
    );
  };

  const selo = seloDoAcesso(aluno);
  // Inativo ou anonimizado: o acesso não muda daqui (reativar primeiro).
  const podeAgir = aluno.ativo && !aluno.anonimizado;
  // Com o formulário aberto as ações das linhas saem (ele diz o que fazer); voltam ao salvar ou cancelar.
  const comAcoes = podeAgir && !definindo && pode('ALUNO_CONVITE');
  // Desativado pela equipe só cabe reativar (a API recusa senha, e-mail e convite); pausado por atraso, a conta segue.
  const naConta = comAcoes && aluno.temAcesso && motivo !== 'MANUAL';
  const notaDoMotivo = motivo && podeAgir ? notaDoAcessoDesativado(motivo, aluno.acessoDesativadoEm) : undefined;
  const comMenu = !definindo && (!!acoes.pausar || acoes.desativar);
  const validoAte = convite?.expiraEm ?? aluno.conviteExpiraEm ?? null;
  const conviteAnterior = !convite && !!aluno.conviteExpiraEm;
  const rotuloDaSenha = aluno.temAcesso ? (aluno.aguardandoPrimeiroAcesso ? 'Definir outra senha' : 'Definir nova senha') : 'Definir e-mail e senha';
  const ultimo = ultimoLoginNaLinha(aluno.ultimoAcesso);
  const email = aluno.emailDeAcesso?.trim() || null;
  return (
    // Lista de dados (24/11): Situação, Convite (só sem conta), E-mail de acesso, Último login e Senha, com as ações na
    // coluna da direita. O rótulo do bloco envolve o cartão inteiro: é por ele que o "Abrir acesso ao app" do Resumo chega.
    <View accessibilityLabel="Acesso ao app">
      <Cartao titulo="Acesso ao app"
        acoes={comMenu ? <IconeBotao Icone={Ellipsis} moldura rotulo="Ações do acesso" aoTocar={() => setMenu(true)} /> : undefined}>
        <View style={estilos.bloco}>
          <ListaDeDados>
            {/* A data fica na nota: o selo tem as mesmas palavras do cabeçalho e da lista (26/11). */}
            <LinhaDeDado rotulo="Situação" valor={selo.texto} conteudo={<View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} ponto={selo.ponto} /></View>}
              nota={!aluno.temAcesso && !motivo && comAcoes && !convite ? 'Gere um convite para o aluno criar a conta ou defina você o e-mail e uma senha provisória.' : notaDoMotivo}
              acoes={acoes.reativar && !definindo ? (
                <Botao rotulo="Reativar acesso" tipo="secundario" tamanho="pequeno" carregando={mudando === 'reativar'} aoTocar={() => mudarAcesso('reativar')} />
              ) : undefined} />
            {!aluno.temAcesso ? (
              <LinhaDeDado rotulo="Convite" valor={validoAte ? `Válido até ${dataHoraParaTela(validoAte)}` : null} numerico
                acoes={comAcoes ? (
                  <Botao rotulo={convite || conviteAnterior ? 'Gerar outro convite' : 'Gerar convite'} tipo="acao" tamanho="pequeno" carregando={gerando}
                    aoTocar={() => (convite || conviteAnterior ? setConfirmar(true) : gerar())} />
                ) : undefined} />
            ) : null}
            <LinhaDeDado rotulo="E-mail de acesso" valor={email}
              acoes={email || naConta ? (
                <>
                  {naConta ? (
                    <Botao rotulo="Alterar e-mail" rotuloAcessivel="Alterar e-mail de acesso" tipo="secundario" tamanho="pequeno"
                      aoTocar={() => { setDefinido(null); setErro(null); setAlterandoEmail(true); }} />
                  ) : null}
                  {email ? (
                    <View style={estilos.iconeNaLinha}>
                      <IconeBotao Icone={Copy} moldura compacto rotulo="Copiar e-mail de acesso" aoTocar={() => copiar(email, 'E-mail')} />
                    </View>
                  ) : null}
                </>
              ) : undefined} />
            <LinhaDeDado rotulo={ultimo.rotulo} valor={ultimo.texto} numerico dica={ultimo.exata ?? undefined} />
            {/* Os pontos são só desenho: o leitor de tela ouve se a senha é a do aluno ou a provisória. */}
            <LinhaDeDado rotulo="Senha" valor={aluno.temAcesso ? (aluno.aguardandoPrimeiroAcesso ? 'provisória' : 'definida') : null}
              conteudo={<Texto aria-hidden>••••••</Texto>}
              nota={aluno.aguardandoPrimeiroAcesso ? 'Provisória: o aluno cria a dele no primeiro login.' : undefined}
              acoes={comAcoes && motivo !== 'MANUAL' ? <Botao rotulo={rotuloDaSenha} tipo="secundario" tamanho="pequeno" aoTocar={abrirForm} /> : undefined} />
          </ListaDeDados>
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
              {aluno.anonimizado ? 'Aluno anonimizado: o acesso não muda mais.' : 'Aluno inativo: reative pelo menu ⋯ do aluno, no topo da ficha, para mudar o acesso.'}
            </Texto>
          ) : null}
          {erro ? <MensagemErro texto={erro} /> : null}
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
      {menu ? (
        <FolhaDeAcoes titulo="Ações do acesso" aoFechar={() => setMenu(false)} acoes={[
          !!acoes.pausar && {
            rotulo: 'Pausar acesso até quitar',
            detalhe: acoes.pausar.motivo ?? 'O aluno entra e vê só as cobranças em aberto até quitar as vencidas.',
            desabilitado: !!acoes.pausar.motivo,
            aoTocar: () => { setErro(null); setConfirmarPausar(true); },
          },
          acoes.desativar && {
            rotulo: 'Desativar acesso',
            detalhe: 'O aluno não entra mais. Nada é apagado.',
            perigo: true,
            aoTocar: () => { setErro(null); setConfirmarDesativar(true); },
          },
        ]} />
      ) : null}
      <PainelConfirmacao
        visivel={confirmarPausar}
        titulo="Pausar acesso até quitar?"
        mensagem="O aluno continua entrando, mas vê só as cobranças em aberto. O acesso volta sozinho quando ele quitar as vencidas, e você pode reativar antes."
        rotuloConfirmar="Pausar acesso"
        carregando={mudando === 'pausar'}
        aoConfirmar={() => mudarAcesso('pausar')}
        aoCancelar={() => { if (!mudando) setConfirmarPausar(false); }}
      />
      <PainelConfirmacao
        visivel={confirmarDesativar}
        titulo="Desativar acesso ao app?"
        mensagem="O aluno não consegue mais entrar e as sessões abertas são encerradas. Nada é apagado: planos, registros e cadastro continuam, e você pode reativar quando quiser."
        rotuloConfirmar="Desativar acesso"
        perigo
        carregando={mudando === 'desativar'}
        aoConfirmar={() => mudarAcesso('desativar')}
        aoCancelar={() => { if (!mudando) setConfirmarDesativar(false); }}
      />
      {alterandoEmail ? (
        <FolhaAlterarEmailDeAcesso aluno={aluno} aoFechar={() => setAlterandoEmail(false)}
          aoSalvar={({ aluno: novo, emailEnviado }) => {
            setAlterandoEmail(false);
            aoAlterar(novo);
            avisar(textoDoEmailAlterado(emailEnviado), emailEnviado ? 'sucesso' : 'atencao');
          }} />
      ) : null}
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
        const t = traduzirErroDoAcesso(e);
        // E-mail em uso fica só no campo; os outros campos vêm do `fieldErrors` (a senha pela `RegrasSenha`).
        setCampos({ ...errosPorCampo(e), ...t.campos });
        setErro(t.mensagem);
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
  // O desenho compacto (32) fica centrado no alvo de 44: -6 alinha a borda dele à do "Definir nova senha" e do "Reativar
  // acesso", sozinho ou depois do "Alterar e-mail" (26/11: antes só sozinho, e com o "Alterar e-mail" sobrava 6 px).
  iconeNaLinha: { marginRight: -espaco(0.75) },
  // O selo não estica na largura do valor.
  selo: { flexDirection: 'row' },
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
