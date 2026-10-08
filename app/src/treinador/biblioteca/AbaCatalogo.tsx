import { Check, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, importarDoCatalogo, type TipoBiblioteca } from '../../api/rotas';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Carregando, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { MODALIDADES } from '../treino/FolhaBiblioteca';
import { resumoAlimento } from './AbaAlimentos';

interface ItemCatalogo {
  id: string;
  nome: string;
  detalhe: string;
}

/** Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. */
export function AbaCatalogo() {
  const { cores, marca, sobreMarca } = useTema();
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const { dados, erro, carregando, recarregar } = useCarregar(`catalogo:${tipo}:${termo}`, async (): Promise<ItemCatalogo[]> =>
    tipo === 'exercicios'
      ? (await catalogoExercicios(termo)).map((e) => ({
          id: e.id,
          nome: e.nome,
          detalhe: [MODALIDADES[e.modalidade] ?? e.modalidade, e.grupoMuscular, e.equipamento].filter(Boolean).join(' · '),
        }))
      : (await catalogoAlimentos(termo)).map((a) => ({
          id: a.id,
          nome: a.nome,
          detalhe: `${resumoAlimento({ ...a, baseUnidade: a.baseUnidade as 'g' })}${a.fonte ? ` · ${a.fonte}` : ''}`,
        })),
  );

  const alternar = (id: string) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = () => {
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já estava(m) na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <View style={estilos.aba}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setMarcados(new Set());
        }}
      />
      <View style={estilos.topo}>
        <View style={estilos.busca}>
          <Campo rotulo="Buscar no catálogo" valor={busca} aoMudar={setBusca} />
        </View>
        <Botao
          rotulo={`Importar selecionados (${marcados.size})`}
          Icone={Download}
          carregando={importando}
          desabilitado={marcados.size === 0}
          aoTocar={importar}
        />
      </View>
      <Texto variante="pequeno">Os que já estão na sua biblioteca (mesmo nome) são ignorados.</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados && dados.length === 0 ? <Vazio texto="Nada encontrado no catálogo." /> : null}
      {dados?.map((item) => {
        const sel = marcados.has(item.id);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={item.nome}
            onPress={() => alternar(item.id)}
            style={[estilos.linha, { borderColor: sel ? marca : cores.borda, backgroundColor: cores.superficie }]}>
            <View style={[estilos.caixa, { borderColor: sel ? marca : cores.borda, backgroundColor: sel ? marca : 'transparent' }]}>
              {sel ? <Check size={16} color={sobreMarca} strokeWidth={3} /> : null}
            </View>
            <View style={estilos.dados}>
              <Texto>{item.nome}</Texto>
              <Texto variante="pequeno">{item.detalhe}</Texto>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(1) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5) },
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25) },
  caixa: { width: 22, height: 22, borderWidth: 2, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  dados: { flex: 1, gap: 2 },
});
