import { Download, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { anonimizarAluno, exportarAluno } from '../../api/rotas';
import type { AlunoDetalhe } from '../../api/tipos';
import { nomeConfere, nomeDoArquivoDeExportacao, textoDaExportacao } from '../../dominio/privacidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { baixarJson } from './baixarJson';

interface Props {
  aluno: AlunoDetalhe;
  aoAnonimizar: (aluno: AlunoDetalhe) => void;
}

/**
 * Exportar os dados do aluno e anonimizar o aluno que saiu (LGPD). Os dois pedem confirmação e são auditados pela API
 * sem conteúdo. Anonimizar só aparece com o aluno inativo, e a confirmação exige digitar o nome.
 */
export function AcoesDePrivacidade({ aluno, aoAnonimizar }: Props) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [exportando, setExportando] = useState(false);
  const [confirmaExportar, setConfirmaExportar] = useState(false);
  const [confirmaAnonimizar, setConfirmaAnonimizar] = useState(false);
  const [anonimizando, setAnonimizando] = useState(false);
  const [digitado, setDigitado] = useState('');

  const podeExportar = pode('ALUNO_EXPORTAR');
  const podeAnonimizar = pode('ALUNO_ANONIMIZAR') && !aluno.ativo && !aluno.anonimizado;
  if (!podeExportar && !podeAnonimizar) return null;

  const exportar = () => {
    setExportando(true);
    exportarAluno(aluno.id)
      .then((dados) => baixarJson(nomeDoArquivoDeExportacao(new Date()), textoDaExportacao(dados)))
      .then(
        () => {
          setExportando(false);
          setConfirmaExportar(false);
          avisar('Arquivo gerado. Guarde com cuidado: ele tem dados pessoais e de saúde.', 'sucesso');
        },
        (e: unknown) => {
          setExportando(false);
          setConfirmaExportar(false);
          avisar(textoDoErro(e), 'perigo');
        },
      );
  };

  const fecharAnonimizar = () => {
    setConfirmaAnonimizar(false);
    setDigitado('');
  };

  const anonimizar = () => {
    setAnonimizando(true);
    anonimizarAluno(aluno.id, digitado).then(
      (a) => {
        setAnonimizando(false);
        fecharAnonimizar();
        aoAnonimizar(a);
        avisar('Aluno anonimizado. Os dados pessoais foram apagados.', 'sucesso');
      },
      (e: unknown) => {
        setAnonimizando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  const nomeCerto = nomeConfere(aluno.nome, digitado);

  return (
    <View style={estilos.botoes}>
      {podeExportar ? <Botao rotulo="Exportar dados" tipo="secundario" Icone={Download} aoTocar={() => setConfirmaExportar(true)} /> : null}
      {podeAnonimizar ? <Botao rotulo="Anonimizar" tipo="perigoTexto" Icone={UserX} aoTocar={() => setConfirmaAnonimizar(true)} /> : null}

      <PainelConfirmacao
        visivel={confirmaExportar}
        titulo="Exportar os dados deste aluno?"
        mensagem="O arquivo reúne cadastro, planos publicados, registros, peso, lesões e atualizações, e tem dados pessoais e de saúde. A exportação fica registrada na auditoria."
        rotuloConfirmar="Exportar"
        carregando={exportando}
        aoConfirmar={exportar}
        aoCancelar={() => setConfirmaExportar(false)}
      />

      <PainelConfirmacao
        visivel={confirmaAnonimizar}
        titulo="Anonimizar este aluno?"
        mensagem="Isso não tem volta. Nome, e-mail, objetivo, observações, peso, lesões, respostas e feedback das atualizações, observações dos registros e a dieta são apagados, e o acesso ao app é encerrado. Pastas, treinos e as cargas e repetições registradas ficam, só para as contagens."
        rotuloConfirmar="Anonimizar"
        perigo
        carregando={anonimizando}
        desabilitado={!nomeCerto}
        motivo="Digite o nome do aluno para liberar."
        aoConfirmar={anonimizar}
        aoCancelar={fecharAnonimizar}>
        <Campo rotulo={`Digite o nome do aluno para confirmar: ${aluno.nome}`} valor={digitado} aoMudar={setDigitado}
          erro={digitado.length > 0 && !nomeCerto ? 'O nome ainda não confere.' : null} autoCapitalize="none" autoCorrect={false} />
      </PainelConfirmacao>
    </View>
  );
}

const estilos = StyleSheet.create({
  botoes: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: espaco(1) },
});
