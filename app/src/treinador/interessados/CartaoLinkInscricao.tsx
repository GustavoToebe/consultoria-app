import * as Clipboard from 'expo-clipboard';
import { Copy, Plus, RefreshCw, Settings } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import {
  alterarConfiguracaoLinkQuestionario,
  configuracaoLinkQuestionario,
  criarFichaRapida,
  esconderCamposDoLinkQuestionario,
  listarLinksDeInscricao,
  novoLinkQuestionario,
} from '../../api/fichaRapida';
import type { CampoDaInscricao, ConfiguracaoInscricao, LinkDeInscricao } from '../../api/inscricoesTipos';
import { alterarConfiguracaoInscricao, configuracaoInscricao, novoLinkInscricao } from '../../api/rotas';
import {
  alternarCampoOculto,
  CAMPOS_DA_INSCRICAO,
  LIMITES_INSCRICAO,
  SEM_FORMULARIO_PADRAO,
} from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Folha } from '../../ui/Folha';
import { Esqueleto } from '../../ui/Esqueleto';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const SEM_RESPONSAVEL = '';
const AJUDA_DO_PRECO = 'Os planos ativos do Financeiro aparecem para a pessoa escolher. Desligado, só o nome e o período; ligado, também o valor.';

/**
 * Link de inscrição da consultoria, em faixa compacta (a fila de interessados é o que importa na tela): situação,
 * copiar e "Configurar", que abre a folha com ligar/desligar, gerar novo (o anterior para de valer), responsável padrão
 * das inscrições novas e o texto de apresentação e privacidade (com texto, o interessado marca a ciência). Quem só lê
 * vê a situação e copia o link aberto.
 *
 * Também lista os links públicos secundários (como a Ficha rápida pós-WhatsApp) ou oferece criá-la quando ainda não há.
 */
export function CartaoLinkInscricao({ podeAlterar, responsaveis }: { podeAlterar: boolean; responsaveis: readonly ResponsavelEquipe[] }) {
  const config = useCarregar('inscricao-configuracao', () => configuracaoInscricao());
  const links = useCarregar('inscricoes-links', () => listarLinksDeInscricao());
  const extras = (links.dados ?? []).filter((l) => !l.padrao);

  if (config.erro) {
    // 404 = a consultoria não tem formulário de inscrição padrão (a API não devolve mais "desligado").
    if (config.erro instanceof ErroApi && config.erro.status === 404) {
      return (
        <FaixaDoLink>
          <Texto variante="suave">{SEM_FORMULARIO_PADRAO}</Texto>
          <SubsecaoLinksExtras extras={extras} podeAlterar={podeAlterar} responsaveis={responsaveis} aoMudar={links.recarregar} />
        </FaixaDoLink>
      );
    }
    return (
      <FaixaDoLink>
        <MensagemErro texto={textoDoErro(config.erro)} tentarDeNovo={config.recarregar} erro={config.erro} />
      </FaixaDoLink>
    );
  }
  if (!config.dados) {
    return <FaixaDoLink><Esqueleto texto="Carregando o link de inscrição" cartoes={1} /></FaixaDoLink>;
  }
  // `key` pela versão: depois de salvar (ou recarregar), o formulário volta ao que está gravado.
  return (
    <Formulario
      key={String(config.dados.versao)}
      config={config.dados}
      extras={extras}
      podeAlterar={podeAlterar}
      responsaveis={responsaveis}
      aoGravar={config.definir}
      aoConflito={config.recarregar}
      aoMudarExtras={links.recarregar}
    />
  );
}

