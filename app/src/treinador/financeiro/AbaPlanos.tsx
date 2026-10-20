import { Plus } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PeriodoDoPlano, PlanoResponse } from '../../api/financeiroTipos';
import { alterarPlanoComercial, arquivarPlanoComercial, criarPlanoComercial, listarPlanosComerciais } from '../../api/rotas';
import { LIMITES, OPCOES_DE_PERIODICIDADE, rotuloDaPeriodicidade, validarPlano } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { ListaOuTabela } from './ListaOuTabela';

/**
 * Planos comerciais da consultoria (o que o aluno contrata do treinador; não confundir com a assinatura da consultoria
 * em Minha conta). Criar, editar e arquivar exigem `FINANCEIRO_ALTERAR`. Arquivar não apaga as contratações que já usam o plano.
 */
export function AbaPlanos({ podeAlterar }: { podeAlterar: boolean }) {
  const [arquivados, setArquivados] = useState(false);
  const [aberto, setAberto] = useState<PlanoResponse | 'novo' | null>(null);
  const lista = useCarregar(`planos-comerciais|${arquivados}`, () => listarPlanosComerciais(arquivados));
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;

  return (
    <View style={estilos.coluna}>
      <LinhaDeAcoes alinhar="entre">
        <Interruptor rotulo="Mostrar arquivados" valor={arquivados} aoMudar={setArquivados} />
        {podeAlterar ? <Botao rotulo="Novo plano" Icone={Plus} aoTocar={() => setAberto('novo')} /> : null}
      </LinhaDeAcoes>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo={arquivados ? 'Nenhum plano arquivado' : 'Nenhum plano comercial ainda'}
          texto={arquivados ? 'Os planos arquivados aparecem aqui.' : podeAlterar ? 'Crie um plano (nome, valor e periodicidade) para depois contratá-lo na ficha de um aluno.' : 'Peça a quem gerencia o financeiro para criar os planos.'} />
      ) : null}
      {dados && dados.length > 0 ? (
        <Cartao descricao="Toque no plano para ver os detalhes.">
          <ListaOuTabela rotulo="Planos comerciais" linhas={dados} chave={(p) => p.id} aoTocar={setAberto}
            rotuloDaLinha={(p) => `Abrir plano ${p.nome}`}
            item={(p) => ({
              titulo: p.nome,
              detalhe: `${centavosParaTela(p.valorCentavos)} · ${rotuloDaPeriodicidade(p.periodicidade)}`,
              selo: p.arquivado ? { texto: 'Arquivado', tipo: 'neutro' } : undefined,
            })}
            colunas={[
              { chave: 'nome', titulo: 'Plano', flex: 2, principal: true, render: (p) => <Texto variante="bloco" numberOfLines={2}>{p.nome}</Texto> },
              { chave: 'valor', titulo: 'Valor', flex: 1, alinhar: 'direita', render: (p) => <Texto numerico>{centavosParaTela(p.valorCentavos)}</Texto> },
              { chave: 'periodicidade', titulo: 'Periodicidade', flex: 1, render: (p) => <Texto>{rotuloDaPeriodicidade(p.periodicidade)}</Texto> },
              { chave: 'situacao', titulo: 'Situação', flex: 1, render: (p) => <Texto>{p.arquivado ? 'Arquivado' : 'Ativo'}</Texto> },
            ]} />
        </Cartao>
      ) : null}
      <FolhaDoPlano plano={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={recarregar} />
    </View>
  );
}

