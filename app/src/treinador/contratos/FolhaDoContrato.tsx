import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarArquivoDoContrato, obterContrato, type ContratoDetalhe } from '../../api/contratos';
import { baixarComprovanteDaEquipe } from '../../contratos/comprovante';
import { ROTULO_DO_PDF } from '../../contratos/abrirPdf';
import { useAbrirPdf } from '../../contratos/useAbrirPdf';
import { dataEmBrasilia, horaEmBrasilia } from '../../dominio/agendaPresencial';
import { linhasDeEvidencia, seloDoContrato } from '../../dominio/contratos';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { erroDeConexao, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { NUMERICO } from '../../ui/tipografia';
import { useCarregar } from '../../ui/useCarregar';

const instante = (iso: string) => `${dataParaTela(dataEmBrasilia(iso))} às ${horaEmBrasilia(iso)}`;

/** Busca o detalhe e imprime o comprovante da equipe (com IP, aparelho e quem gerou). */
export function useComprovanteDaEquipe(alunoNome: string) {
  const { marca } = useSessao();
  const { avisar } = useAviso();
  const [baixando, setBaixando] = useState(false);
  const baixar = (contrato: ContratoDetalhe | string) => {
    if (!marca || baixando) return;
    setBaixando(true);
    (typeof contrato === 'string' ? obterContrato(contrato) : Promise.resolve(contrato))
      .then((d) => baixarComprovanteDaEquipe(d, marca, alunoNome))
      .then(
        () => setBaixando(false),
        (e: unknown) => { setBaixando(false); avisar(erroDeConexao(e) ? 'Confira a internet e tente de novo.' : textoDoErro(e), 'perigo'); },
      );
  };
  return { baixar, baixando, pronto: !!marca };
}

/**
 * O contrato gerado, visto pela equipe (ficha › Contratos › "Ver"): situação, quem gerou e quando, prazo, cancelamento e,
 * assinado, as evidências do aceite (nome digitado, data e hora de Brasília, IP, aparelho e o código de verificação) com
 * "Baixar comprovante"; depois o texto exato que o aluno vê (no PDF próprio, "Abrir o PDF"). Só leitura, menos o
 * "Gerar novo link do responsável" (contrato do responsável pendente, com `CONTRATO_ALTERAR`), que quem abriu executa.
 */
export function FolhaDoContrato({ contratoId, alunoNome, aoFechar, aoGerarNovoLink }: {
  contratoId: string; alunoNome: string; aoFechar: () => void;
  /** Só no RESPONSAVEL pendente e com permissão: fecha esta folha e mostra o link novo. */
  aoGerarNovoLink?: () => void;
}) {
  const { cores } = useTema();
  const carga = useCarregar(`contrato-da-equipe:${contratoId}`, () => obterContrato(contratoId));
  const comprovante = useComprovanteDaEquipe(alunoNome);
  const { offline } = useSessao();
  const pdf = useAbrirPdf(() => baixarArquivoDoContrato(contratoId));
  const d = carga.dados;
  const selo = d ? seloDoContrato(d) : null;
  const a = d?.situacao === 'ASSINADO' ? d.assinatura : null;
  return (
    <Folha visivel titulo={d?.titulo ?? 'Contrato'} aoFechar={aoFechar} largura={LARGURA_FOLHA_LARGA} telaCheiaNoCelular>
      <View style={estilos.corpo}>
        {carga.erro && !d ? <MensagemErro texto={erroDeConexao(carga.erro) ? 'Confira a internet e tente de novo.' : textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
        {!d && !carga.erro ? <Esqueleto texto="Carregando o contrato" cartoes={2} /> : null}
        {d && selo ? (
          <>
            <ListaDeDados>
              <LinhaDeDado rotulo="Situação" valor={selo.texto} conteudo={<Selo texto={selo.texto} tipo={selo.tipo} />} />
              <LinhaDeDado rotulo="Quem assina" valor={d.signatario === 'RESPONSAVEL' ? 'Responsável, pelo link' : 'Aluno, no app'}
                nota={d.grupoId ? 'O aluno e o responsável assinam (de 16 a 17 anos): cada um tem o seu contrato.' : undefined} />
              {d.situacao === 'PENDENTE' && d.link ? (
                <LinhaDeDado rotulo="Link do responsável" valor={`Válido até ${dataParaTela(dataEmBrasilia(d.link.expiraEm))}`} numerico
                  acoes={aoGerarNovoLink ? <Botao rotulo="Gerar novo link" rotuloAcessivel="Gerar novo link do responsável" tipo="secundario" tamanho="pequeno" aoTocar={aoGerarNovoLink} /> : undefined} />
              ) : null}
              <LinhaDeDado rotulo="Gerado em" valor={instante(d.geradoEm)} numerico nota={d.geradoPorNome ? `por ${d.geradoPorNome}` : undefined} />
              {d.prazoAte ? <LinhaDeDado rotulo="Prazo para assinar" valor={dataParaTela(dataEmBrasilia(d.prazoAte))} numerico /> : null}
              {d.canceladoEm ? <LinhaDeDado rotulo="Cancelado em" valor={instante(d.canceladoEm)} numerico /> : null}
              {d.canceladoEm ? <LinhaDeDado rotulo="Motivo" valor={d.motivoCancelamento} /> : null}
            </ListaDeDados>
            {a ? (
              <View style={estilos.bloco}>
                <Texto variante="bloco" nivel={3}>Evidências da assinatura</Texto>
                <ListaDeDados>
                  {linhasDeEvidencia({ nome: a.nome, assinadoEm: a.assinadoEm, sha256: d.sha256, ip: a.ip, agente: a.agente, responsavelLegal: a.declarouResponsavel === true }).map((l) => (
                    <LinhaDeDado key={l.rotulo} rotulo={l.rotulo} valor={l.valor}
                      conteudo={l.rotulo.startsWith('Código') ? <Texto selectable style={[NUMERICO, estilos.codigo]}>{l.valor}</Texto> : undefined} />
                  ))}
                </ListaDeDados>
                <Botao rotulo="Baixar comprovante" tipo="secundario" carregando={comprovante.baixando} desabilitado={!comprovante.pronto}
                  motivo="Aguarde a marca da consultoria carregar." style={estilos.botao} aoTocar={() => comprovante.baixar(d)} />
              </View>
            ) : null}
            {d.origem === 'PDF' ? (
              <View style={estilos.bloco}>
                <Texto variante="bloco" nivel={3}>Documento</Texto>
                <Texto>O contrato é o PDF enviado pela equipe. O aluno abre o mesmo arquivo para assinar.</Texto>
                <Botao rotulo={ROTULO_DO_PDF} tipo="secundario" carregando={pdf.abrindo} desabilitado={offline}
                  motivo="Sem internet: conecte-se para abrir o PDF." style={estilos.botao} aoTocar={pdf.abrir} />
              </View>
            ) : (
              <View style={estilos.bloco}>
                <Texto variante="bloco" nivel={3}>Texto do contrato</Texto>
                <View style={[estilos.papel, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                  <TextoFormatado texto={d.texto} selecionavel />
                </View>
              </View>
            )}
          </>
        ) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
  bloco: { gap: espaco(1.5), alignItems: 'stretch' },
  papel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  codigo: { fontSize: 13 },
  botao: { alignSelf: 'flex-start' },
});
