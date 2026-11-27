import { Ellipsis, FilePlus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarContratosDoAluno, renovarLinkDoContrato, type ContratoDetalhe, type ContratoResumo, type LinkDoResponsavel } from '../../api/contratos';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { acoesDoContrato, rotuloDoSignatario, seloDoContrato } from '../../dominio/contratos';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { FolhaDoContrato, useComprovanteDaEquipe } from './FolhaDoContrato';
import { FolhaGerarContrato } from './FolhaGerarContrato';
import { FolhaLinkDoResponsavel, PainelCancelarContrato, PainelProrrogarContrato } from './PaineisDoContrato';

const SEM_INTERNET = 'Confira a internet e tente de novo.';
const dia = (iso: string) => dataParaTela(dataEmBrasilia(iso));
const metadados = (c: ContratoResumo) => [
  // O par de 16 a 17 anos são duas linhas (S1): quem assina cada uma.
  ...(c.signatario === 'RESPONSAVEL' || c.grupoId ? [rotuloDoSignatario(c.signatario)] : []),
  `Gerado em ${dia(c.geradoEm)}`,
  ...(c.situacao === 'PENDENTE' && c.linkExpiraEm ? [`Link válido até ${dia(c.linkExpiraEm)}`] : []),
  ...(c.assinadoEm ? [`Assinado em ${dia(c.assinadoEm)}`] : []),
  ...(c.canceladoEm ? [`Cancelado em ${dia(c.canceladoEm)}`] : []),
].join(' · ');

/**
 * Contratos do aluno na ficha (aba Ficha, tela B; `CONTRATO_LER` e a chave ligada, `dominio/fichaDoAluno`). Gerar com
 * `CONTRATO_ALTERAR` (aluno não anonimizado; inativo, desabilitado com o motivo), "Ver" o contrato e, no ⋯, o comprovante, o
 * prorrogar e o cancelar (`acoesDoContrato`). O 503 `CONTRATOS_INDISPONIVEL` só mostra o vazio. Contrato do responsável (passo 4):
 * o link aparece uma vez depois de gerar e de "Gerar novo link do responsável" (`FolhaLinkDoResponsavel`).
 */
