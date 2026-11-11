import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Settings } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import type { ConfiguracaoInscricao } from '../../api/inscricoesTipos';
import { alterarConfiguracaoInscricao, configuracaoInscricao, novoLinkInscricao } from '../../api/rotas';
import { LIMITES_INSCRICAO, SEM_FORMULARIO_PADRAO } from '../../dominio/inscricoes';
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

/**
 * Link de inscrição da consultoria, em faixa compacta (a fila de interessados é o que importa na tela): situação,
 * copiar e "Configurar", que abre a folha com ligar/desligar, gerar novo (o anterior para de valer), responsável padrão
 * das inscrições novas e o texto de apresentação e privacidade (com texto, o interessado marca a ciência). Quem só lê
 * vê a situação e copia o link aberto.
 */
export function CartaoLinkInscricao({ podeAlterar, responsaveis }: { podeAlterar: boolean; responsaveis: readonly ResponsavelEquipe[] }) {
  const config = useCarregar('inscricao-configuracao', () => configuracaoInscricao());
  if (config.erro) {
    // 404 = a consultoria não tem formulário de inscrição padrão (a API não devolve mais "desligado").
    if (config.erro instanceof ErroApi && config.erro.status === 404) {
      return <FaixaDoLink><Texto variante="suave">{SEM_FORMULARIO_PADRAO}</Texto></FaixaDoLink>;
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
  return <Formulario key={String(config.dados.versao)} config={config.dados} podeAlterar={podeAlterar}
    responsaveis={responsaveis} aoGravar={config.definir} aoConflito={config.recarregar} />;
}

function Formulario({ config, podeAlterar, responsaveis, aoGravar, aoConflito }: {
  config: ConfiguracaoInscricao;
  podeAlterar: boolean;
  responsaveis: readonly ResponsavelEquipe[];
  aoGravar: (c: ConfiguracaoInscricao) => void;
  aoConflito: () => void;
}) {
  const { avisar } = useAviso();
  const [aberta, setAberta] = useState(config.aberta);
  const [responsavelId, setResponsavelId] = useState(config.responsavelId ?? SEM_RESPONSAVEL);
  const [texto, setTexto] = useState(config.texto ?? '');
  const [salvando, setSalvando] = useState(false);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  // Fechar sem salvar volta os campos ao que está gravado.
  const fecharConfiguracao = () => {
    setConfigurando(false);
    setAberta(config.aberta);
    setResponsavelId(config.responsavelId ?? SEM_RESPONSAVEL);
    setTexto(config.texto ?? '');
    setErro(null);
  };
  const [erro, setErro] = useState<unknown>(null);

  const mudou = aberta !== config.aberta || responsavelId !== (config.responsavelId ?? SEM_RESPONSAVEL)
    || texto.trim() !== (config.texto ?? '');
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
    aberta, responsavelId: responsavelId || null, texto: texto.trim() || null, versao: config.versao,
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
      </LinhaDeAcoes> : null}>
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
            <Botao rotulo="Gerar novo link" tipo="secundario" Icone={RefreshCw} desabilitado={mudou || salvando}
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
 * Faixa curta do link (padrão P5: a situação e as ações moram na própria faixa): título e situação numa linha, o link
 * cortado numa linha (copiar leva o inteiro) e Copiar/Configurar à direita, que descem para baixo no celular. Mesma
 * casca no carregando, no erro e sem formulário, para a fila não pular quando o link chega.
 */
function FaixaDoLink({ situacao, acoes, children }: { situacao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.faixa, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: cores.superficie }]}>
      <View style={estilos.textos}>
        <View style={estilos.titulo}>
          <Texto nivel={2} style={estilos.nome}>Link de inscrição</Texto>
          {situacao}
        </View>
        {children}
      </View>
      {acoes}
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(1.5),
    borderRadius: RAIO,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(1.25),
  },
  textos: { flex: 1, minWidth: 220, gap: 2 },
  titulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  nome: { fontFamily: fontes.semi },
});
