import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { copiarPastaParaAluno } from '../api/rotas';
import type { PastaResumo } from '../api/tipos';
import { dataDaTela } from '../dominio/formatos';
import { AVISO_DA_COPIA_DA_PASTA, motivoParaNaoCopiar, textoDoErroDaCopia, type PlanosDaPasta } from '../dominio/publicarPasta';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Alerta, MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { useAvisoDoPlano } from '../ui/useAvisoDoPlano';
import { Texto } from '../ui/Texto';
import { EscolhaDeAlunoEPasta, useEscolhaDeAlunoEPasta } from './EscolhaDeAlunoEPasta';

interface Props {
  pasta: PastaResumo;
  /** Planos da pasta por tipo (`null` = desconhecido): só para saber se falta o `*_ALTERAR` de algum tipo presente. */
  planos: PlanosDaPasta | null;
  carregandoPlanos: boolean;
  aoFechar: () => void;
  /** Depois de copiar: quem chama fecha e avisa, com o atalho para a ficha do destino. */
  aoCopiar: (alunoId: string, nomeDoAluno: string | null) => void;
}

/**
 * "Copiar pasta para outro aluno" (D7): cria uma pasta nova no aluno escolhido, com cópia de cada plano em rascunho
 * (a partir da última versão publicada), sem os ergogênicos da dieta e sem o questionário escolhido. Nada é publicado
 * e a pasta de origem não muda. Quem renderiza já checou `PASTA_ALTERAR` + `ALUNO_LER`; aqui falta só o `*_ALTERAR` de
 * cada tipo presente (a API confere tudo de novo). O período é opcional, como na pasta nova.
 */
export function CopiarPastaParaAluno({ pasta, planos, carregandoPlanos, aoFechar, aoCopiar }: Props) {
  const { pode } = useSessao();
  const escolha = useEscolhaDeAlunoEPasta({ excluirAlunoId: pasta.alunoId, soAluno: true });
  const [titulo, setTitulo] = useState(pasta.titulo);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const avisarDoPlano = useAvisoDoPlano();
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const fimAntes = !!ini && !!fi && fi < ini;
  const semPermissao = planos ? motivoParaNaoCopiar(planos, pode) : null;
  const motivo =
    semPermissao ??
    (carregandoPlanos ? 'Carregando os planos da pasta.' : undefined) ??
    escolha.motivo ??
    (!titulo.trim() ? 'Informe o título.' : ini === undefined || fi === undefined ? 'Confira as datas.' : fimAntes ? 'O fim precisa ser depois do início.' : undefined);

  const copiar = async () => {
    if (motivo) return;
    setErro(null);
    setSalvando(true);
    try {
      await copiarPastaParaAluno(pasta.id, { alunoId: escolha.alunoId, titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null });
      aoCopiar(escolha.alunoId, escolha.nomeDoAluno);
    } catch (e) {
      setSalvando(false);
      // Limite ou funcionalidade fora do plano: o aviso fica fora da Folha (que é um Modal), então ela fecha antes.
      if (avisarDoPlano(e)) {
        aoFechar();
        return;
      }
      setErro(e instanceof ErroApi ? textoDoErroDaCopia({ status: e.status, codigo: e.codigo, mensagem: textoDoErro(e) }) : textoDoErro(e));
    }
  };

  return (
    <Folha visivel titulo="Copiar pasta para outro aluno" aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Copiar pasta" aoTocar={() => void copiar()} carregando={salvando} desabilitado={!!motivo} motivo={motivo} />
        </>
      }>
      <Texto variante="suave">
        Cria uma pasta nova para o aluno escolhido com cópia dos planos de “{pasta.titulo}”. A pasta de origem continua igual.
      </Texto>
      <Alerta tom="atencao" texto={AVISO_DA_COPIA_DA_PASTA} />
      {semPermissao ? <Alerta tom="perigo" titulo="Não dá para copiar esta pasta" texto={semPermissao} /> : null}
      <EscolhaDeAlunoEPasta escolha={escolha} />
      <Campo rotulo="Título da nova pasta" valor={titulo} aoMudar={setTitulo} maxLength={120} />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} erro={fimAntes ? 'O fim vem antes do início.' : null} />
        </View>
      </View>
      {erro ? <MensagemErro texto={erro} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 190 },
});
