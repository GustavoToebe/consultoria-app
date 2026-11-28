import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RegistroPeso } from '../../api/tipos';
import { registrarPeso } from '../../api/rotas';
import { mascaraDeNumero } from '../../dominio/formatos';
import { escalar } from '../../dominio/preferencias';
import { pesoComCasas } from '../../dominio/variacaoDoPeso';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoNumerico } from '../../ui/Campos';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';

const LARGURA_DO_PESO = 120;

/**
 * O peso da data da avaliação, só leitura ("Peso nesta data: 90,0 kg"): o peso não é medido na avaliação, vem do registro
 * de peso do mesmo dia. Sem registro, "Registrar peso" abre ali mesmo um campo com a data da folha (`POST /pesos`, que
 * devolve a lista nova). `pesos` nulo = a lista não carregou: nada aparece (sem afirmar que não há peso).
 */
export function PesoDaData({ alunoId, dataIso, pesos, podeRegistrar, aoRegistrado }: {
  alunoId: string;
  /** ISO válida, ou nula (data vazia ou inválida: sem linha). */
  dataIso: string | null;
  pesos: RegistroPeso[] | null;
  podeRegistrar: boolean;
  aoRegistrado: (lista: RegistroPeso[]) => void;
}) {
  const { fatorTexto } = useTema();
  const [abrindo, setAbrindo] = useState(false);
  const [peso, setPeso] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  if (!dataIso || !pesos) return null;
  const doDia = pesos.find((p) => p.data === dataIso);

  if (doDia) {
    return (
      <View style={estilos.linha}>
        <Texto variante="suave">Peso nesta data: <Texto numerico style={estilos.forte}>{pesoComCasas(doDia.pesoKg)} kg</Texto></Texto>
      </View>
    );
  }

  const registrar = () => {
    if (peso === null) return;
    setSalvando(true);
    setErro(null);
    registrarPeso(alunoId, { data: dataIso, pesoKg: peso, observacao: null }).then(
      (lista) => {
        setSalvando(false);
        setAbrindo(false);
        setPeso(null);
        aoRegistrado(lista);
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };
  const campos = errosPorCampo(erro);

  if (!abrindo) {
    return (
      <View style={[estilos.linha, estilos.emLinha]}>
        <Texto variante="suave">Sem registro de peso nesta data</Texto>
        {podeRegistrar ? (
          <>
            <Texto variante="suave" aria-hidden>·</Texto>
            <Botao rotulo="Registrar peso" rotuloAcessivel="Registrar peso nesta data" tipo="fantasma" tamanho="pequeno" aoTocar={() => setAbrindo(true)} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={estilos.registro}>
      <View style={estilos.emLinha}>
        <View style={{ width: escalar(LARGURA_DO_PESO, fatorTexto), maxWidth: '100%' }}>
          <CampoNumerico rotulo="Peso nesta data" sufixo="kg" sufixoNaCaixa mono valor={peso} aoMudar={setPeso}
            mascara={(t) => mascaraDeNumero(t, 2)} erro={campos.pesoKg} autoFocus />
        </View>
        <View style={estilos.botoes}>
          <Botao rotulo="Registrar" tipo="acao" tamanho="pequeno" carregando={salvando} aoTocar={registrar}
            desabilitado={peso === null} motivo={peso === null ? 'Informe o peso.' : undefined} />
          <Botao rotulo="Cancelar" tipo="fantasma" tamanho="pequeno" aoTocar={() => { setAbrindo(false); setErro(null); }} />
        </View>
      </View>
      {erro && !campos.pesoKg ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Na altura do campo de data ao lado, para o texto ficar no meio dele.
  linha: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  emLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1) },
  registro: { gap: espaco(1) },
  botoes: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), alignSelf: 'flex-end' },
  forte: { fontFamily: fontes.semi },
});
