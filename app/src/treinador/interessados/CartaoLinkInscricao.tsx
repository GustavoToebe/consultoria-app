import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResponsavelEquipe } from '../../api/equipeTipos';
import type { ConfiguracaoInscricao } from '../../api/inscricoesTipos';
import { alterarConfiguracaoInscricao, configuracaoInscricao, novoLinkInscricao } from '../../api/rotas';
import { LIMITES_INSCRICAO } from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
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
 * Link de inscrição da consultoria: ligar/desligar, copiar, gerar novo (o anterior para de valer), responsável padrão
 * das inscrições novas e o texto de apresentação e privacidade (com texto, o interessado marca a ciência). Quem só lê
 * vê a situação e copia o link aberto.
 */
export function CartaoLinkInscricao({ podeAlterar, responsaveis }: { podeAlterar: boolean; responsaveis: readonly ResponsavelEquipe[] }) {
  const config = useCarregar('inscricao-configuracao', () => configuracaoInscricao());
  if (config.erro) {
    return (
      <Cartao titulo="Link de inscrição">
        <MensagemErro texto={textoDoErro(config.erro)} tentarDeNovo={config.recarregar} erro={config.erro} />
      </Cartao>
    );
  }
  if (!config.dados) {
    return <Cartao titulo="Link de inscrição"><Esqueleto /></Cartao>;
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

  return (
    <Cartao titulo="Link de inscrição"
      descricao="Divulgue o link (Instagram, WhatsApp, site). Quem se inscreve aparece na lista abaixo; ninguém vira aluno sem você aceitar.">
      <View style={estilos.selos}>
        <Selo texto={config.aberta ? 'Recebendo inscrições' : 'Desligado'} tipo={config.aberta ? 'sucesso' : 'neutro'} />
      </View>
      {config.link ? (
        <LinkDestacado link={config.link} aberto={config.aberta} aoCopiar={() => copiar(config.link ?? '')} />
      ) : (
        <Texto variante="suave">{podeAlterar ? 'Ligue a inscrição e salve para gerar o link.' : 'O link ainda não foi gerado.'}</Texto>
      )}
      {podeAlterar ? (
        <View style={estilos.formulario}>
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
          <LinhaDeAcoes>
            <Botao rotulo="Salvar link" aoTocar={salvar} carregando={salvando} desabilitado={!mudou}
              motivo="Nada mudou desde o último salvar." />
            {config.codigo ? (
              <Botao rotulo="Gerar novo link" tipo="secundario" Icone={RefreshCw} desabilitado={mudou || salvando}
                motivo="Salve ou desfaça as alterações antes." aoTocar={() => setConfirmarNovo(true)} />
            ) : null}
          </LinhaDeAcoes>
        </View>
      ) : (
        <CampoLeitura rotulo="Responsável pelas novas" valor={config.responsavelId ? nomeDoResponsavel ?? 'Membro inativo' : 'Sem responsável'} />
      )}
      <PainelConfirmacao visivel={confirmarNovo} titulo="Gerar novo link?"
        mensagem="O link atual para de funcionar na hora: quem tiver o antigo vê a inscrição encerrada. As inscrições já recebidas não mudam."
        rotuloConfirmar="Gerar novo link" aoConfirmar={gerarNovo} aoCancelar={() => setConfirmarNovo(false)} />
    </Cartao>
  );
}

function LinkDestacado({ link, aberto, aoCopiar }: { link: string; aberto: boolean; aoCopiar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.destaque, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.textoDestaque}>
        <Texto variante="pequeno">{aberto ? 'Link para divulgar' : 'Link (desligado)'}</Texto>
        <Texto selectable style={estilos.link}>{link}</Texto>
      </View>
      <Botao rotulo="Copiar link" tipo="secundario" Icone={Copy} aoTocar={aoCopiar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  formulario: { gap: espaco(1.5) },
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
  link: { fontFamily: fontes.normal, fontSize: 14 },
});
