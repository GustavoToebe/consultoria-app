import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ModeloDeMensagem } from '../../api/inscricoesTipos';
import { alterarModeloDeMensagem, criarModeloDeMensagem, excluirModeloDeMensagem, modelosDeMensagem } from '../../api/rotas';
import { LIMITES_INSCRICAO, VARIAVEIS_DA_MENSAGEM } from '../../dominio/inscricoes';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Respostas prontas da consultoria para o WhatsApp dos interessados: criar, editar e excluir (com
 * `INSCRICAO_ALTERAR`). O texto aceita as variáveis {primeiro_nome}, {consultoria} e {plano}; quem usa ainda revisa a
 * mensagem antes de copiar ou abrir o WhatsApp. Nada daqui é enviado sozinho.
 */
export function FolhaModelosDeMensagem({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  const { avisar } = useAviso();
  const modelos = useCarregar(visivel ? 'inscricoes:modelos-de-mensagem:gestao' : null, () => modelosDeMensagem());
  const [editando, setEditando] = useState<ModeloDeMensagem | 'novo' | null>(null);
  const [excluir, setExcluir] = useState<ModeloDeMensagem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const lista = [...(modelos.dados ?? [])].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

  const conflito = (e: unknown) => {
    if (codigoApi(e) === 'CONFLITO_EDICAO') {
      avisar('Outra pessoa alterou as respostas prontas. Recarregamos para você conferir.', 'neutro');
      setEditando(null);
      modelos.recarregar();
      return true;
    }
    return false;
  };

  const confirmarExclusao = () => {
    if (!excluir) return;
    setExcluindo(true);
    excluirModeloDeMensagem(excluir.id, excluir.versao).then(() => {
      setExcluindo(false);
      setExcluir(null);
      avisar('Resposta pronta excluída.', 'sucesso');
      modelos.recarregar();
    }, (e: unknown) => {
      setExcluindo(false);
      setExcluir(null);
      if (!conflito(e)) avisar(textoDoErro(e), 'perigo');
    });
  };

  const fechar = () => {
    setEditando(null);
    aoFechar();
  };

  return (
    <Folha visivel={visivel} titulo="Respostas prontas" aoFechar={fechar}>
      <View style={estilos.corpo}>
        <Texto variante="suave">
          Textos prontos para o WhatsApp. Variáveis: {VARIAVEIS_DA_MENSAGEM.map((v) => `${v.chave} (${v.descricao})`).join(', ')}.
          O app só prepara a mensagem: quem envia é você.
        </Texto>
        {modelos.erro ? <MensagemErro texto={textoDoErro(modelos.erro)} erro={modelos.erro} tentarDeNovo={modelos.recarregar} /> : null}
        {!modelos.dados && !modelos.erro ? <Esqueleto /> : null}
        {editando ? (
          <FormularioDoModelo inicial={editando === 'novo' ? null : editando} ordemPadrao={lista.length + 1}
            aoCancelar={() => setEditando(null)} aoConflito={conflito}
            aoSalvo={() => { setEditando(null); modelos.recarregar(); }} />
        ) : null}
        {modelos.dados && !editando ? (
          <>
            {lista.length === 0 ? <Texto variante="suave">Nenhuma resposta pronta ainda.</Texto> : null}
            <ListaDeLinhas>
              {lista.map((m) => (
                <LinhaDaLista key={m.id} titulo={m.nome} descricao={m.texto}
                  acoes={(
                    <LinhaDeAcoes>
                      <Botao rotulo="Editar" rotuloAcessivel={`Editar ${m.nome}`} tipo="secundario" aoTocar={() => setEditando(m)} />
                      <Botao rotulo="Excluir" rotuloAcessivel={`Excluir ${m.nome}`} tipo="perigoTexto" aoTocar={() => setExcluir(m)} />
                    </LinhaDeAcoes>
                  )} />
              ))}
            </ListaDeLinhas>
            <LinhaDeAcoes><Botao rotulo="Nova resposta pronta" aoTocar={() => setEditando('novo')} /></LinhaDeAcoes>
          </>
        ) : null}
      </View>
      <PainelConfirmacao visivel={!!excluir} titulo="Excluir resposta pronta?" perigo
        mensagem={`"${excluir?.nome ?? ''}" sai da lista. O histórico das inscrições continua citando o nome.`}
        rotuloConfirmar="Excluir" carregando={excluindo} aoConfirmar={confirmarExclusao} aoCancelar={() => setExcluir(null)} />
    </Folha>
  );
}

function FormularioDoModelo({ inicial, ordemPadrao, aoCancelar, aoSalvo, aoConflito }: {
  inicial: ModeloDeMensagem | null;
  ordemPadrao: number;
  aoCancelar: () => void;
  aoSalvo: () => void;
  aoConflito: (e: unknown) => boolean;
}) {
  const { avisar } = useAviso();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [texto, setTexto] = useState(inicial?.texto ?? '');
  const [ordem, setOrdem] = useState(String(inicial?.ordem ?? ordemPadrao));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const ordemNumero = /^\d{1,3}$/.test(ordem.trim()) ? Number(ordem.trim()) : null;
  const locais: Record<string, string> = {};
  if (!nome.trim()) locais.nome = 'Dê um nome.';
  if (!texto.trim()) locais.texto = 'Escreva o texto.';
  if (ordemNumero === null) locais.ordem = 'Use um número de 0 a 999.';

  const salvar = () => {
    setTentou(true);
    if (Object.keys(locais).length) return;
    setSalvando(true);
    const corpo = { nome: nome.trim(), texto: texto.trim(), ordem: ordemNumero ?? 0, versao: inicial?.versao ?? null };
    const pedido = inicial ? alterarModeloDeMensagem(inicial.id, corpo) : criarModeloDeMensagem(corpo);
    pedido.then(() => {
      setSalvando(false);
      avisar(inicial ? 'Resposta pronta salva.' : 'Resposta pronta criada.', 'sucesso');
      aoSalvo();
    }, (e: unknown) => {
      setSalvando(false);
      if (aoConflito(e)) return;
      setErros(errosPorCampo(e));
      avisar(textoDoErro(e), 'perigo');
    });
  };

  return (
    <View style={estilos.formulario}>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} maxLength={LIMITES_INSCRICAO.modeloNome}
        erro={(tentou ? locais.nome : null) ?? erros.nome} placeholder="Ex.: Apresentação" />
      <Campo rotulo="Texto" valor={texto} aoMudar={setTexto} linhas={6} maxLength={LIMITES_INSCRICAO.modeloTexto}
        erro={(tentou ? locais.texto : null) ?? erros.texto} />
      <Campo rotulo="Ordem na lista" valor={ordem} aoMudar={setOrdem} numerico inputMode="numeric" maxLength={3}
        erro={(tentou ? locais.ordem : null) ?? erros.ordem} />
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} />
        <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} />
      </LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
  formulario: { gap: espaco(1.5) },
});
