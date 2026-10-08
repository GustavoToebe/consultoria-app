import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarAlunos } from '../../../api/rotas';
import type { AlunoResumo, SituacaoFiltro } from '../../../api/tipos';
import { dataParaTela } from '../../../dominio/formatos';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Escolha } from '../../../ui/Escolha';
import { Carregando, MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useAtrasado, useCarregar } from '../../../ui/useCarregar';

const SITUACOES: { valor: SituacaoFiltro; rotulo: string }[] = [
  { valor: 'ATIVO', rotulo: 'Ativos' },
  { valor: 'INATIVO', rotulo: 'Inativos' },
  { valor: 'TODOS', rotulo: 'Todos' },
];

const TAMANHO_PAGINA = 30;

export default function Alunos() {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ATIVO');
  const [pagina, setPagina] = useState(0);
  const termo = useAtrasado(busca.trim(), 300);
  const { dados, erro, carregando, recarregar } = useCarregar(`${termo}|${situacao}|${pagina}`, () =>
    listarAlunos({ busca: termo, situacao, pagina }),
  );
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;

  return (
    <Tela bordas={['top']}>
      <Cabecalho
        titulo="Alunos"
        mostrarMarca="celular"
        acoes={
          <Botao
            rotulo="Novo aluno"
            Icone={Plus}
            aoTocar={() => router.push('/treinador/alunos/novo')}
          />
        }
      />
      <View style={estilos.filtros}>
        <View style={estilos.busca}>
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={(t) => {
              setBusca(t);
              setPagina(0);
            }}
            placeholder="Nome do aluno"
            autoCapitalize="none"
          />
        </View>
        <Escolha
          rotulo="Situação"
          opcoes={SITUACOES}
          valor={situacao}
          aoMudar={(s) => {
            setSituacao(s);
            setPagina(0);
          }}
        />
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio
          texto={termo ? 'Nenhum aluno com esse nome.' : 'Nenhum aluno aqui ainda.'}
          acao={termo ? undefined : { rotulo: 'Cadastrar aluno', aoTocar: () => router.push('/treinador/alunos/novo') }}
        />
      ) : null}
      <View style={[estilos.lista, carregando && dados ? estilos.esmaecido : null]}>
        {dados?.itens.map((a) => <LinhaAluno key={a.id} aluno={a} />)}
      </View>
      {dados && paginas > 1 ? (
        <View style={estilos.paginacao}>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
          <Texto variante="suave">
            Página {pagina + 1} de {paginas} · {dados.total} alunos
          </Texto>
          <Botao
            rotulo="Próxima"
            tipo="secundario"
            desabilitado={pagina + 1 >= paginas}
            aoTocar={() => setPagina(pagina + 1)}
          />
        </View>
      ) : null}
    </Tela>
  );
}

function LinhaAluno({ aluno }: { aluno: AlunoResumo }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${aluno.nome}`}
      onPress={() => router.push(`/treinador/alunos/${aluno.id}`)}
      style={({ pressed }) => [
        estilos.linha,
        { backgroundColor: cores.superficie, borderColor: cores.borda, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={estilos.dados}>
        <Texto variante="subtitulo">{aluno.nome}</Texto>
        <View style={estilos.selos}>
          <Selo texto={aluno.ativo ? 'Ativo' : 'Inativo'} tipo={aluno.ativo ? 'sucesso' : 'neutro'} />
          <Selo texto={aluno.temAcesso ? 'Com acesso' : 'Sem acesso'} tipo={aluno.temAcesso ? 'sucesso' : 'neutro'} />
        </View>
        <Texto variante="suave">
          Treino: {aluno.planoAtivo?.titulo ?? '—'} · Último registro: {dataParaTela(aluno.ultimoRegistro) || '—'}
        </Texto>
      </View>
      <ChevronRight size={20} color={cores.textoSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  filtros: { gap: espaco(1.5) },
  busca: { maxWidth: 480 },
  lista: { gap: espaco(1) },
  esmaecido: { opacity: 0.6 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(2),
  },
  dados: { flex: 1, gap: espaco(0.75) },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