function FolhaDoPlano({ plano, podeAlterar, aoFechar, aoMudar }: {
  plano: PlanoResponse | 'novo' | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  if (!plano) return null;
  return <Formulario key={plano === 'novo' ? 'novo' : `${plano.id}:${plano.versao}`} plano={plano === 'novo' ? null : plano}
    podeAlterar={podeAlterar} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

function Formulario({ plano, podeAlterar, aoFechar, aoMudar }: {
  plano: PlanoResponse | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const editavel = podeAlterar && !plano?.arquivado;
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [valor, setValor] = useState(centavosParaCampo(plano?.valorCentavos));
  const [periodicidade, setPeriodicidade] = useState<PeriodoDoPlano>(plano?.periodicidade ?? 'MENSAL');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [arquivando, setArquivando] = useState(false);

  const centavos = centavosDaTela(valor);
  const problema = validarPlano({ nome, valorCentavos: centavos });

  const terminar = (mensagem: string) => {
    setEnviando(false);
    avisar(mensagem, 'sucesso');
    aoMudar();
    aoFechar();
  };
  const falhar = (e: unknown) => {
    setEnviando(false);
    if (ehConflito(e)) {
      setArquivando(false);
      avisar(avisoDeConflito('O plano foi alterado'), 'neutro');
      aoMudar();
      aoFechar();
      return;
    }
    setErro(e);
  };

  const salvar = () => {
    setTentou(true);
    if (problema || centavos === null) return;
    setEnviando(true);
    setErro(null);
    const corpo = { nome: nome.trim(), valorCentavos: centavos, periodicidade, versao: plano?.versao ?? null };
    (plano ? alterarPlanoComercial(plano.id, corpo) : criarPlanoComercial(corpo)).then(
      () => terminar(plano ? 'Plano salvo.' : 'Plano criado.'),
      falhar,
    );
  };

  const arquivar = () => {
    if (!plano) return;
    setEnviando(true);
    setErro(null);
    arquivarPlanoComercial(plano.id, plano.versao).then(() => terminar('Plano arquivado.'), falhar);
  };

  return (
    <Folha visivel titulo={plano ? (editavel ? 'Editar plano' : 'Plano') : 'Novo plano'} aoFechar={aoFechar}
      rodape={editavel ? (
        <LinhaDeAcoes alinhar="fim">
          {plano ? <Botao rotulo="Arquivar" tipo="perigoTexto" aoTocar={() => { setErro(null); setArquivando(true); }} desabilitado={enviando} /> : null}
          <Botao rotulo={plano ? 'Salvar plano' : 'Criar plano'} aoTocar={salvar} carregando={enviando} />
        </LinhaDeAcoes>
      ) : undefined}>
      <View style={{ gap: espaco(1.5) }}>
        {plano?.arquivado ? <Texto variante="suave">Plano arquivado: não aceita novas contratações nem edição.</Texto> : null}
        <Campo rotulo="Nome do plano" valor={nome} aoMudar={setNome} maxLength={LIMITES.nomeDoPlano} editable={editavel}
          erro={tentou && !nome.trim() ? 'Informe o nome do plano.' : null} />
        {editavel ? (
          <CampoMoeda rotulo="Valor (R$)" texto={valor} aoMudar={setValor} erro={tentou && centavos === null ? 'Informe um valor maior que zero, por exemplo 150,00.' : null}
            ajuda="Valor de cada cobrança do plano. Na ficha do aluno dá para combinar outro valor, com o motivo." />
        ) : (
          <Texto>Valor: {centavosParaTela(plano?.valorCentavos)}</Texto>
        )}
        {editavel ? (
          <Escolha rotulo="Periodicidade" opcoes={OPCOES_DE_PERIODICIDADE.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} valor={periodicidade} aoMudar={setPeriodicidade} />
        ) : (
          <Texto>Periodicidade: {rotuloDaPeriodicidade(plano?.periodicidade)}</Texto>
        )}
        {tentou && problema && centavos !== null && nome.trim() ? <MensagemErro texto={problema} /> : null}
        {erro && !arquivando ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={arquivando} titulo="Arquivar este plano?"
        mensagem="O plano deixa de aparecer para novas contratações. Quem já contratou continua com as cobranças que já existem."
        rotuloConfirmar="Arquivar plano" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={arquivar} aoCancelar={() => setArquivando(false)}>
        {erro && arquivando ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
