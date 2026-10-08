import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AlunoDetalhe, AlunoRequest } from '../api/tipos';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';

interface Props {
  inicial?: AlunoDetalhe;
  rotuloSalvar: string;
  aoSalvar: (dados: AlunoRequest) => Promise<void>;
  aoCancelar?: () => void;
}

/**
 * Dados do aluno. O e-mail é opcional (o aluno escolhe o dele ao aceitar o convite). Observações são dado sensível:
 * ficam só no banco, nunca em log.
 */
export function FormAluno({ inicial, rotuloSalvar, aoSalvar, aoCancelar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '');
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);

  const salvar = () => {
    if (!nome.trim()) {
      setErro(null);
      return;
    }
    setSalvando(true);
    setErro(null);
    aoSalvar({
      nome: nome.trim(),
      email: email.trim() || null,
      objetivo: objetivo.trim() || null,
      observacoes: observacoes.trim() || null,
      versao: inicial?.versao ?? null,
    }).then(
      () => setSalvando(false),
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  return (
    <View style={estilos.form}>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} autoComplete="off" maxLength={120} />
      <Campo
        rotulo="E-mail (opcional)"
        valor={email}
        aoMudar={setEmail}
        erro={campos.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="off"
        maxLength={254}
      />
      <Campo rotulo="Objetivo (opcional)" valor={objetivo} aoMudar={setObjetivo} erro={campos.objetivo} maxLength={200} />
      <Campo
        rotulo="Observações (opcional)"
        valor={observacoes}
        aoMudar={setObservacoes}
        erro={campos.observacoes}
        linhas={4}
        maxLength={4000}
        ajuda="Visível só para você."
      />
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.botoes}>
        {aoCancelar ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} /> : null}
        <Botao rotulo={rotuloSalvar} aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim()} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  form: { gap: espaco(1.5) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
});
