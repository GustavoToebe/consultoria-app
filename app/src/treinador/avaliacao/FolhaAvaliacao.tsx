import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica, MedidasCorporais } from '../../api/avaliacaoFisicaTipos';
import { alterarAvaliacaoFisica, registrarAvaliacaoFisica } from '../../api/rotas';
import { corpoDaAvaliacao, MEDIDAS, medidasVazias, OBSERVACAO_MAXIMA, problemasDaAvaliacao } from '../../dominio/avaliacaoFisica';
import { dataDaTela, dataParaTela, hojeIso, mascaraDeNumero } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData, CampoNumerico } from '../../ui/Campos';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';

/** Nova ou editar avaliação física: data, as 10 circunferências duas por linha e a observação. */
export function FolhaAvaliacao({ alunoId, avaliacao, aoFechar, aoSalvar }: { alunoId: string; avaliacao: AvaliacaoFisica | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [data, setData] = useState(dataParaTela(avaliacao?.data ?? hojeIso()));
  const [medidas, setMedidas] = useState<MedidasCorporais>(avaliacao ? { ...medidasVazias(), ...avaliacao.medidas } : medidasVazias());
  const [observacao, setObservacao] = useState(avaliacao?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const dataIso = dataDaTela(data);
  const corpo = corpoDaAvaliacao(dataIso ?? null, medidas, observacao, avaliacao ? avaliacao.versao : undefined);
  const locais = problemasDaAvaliacao(corpo, hojeIso());
  if (dataIso === undefined) locais.data = 'Use o formato DD/MM/AAAA.';
  const daApi = errosPorCampo(erro);
  const campos: Record<string, string | undefined> = { ...(tentou ? locais : {}), ...daApi };

  const salvar = () => {
    setTentou(true);
    if (Object.keys(locais).length) return;
    setSalvando(true);
    setErro(null);
    (avaliacao ? alterarAvaliacaoFisica(avaliacao.id, corpo) : registrarAvaliacaoFisica(alunoId, corpo)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={avaliacao ? 'Editar avaliação física' : 'Nova avaliação física'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} />
        </>
      }>
      <View style={estilos.campoData}>
        <CampoData rotulo="Data" nome="Data da avaliação" regra="REGISTRO" valor={data} aoMudar={setData} erro={campos.data} />
      </View>
      <Texto variante="secao" nivel={3}>Circunferências (cm)</Texto>
      <Texto variante="pequeno">Preencha só o que foi medido; ao menos uma medida. O peso vem do registro de peso da mesma data.</Texto>
      {campos.medidas ? <MensagemErro texto={campos.medidas} /> : null}
      <View style={estilos.grade}>
        {MEDIDAS.map(({ campo, rotulo }) => (
          <View key={campo} style={estilos.medida}>
            <CampoNumerico
              rotulo={rotulo}
              sufixo="cm"
              valor={medidas[campo]}
              aoMudar={(v) => setMedidas((m) => ({ ...m, [campo]: v }))}
              mascara={(t) => mascaraDeNumero(t, 1)}
              erro={campos[`medidas.${campo}`]}
            />
          </View>
        ))}
      </View>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={OBSERVACAO_MAXIMA} multiline erro={campos.observacao}
        ajuda="O aluno vê esta observação." />
      {erro && Object.keys(daApi).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  campoData: { width: 190 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  // Duas por linha (direita e esquerda lado a lado), no celular e no PC.
  medida: { flexGrow: 1, flexBasis: '40%', minWidth: 0 },
});
