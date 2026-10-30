import { Droplet, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  diasDaAgua,
  maisUmCopo,
  menosUmCopo,
  metaEmMl,
  textoDaAguaDoDia,
  textoDosCopos,
} from '../dominio/aguaDoDia';
import { hojeDoCiclo } from '../dominio/cicloMenstrual';
import { dataCurta } from '../dominio/formatos';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
import { DatasDaMobilidade } from './DatasDaMobilidade';

/**
 * Água do dia (docs/planos/agua-do-aluno.md): o aluno marca copos de 250 ml (−/+) e vê "1,5 L de 3,0 L" contra a "Água
 * por dia" da dieta. Grava no aparelho na hora e vai na mesma fila de envio das séries, inclusive sem internet. Só aparece
 * com meta na dieta (quem chama confere). Hoje e os 6 dias anteriores, no "hoje" de Brasília (o do servidor). A barra usa
 * a cor do texto: sem cor de alerta nem comemoração, o app não julga quanto o aluno tomou. `compacto` (o Início, onde o
 * "Ver meu treino" precisa caber na primeira tela do celular) mostra só hoje, sem a explicação nem os outros dias; a aba
 * Dieta tem o cartão inteiro.
 */
export function CartaoAguaDoDia({ metaLitros, compacto = false }: { metaLitros: number; compacto?: boolean }) {
  const { cores } = useTema();
  const { aguaPorDia, marcarAgua } = useAluno();
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const hoje = hojeDoCiclo();
  const dias = diasDaAgua(hoje);
  const dia = !compacto && diaEscolhido && dias.includes(diaEscolhido) ? diaEscolhido : hoje;
  const registrado = aguaPorDia.get(dia);
  const ml = registrado ?? 0;
  const meta = metaEmMl(metaLitros) ?? 0;
  const ehHoje = dia === hoje;

  const mudar = (novo: number) => {
    if (novo === ml && registrado !== undefined) return;
    setGravando(true);
    void marcarAgua({ data: dia, aguaMl: novo }).finally(() => setGravando(false));
  };

  const botoes = (
    <View style={estilos.botoes}>
      <Botao
        rotulo="1 copo"
        rotuloAcessivel="Tirar um copo"
        tipo="secundario"
        Icone={Minus}
        desabilitado={ml <= 0 || gravando}
        motivo={ml <= 0 ? 'Nenhum copo marcado neste dia.' : undefined}
        aoTocar={() => mudar(menosUmCopo(ml))}
      />
      <Botao rotulo="1 copo" rotuloAcessivel="Mais um copo" tipo="secundario" Icone={Plus} desabilitado={gravando} aoTocar={() => mudar(maisUmCopo(ml))} />
    </View>
  );

  return (
    <Cartao
      titulo={ehHoje ? 'Água de hoje' : `Água em ${dataCurta(dia)}`}
      descricao={compacto ? undefined : 'Toque em + a cada copo de 250 ml que tomar.'}>
      {/* Compacto, os botões ficam na linha dos números (quebram para baixo se não couberem). */}
      <View style={estilos.topo}>
        <Droplet size={22} color={cores.texto} accessible={false} />
        <View style={estilos.numeros} accessibilityLiveRegion="polite">
          <Texto numerico style={estilos.litros}>{textoDaAguaDoDia(ml, metaLitros)}</Texto>
          <Texto variante="suave" numerico>{registrado === undefined ? 'Nada marcado neste dia' : textoDosCopos(ml)}</Texto>
        </View>
        {compacto ? botoes : null}
      </View>
      <BarraProgresso feitas={ml} total={meta} cor={cores.texto} />
      {compacto ? null : botoes}
      {compacto ? null : (
        <DatasDaMobilidade
          datas={dias}
          hoje={hoje}
          atual={dia}
          comAlgoFeito={(d) => aguaPorDia.has(d)}
          aoAbrir={setDiaEscolhido}
          assunto="Água"
          textoDoMarcado="com registro"
        />
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  numeros: { flexGrow: 1, flexShrink: 1, flexBasis: 150, gap: espaco(0.25) },
  litros: { fontFamily: fontes.semi, fontSize: 20 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
