import { Ellipsis, FilePlus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarContratosDoAluno, type ContratoResumo } from '../../api/contratos';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { acoesDoContrato, seloDoContrato } from '../../dominio/contratos';
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
import { useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { FolhaDoContrato, useComprovanteDaEquipe } from './FolhaDoContrato';
import { FolhaGerarContrato } from './FolhaGerarContrato';
import { PainelCancelarContrato, PainelProrrogarContrato } from './PaineisDoContrato';

const dia = (iso: string) => dataParaTela(dataEmBrasilia(iso));
const metadados = (c: ContratoResumo) => [
  `Gerado em ${dia(c.geradoEm)}`,
  ...(c.assinadoEm ? [`Assinado em ${dia(c.assinadoEm)}`] : []),
  ...(c.canceladoEm ? [`Cancelado em ${dia(c.canceladoEm)}`] : []),
].join(' · ');

/**
 * Contratos do aluno na ficha (aba Ficha, tela B; `CONTRATO_LER` e a chave ligada, `dominio/fichaDoAluno`). Gerar com
 * `CONTRATO_ALTERAR` (aluno não anonimizado; inativo, desabilitado com o motivo), "Ver" o contrato e, no ⋯, o comprovante, o
 * prorrogar e o cancelar (`acoesDoContrato`). O 503 `CONTRATOS_INDISPONIVEL` só mostra o vazio.
 */
export function CartaoContratos({ alunoId, alunoNome, ativo, anonimizado }: { alunoId: string; alunoNome: string; ativo: boolean; anonimizado: boolean }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const lista = useCarregar(`contratos-do-aluno:${alunoId}`, () => listarContratosDoAluno(alunoId));
  const desligado = codigoApi(lista.erro) === 'CONTRATOS_INDISPONIVEL';
  const contratos = [...(lista.dados ?? [])].sort((a, b) => b.geradoEm.localeCompare(a.geradoEm));
  const [gerar, setGerar] = useState(false);
  const [ver, setVer] = useState<ContratoResumo | null>(null);
  const [menu, setMenu] = useState<ContratoResumo | null>(null);
  const [cancelar, setCancelar] = useState<ContratoResumo | null>(null);
  const [prorrogar, setProrrogar] = useState<ContratoResumo | null>(null);
  const comprovante = useComprovanteDaEquipe(alunoNome);
  const podeGerar = pode('CONTRATO_ALTERAR') && !anonimizado && !desligado;

  const acaoDoMenu = (c: ContratoResumo, id: string) => {
    if (id === 'comprovante') comprovante.baixar(c.id);
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
        <FolhaGerarContrato alunoId={alunoId} aoFechar={() => setGerar(false)}
          aoGerado={() => { setGerar(false); lista.recarregar(); avisar('Contrato gerado. O aluno já pode assinar no app.', 'sucesso'); }} />
      ) : null}
      {ver ? <FolhaDoContrato contratoId={ver.id} alunoNome={alunoNome} aoFechar={() => setVer(null)} /> : null}
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