function Formulario({ config, extras, podeAlterar, responsaveis, aoGravar, aoConflito, aoMudarExtras }: {
  config: ConfiguracaoInscricao;
  extras: readonly LinkDeInscricao[];
  podeAlterar: boolean;
  responsaveis: readonly ResponsavelEquipe[];
  aoGravar: (c: ConfiguracaoInscricao) => void;
  aoConflito: () => void;
  aoMudarExtras: () => void;
}) {
  const { avisar } = useAviso();
  const [aberta, setAberta] = useState(config.aberta);
  const [responsavelId, setResponsavelId] = useState(config.responsavelId ?? SEM_RESPONSAVEL);
  const [texto, setTexto] = useState(config.texto ?? '');
  const [mostrarPreco, setMostrarPreco] = useState(!!config.mostrarPrecoDosPlanos);
  const [salvando, setSalvando] = useState(false);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  // Fechar sem salvar volta os campos ao que está gravado.
  const fecharConfiguracao = () => {
    setConfigurando(false);
    setAberta(config.aberta);
    setResponsavelId(config.responsavelId ?? SEM_RESPONSAVEL);
    setTexto(config.texto ?? '');
    setMostrarPreco(!!config.mostrarPrecoDosPlanos);
    setErro(null);
  };
  const [erro, setErro] = useState<unknown>(null);

  const mudou = aberta !== config.aberta || responsavelId !== (config.responsavelId ?? SEM_RESPONSAVEL)
    || texto.trim() !== (config.texto ?? '') || mostrarPreco !== !!config.mostrarPrecoDosPlanos;
  const nomeDoResponsavel = responsaveis.find((r) => r.id === config.responsavelId)?.nome;

  const gravar = (acao: () => Promise<ConfiguracaoInscricao>, sucesso: string) => {
    setSalvando(true);
    setErro(null);
    acao().then(
      (c) => {
        setSalvando(false);
        setConfigurando(false);
        aoGravar(c);
        avisar(sucesso, 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        if (codigoApi(e) === 'CONFLITO_EDICAO') {
          avisar('O link foi alterado em outro lugar. Recarregamos para você conferir.', 'neutro');
          aoConflito();
          return;
        }
        setErro(e);
      },
    );
  };

  const salvar = () => gravar(() => alterarConfiguracaoInscricao({
    aberta, responsavelId: responsavelId || null, texto: texto.trim() || null, versao: config.versao, mostrarPrecoDosPlanos: mostrarPreco,
  }), aberta ? 'Link de inscrição salvo.' : 'Link de inscrição salvo (desligado).');

  const gerarNovo = () => {
    setConfirmarNovo(false);
    gravar(() => novoLinkInscricao(config.versao), 'Novo link gerado. O anterior parou de funcionar.');
  };

  const copiar = (link: string) => {
    Clipboard.setStringAsync(link).then(
      () => avisar('Link copiado.', 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const configurar = podeAlterar ? () => setConfigurando(true) : undefined;
  return (
    <FaixaDoLink
      situacao={<Selo texto={config.aberta ? 'Recebendo inscrições' : 'Desligado'} tipo={config.aberta ? 'sucesso' : 'neutro'} />}
      acoes={config.link || configurar ? <LinhaDeAcoes>
        {config.link ? <Botao rotulo="Copiar link" tipo="secundario" Icone={Copy} aoTocar={() => copiar(config.link ?? '')} /> : null}
        {configurar ? <Botao rotulo="Configurar" tipo="secundario" Icone={Settings} aoTocar={configurar} /> : null}
      </LinhaDeAcoes> : null}
      rodape={<SubsecaoLinksExtras extras={extras} podeAlterar={podeAlterar} responsaveis={responsaveis} aoMudar={aoMudarExtras} />}>
      {config.link ? (
        <Texto variante="suave" selectable numberOfLines={1}>{config.link}</Texto>
      ) : (
        <Texto variante="suave">{podeAlterar ? 'Ligue a inscrição para gerar o link.' : 'O link ainda não foi gerado.'}</Texto>
      )}
      {!podeAlterar ? (
        <Texto variante="pequeno">Responsável pelas novas: {config.responsavelId ? nomeDoResponsavel ?? 'Membro inativo' : 'Sem responsável'}</Texto>
      ) : null}
      {configurando ? (
        <Folha visivel titulo="Configurar o link de inscrição" aoFechar={fecharConfiguracao} rodape={<>
          {config.codigo ? (
            <Botao rotulo="Gerar novo link" tipo="acao" Icone={RefreshCw} desabilitado={mudou || salvando}
              motivo="Salve ou desfaça as alterações antes." aoTocar={() => setConfirmarNovo(true)} />
          ) : null}
          <Botao rotulo="Salvar configuração" aoTocar={salvar} carregando={salvando} desabilitado={!mudou}
            motivo="Nada mudou desde o último salvar." />
        </>}>
          <Texto variante="suave">Divulgue o link (Instagram, WhatsApp, site). Quem se inscreve aparece na lista; ninguém vira aluno sem você aceitar.</Texto>
          <Interruptor rotulo="Receber inscrições pelo link" valor={aberta} aoMudar={setAberta}
            ajuda="Desligado, o link mostra que a inscrição está encerrada." />
          <EscolhaEmFolha rotulo="Responsável pelas novas" titulo="Responsável padrão" valor={responsavelId}
            aoMudar={setResponsavelId}
            opcoes={[{ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]}
            rotuloDoValor={nomeDoResponsavel ?? 'Membro inativo'} />
          <Campo rotulo="Texto de apresentação e privacidade (opcional)" valor={texto} aoMudar={setTexto} linhas={5}
            maxLength={LIMITES_INSCRICAO.texto}
            ajuda="Aparece na página de inscrição; com texto, a pessoa marca que leu antes de enviar. Diga como a consultoria usa os dados." />
          <Interruptor rotulo="Mostrar o preço dos planos na página de inscrição" valor={mostrarPreco} aoMudar={setMostrarPreco}
            ajuda={AJUDA_DO_PRECO} />
          {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
          <PainelConfirmacao visivel={confirmarNovo} titulo="Gerar novo link?"
            mensagem="O link atual para de funcionar na hora: quem tiver o antigo vê a inscrição encerrada. As inscrições já recebidas não mudam."
            rotuloConfirmar="Gerar novo link" aoConfirmar={gerarNovo} aoCancelar={() => setConfirmarNovo(false)} />
        </Folha>
      ) : null}
    </FaixaDoLink>
  );
}

/**
 * Links públicos secundários (ex.: Ficha rápida pós-WhatsApp) exibidos abaixo do link principal.
 * Quando ainda não há nenhum link secundário e a equipe pode alterar, oferece o botão compacto para criar a ficha rápida.
 */
function SubsecaoLinksExtras({ extras, podeAlterar, responsaveis, aoMudar }: {
  extras: readonly LinkDeInscricao[];
  podeAlterar: boolean;
  responsaveis: readonly ResponsavelEquipe[];
  aoMudar: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinkDeInscricao | null>(null);

  if (extras.length === 0 && !podeAlterar) return null;

  const criar = () => {
    if (criando) return;
    setCriando(true);
    criarFichaRapida().then(
      () => {
        setCriando(false);
        aoMudar();
        avisar('Ficha rápida criada.', 'sucesso');
      },
      (e: unknown) => {
        setCriando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  const copiar = (link: string, nome: string) => {
    Clipboard.setStringAsync(link).then(
      () => avisar(`Link de ${nome} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  return (
    <View style={[estilos.extras, { borderTopColor: cores.divisor }]}>
      {extras.length === 0 ? (
        <View style={estilos.linhaExtra}>
          <View style={estilos.textos}>
            <Texto nivel={3} style={estilos.nome}>Ficha rápida</Texto>
            <Texto variante="suave">Formulário curto pós-WhatsApp (nome, WhatsApp, e-mail e plano).</Texto>
          </View>
          <LinhaDeAcoes>
            <Botao rotulo="Criar ficha rápida" tipo="secundario" Icone={Plus} carregando={criando} aoTocar={criar} />
          </LinhaDeAcoes>
        </View>
      ) : (
        extras.map((extra, indice) => (
          <View key={extra.id} style={[estilos.linhaExtra, indice > 0 ? { borderTopWidth: 1, borderTopColor: cores.divisor, paddingTop: espaco(1.25) } : null]}>
            <View style={estilos.textos}>
              <View style={estilos.titulo}>
                <Texto nivel={3} style={estilos.nome}>{extra.nome}</Texto>
                <Selo texto={extra.aberta ? 'Recebendo inscrições' : 'Fechado'} tipo={extra.aberta ? 'sucesso' : 'neutro'} />
              </View>
              {extra.link ? (
                <Texto variante="suave" selectable numberOfLines={1}>{extra.link}</Texto>
              ) : (
                <Texto variante="suave">{podeAlterar ? 'Ligue o link em Configurar para gerar o endereço.' : 'O link ainda não foi gerado.'}</Texto>
              )}
            </View>
            {extra.link || podeAlterar ? (
              <LinhaDeAcoes>
                {extra.link ? (
                  <Botao
                    rotulo="Copiar link"
                    rotuloAcessivel={`Copiar link de ${extra.nome}`}
                    tipo="secundario"
                    Icone={Copy}
                    aoTocar={() => copiar(extra.link ?? '', extra.nome)}
                  />
                ) : null}
                {podeAlterar ? (
                  <Botao
                    rotulo="Configurar"
                    rotuloAcessivel={`Configurar ${extra.nome}`}
                    tipo="secundario"
                    Icone={Settings}
                    aoTocar={() => setEditando(extra)}
                  />
                ) : null}
              </LinhaDeAcoes>
            ) : null}
          </View>
        ))
      )}
      {editando ? (
        <FolhaConfiguracaoLinkExtra
          link={editando}
          responsaveis={responsaveis}
          aoFechar={() => setEditando(null)}
          aoMudar={aoMudar}
        />
      ) : null}
    </View>
  );
}

/** Folha de configuração de um link secundário (`/questionarios/${id}/link*`). */
function FolhaConfiguracaoLinkExtra({ link, responsaveis, aoFechar, aoMudar }: {
  link: LinkDeInscricao;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const detalhe = useCarregar(`questionario-link:${link.id}`, () => configuracaoLinkQuestionario(link.id));
  if (detalhe.erro) {
    return (
      <Folha visivel titulo={`Configurar ${link.nome}`} aoFechar={aoFechar}>
        <MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} erro={detalhe.erro} />
      </Folha>
    );
  }
  if (!detalhe.dados) {
    return (
      <Folha visivel titulo={`Configurar ${link.nome}`} aoFechar={aoFechar}>
        <Esqueleto />
      </Folha>
    );
  }
  return (
    <FormularioLinkExtra
      key={String(detalhe.dados.versao)}
      id={link.id}
      nome={link.nome}
      config={detalhe.dados}
      responsaveis={responsaveis}
      aoFechar={aoFechar}
      aoGravar={(c) => { detalhe.definir(c); aoMudar(); }}
      aoConflito={() => { detalhe.recarregar(); aoMudar(); }}
    />
  );
}

function FormularioLinkExtra({ id, nome, config, responsaveis, aoFechar, aoGravar, aoConflito }: {
  id: string;
  nome: string;
  config: ConfiguracaoInscricao;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  aoGravar: (c: ConfiguracaoInscricao) => void;
  aoConflito: () => void;
}) {
  const { avisar } = useAviso();
  const [aberta, setAberta] = useState(config.aberta);
  const [responsavelId, setResponsavelId] = useState(config.responsavelId ?? SEM_RESPONSAVEL);
  const [texto, setTexto] = useState(config.texto ?? '');
  const [ocultos, setOcultos] = useState<CampoDaInscricao[]>(config.camposOcultos);
  const [mostrarPreco, setMostrarPreco] = useState(!!config.mostrarPrecoDosPlanos);
  const [salvando, setSalvando] = useState(false);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const mudouConfig = aberta !== config.aberta || responsavelId !== (config.responsavelId ?? SEM_RESPONSAVEL)
    || texto.trim() !== (config.texto ?? '') || mostrarPreco !== !!config.mostrarPrecoDosPlanos;
  const mudouCampos = ocultos.length !== config.camposOcultos.length
    || ocultos.some((c, i) => config.camposOcultos[i] !== c);
  const mudou = mudouConfig || mudouCampos;
  const nomeDoResponsavel = responsaveis.find((r) => r.id === config.responsavelId)?.nome;

  const tratarErro = (e: unknown) => {
    setSalvando(false);
    if (codigoApi(e) === 'CONFLITO_EDICAO') {
      avisar('O link foi alterado em outro lugar. Recarregamos para você conferir.', 'neutro');
      aoConflito();
      return;
    }
    setErro(e);
  };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    (async () => {
      let atual = config;
      if (mudouConfig) {
        atual = await alterarConfiguracaoLinkQuestionario(id, {
          aberta,
          responsavelId: responsavelId || null,
          texto: texto.trim() || null,
          versao: atual.versao,
          mostrarPrecoDosPlanos: mostrarPreco,
        });
      }
      if (mudouCampos) {
        atual = await esconderCamposDoLinkQuestionario(id, ocultos, atual.versao);
      }
      return atual;
    })().then((atual) => {
      setSalvando(false);
      aoGravar(atual);
      aoFechar();
      avisar(aberta ? `${nome} salvo.` : `${nome} salvo (fechado).`, 'sucesso');
    }, tratarErro);
  };

  const gerarNovo = () => {
    setConfirmarNovo(false);
    setSalvando(true);
    setErro(null);
    novoLinkQuestionario(id, config.versao).then((atual) => {
      setSalvando(false);
      aoGravar(atual);
      aoFechar();
      avisar('Novo link gerado. O anterior parou de funcionar.', 'sucesso');
    }, tratarErro);
  };

  return (
    <Folha visivel titulo={`Configurar ${nome}`} aoFechar={aoFechar} rodape={<>
      {config.codigo ? (
        <Botao rotulo="Gerar novo link" tipo="acao" Icone={RefreshCw} desabilitado={mudou || salvando}
          motivo="Salve ou desfaça as alterações antes." aoTocar={() => setConfirmarNovo(true)} />
      ) : null}
      <Botao rotulo="Salvar configuração" aoTocar={salvar} carregando={salvando} desabilitado={!mudou}
        motivo="Nada mudou desde o último salvar." />
    </>}>
      <Texto variante="suave">Link público independente para enviar após a conversa no WhatsApp. Quem preenche entra na fila de Interessados.</Texto>
      <Interruptor rotulo="Receber inscrições pelo link" valor={aberta} aoMudar={setAberta}
        ajuda="Desligado, o link mostra que a inscrição está encerrada." />
      <EscolhaEmFolha rotulo="Responsável pelas novas" titulo="Responsável padrão" valor={responsavelId}
        aoMudar={setResponsavelId}
        opcoes={[{ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]}
        rotuloDoValor={nomeDoResponsavel ?? 'Membro inativo'} />
      <Campo rotulo="Texto de apresentação e privacidade (opcional)" valor={texto} aoMudar={setTexto} linhas={5}
        maxLength={LIMITES_INSCRICAO.texto}
        ajuda="Aparece na página de inscrição; com texto, a pessoa marca que leu antes de enviar." />
      <Interruptor rotulo={`Mostrar o preço dos planos na ${nome.toLocaleLowerCase('pt-BR')}`} valor={mostrarPreco} aoMudar={setMostrarPreco}
        ajuda={AJUDA_DO_PRECO} />
      <View style={estilos.secaoCampos}>
        <Texto variante="secao">Campos fixos visíveis</Texto>
        <Texto variante="pequeno">Nome, WhatsApp e a ciência do texto sempre aparecem.</Texto>
        {CAMPOS_DA_INSCRICAO.map((c) => (
          <Interruptor
            key={c.valor}
            rotulo={`Mostrar "${c.rotulo}"`}
            ajuda={c.uso}
            valor={!ocultos.includes(c.valor)}
            aoMudar={(mostrar) => setOcultos((atual) => alternarCampoOculto(atual, c.valor, !mostrar))}
          />
        ))}
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <PainelConfirmacao visivel={confirmarNovo} titulo="Gerar novo link?"
        mensagem="O link atual para de funcionar na hora: quem tiver o antigo vê a inscrição encerrada. As inscrições já recebidas não mudam."
        rotuloConfirmar="Gerar novo link" aoConfirmar={gerarNovo} aoCancelar={() => setConfirmarNovo(false)} />
    </Folha>
  );
}

/**
 * Faixa curta do link (padrão P5: a situação e as ações moram na própria faixa): título e situação numa linha, o link
 * cortado numa linha (copiar leva o inteiro) e Copiar/Configurar à direita, que descem para baixo no celular. Mesma
 * casca no carregando, no erro e sem formulário, para a fila não pular quando o link chega.
 */
function FaixaDoLink({ situacao, acoes, rodape, children }: { situacao?: ReactNode; acoes?: ReactNode; rodape?: ReactNode; children: ReactNode }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.caixa, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: cores.superficie }]}>
      <View style={estilos.faixa}>
        <View style={estilos.textos}>
          <View style={estilos.titulo}>
            <Texto nivel={2} style={estilos.nome}>Link de inscrição</Texto>
            {situacao}
          </View>
          {children}
        </View>
        {acoes}
      </View>
      {rodape}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    borderRadius: RAIO,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(1.25),
    gap: espaco(1.25),
  },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(1.5),
  },
  extras: {
    borderTopWidth: 1,
    paddingTop: espaco(1.25),
    gap: espaco(1.25),
  },
  linhaExtra: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(1.5),
  },
  textos: { flex: 1, minWidth: 220, gap: 2 },
  titulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  nome: { fontFamily: fontes.semi },
  secaoCampos: { gap: espaco(1) },
});