export function CartaoContratos({ alunoId, alunoNome, ativo, anonimizado, dataNascimento }: {
  alunoId: string; alunoNome: string; ativo: boolean; anonimizado: boolean;
  /** Da ficha, para a nota de quem assina no menor; ausente = só a nota geral. */
  dataNascimento?: string | null;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const lista = useCarregar(`contratos-do-aluno:${alunoId}`, () => listarContratosDoAluno(alunoId));
  const desligado = codigoApi(lista.erro) === 'CONTRATOS_INDISPONIVEL';
  // Mais novo primeiro; no par, o do aluno antes do do responsável.
  const contratos = [...(lista.dados ?? [])].sort((a, b) => b.geradoEm.localeCompare(a.geradoEm) || a.signatario.localeCompare(b.signatario));
  const [gerar, setGerar] = useState(false);
  const [ver, setVer] = useState<ContratoResumo | null>(null);
  const [menu, setMenu] = useState<ContratoResumo | null>(null);
  const [cancelar, setCancelar] = useState<ContratoResumo | null>(null);
  const [prorrogar, setProrrogar] = useState<ContratoResumo | null>(null);
  const [link, setLink] = useState<LinkDoResponsavel | null>(null);
  const [renovando, setRenovando] = useState(false);
  const comprovante = useComprovanteDaEquipe(alunoNome);
  const podeGerar = pode('CONTRATO_ALTERAR') && !anonimizado && !desligado;

  /** Troca o código (o anterior deixa de valer) e o mostra uma vez. */
  const renovarLink = (contratoId: string) => {
    if (renovando) return;
    setRenovando(true);
    renovarLinkDoContrato(contratoId).then(
      // A folha do link só abre depois de o histórico assentar (a de onde veio pode ainda estar voltando a entrada dela).
      (novo) => { setRenovando(false); lista.recarregar(); depoisDeFecharAsFolhas(() => setLink(novo)); },
      (e: unknown) => {
        setRenovando(false);
        const codigo = codigoApi(e);
        if (codigo === 'CONTRATO_SEM_LINK' || codigo === 'CONTRATO_NAO_PENDENTE') { lista.recarregar(); avisar(textoDoErro(e), 'atencao'); return; }
        avisar(erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e), 'perigo');
      },
    );
  };

  const aoGerado = (c: ContratoDetalhe) => {
    setGerar(false);
    lista.recarregar();
    if (!c.link) { avisar('Contrato gerado. O aluno já pode assinar no app.', 'sucesso'); return; }
    const novo = c.link;
    depoisDeFecharAsFolhas(() => setLink(novo));
    avisar(c.grupoId ? 'Contrato gerado. O aluno assina no app; envie o link ao responsável.' : 'Contrato gerado. Envie o link ao responsável.', 'sucesso');
  };

  const acaoDoMenu = (c: ContratoResumo, id: string) => {
    if (id === 'novoLink') renovarLink(c.id);
    else if (id === 'comprovante') comprovante.baixar(c.id);
    else if (id === 'prorrogar') setProrrogar(c);
    else if (id === 'cancelar') setCancelar(c);
  };

  const corpo = () => {
    if (desligado) return <Vazio texto="Nenhum contrato gerado." />;
    if (lista.erro && !lista.dados) return <MensagemErro texto={erroDeConexao(lista.erro) ? 'Confira a internet e tente de novo.' : textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />;
    if (!lista.dados) return <Esqueleto texto="Carregando os contratos" cartoes={1} />;
    if (contratos.length === 0) return <Vazio texto="Nenhum contrato gerado." />;
    return (
      <ListaDeLinhas>
        {contratos.map((c) => {
          const selo = seloDoContrato(c);
          const acoes = acoesDoContrato(c, pode);
          return (
            <LinhaDaLista key={c.id} titulo={c.titulo} metadados={metadados(c)} selos={[selo]}
              acoes={(
                <View style={estilos.acoes}>
                  <Botao rotulo="Ver" rotuloAcessivel={`Ver contrato ${c.titulo}`} tipo="secundario" aoTocar={() => setVer(c)} />
                  {acoes.length ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações do contrato ${c.titulo}`} aoTocar={() => setMenu(c)} /> : null}
                </View>
              )} />
          );
        })}
      </ListaDeLinhas>
    );
  };

  return (
    <Cartao titulo="Contratos"
      acoes={podeGerar ? (
        <Botao rotulo="Gerar contrato" tipo="acao" Icone={FilePlus} desabilitado={!ativo} motivo="Aluno inativo. Reative para gerar um contrato." aoTocar={() => setGerar(true)} />
      ) : undefined}>
      {corpo()}
      {gerar ? (
        <FolhaGerarContrato alunoId={alunoId} dataNascimento={dataNascimento} aoFechar={() => setGerar(false)} aoGerado={aoGerado} />
      ) : null}
      {ver ? (
        <FolhaDoContrato contratoId={ver.id} alunoNome={alunoNome} aoFechar={() => setVer(null)}
          aoGerarNovoLink={acoesDoContrato(ver, pode).some((a) => a.id === 'novoLink') ? () => { const id = ver.id; setVer(null); renovarLink(id); } : undefined} />
      ) : null}
      {link ? (
        <FolhaLinkDoResponsavel link={link} aoFechar={() => setLink(null)}
          aoGerarNovo={link.codigo ? undefined : () => { const id = link.contratoId; setLink(null); renovarLink(id); }} />
      ) : null}
      {menu ? (
        <FolhaDeAcoes titulo={menu.titulo} aoFechar={() => setMenu(null)}
          acoes={acoesDoContrato(menu, pode).map((a) => ({ rotulo: a.rotulo, perigo: a.perigo, aoTocar: () => acaoDoMenu(menu, a.id) }))} />
      ) : null}
      {cancelar ? <PainelCancelarContrato contrato={cancelar} aoFechar={() => setCancelar(null)} aoMudar={lista.recarregar} /> : null}
      {prorrogar ? <PainelProrrogarContrato contrato={prorrogar} aoFechar={() => setProrrogar(null)} aoMudar={lista.recarregar} /> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
