import { Pressable, StyleSheet, View } from 'react-native';

import { corDoBrilho, NOME_DA_REDE, type LinkDeRede } from '../dominio/redesSociais';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, misturar } from '../tema/tokens';
import { abrirLinkExterno } from './abrirLinkExterno';
import { useAviso } from './Aviso';
import { ICONE_DA_REDE } from './IconesDeRedes';
import { sobre } from './sobre';

interface Props {
  /** Já filtradas e na ordem (`redesPreenchidas`, `redesDoAluno`); lista vazia = nada. */
  redes: LinkDeRede[];
  /** Dono do perfil no nome acessível ("Abrir Instagram de Ana"); sem ele, "Abrir Instagram". */
  de?: string;
  /** `pequeno`: desenho de 32 no alvo de 44, para linha de lista de dados (como o `IconeBotao compacto`). */
  tamanho?: 'padrao' | 'pequeno';
}

/**
 * Fileira de botões redondos das redes sociais (T-107): glifo monocromático em `texto` e um brilho suave (o `boxShadow` dos
 * pontos com brilho do `CartaoDeIndicador`) com o contorno na cor de cada rede; X e site, neutros. Cada um abre o link fora
 * do app pelo `abrirLinkExterno` (só https, sem token); se o sistema recusar, avisa. Alvo de 44 px em todo tamanho. Papel de
 * botão, como o do WhatsApp: no react-native-web um link sem `href` não responde ao Enter.
 * Exceção ao "sem sombra" do flat pedida pelo Gustavo em 25/11 (só aqui, só o brilho), proposta para registro em
 * `docs/design-e-front.md`.
 */
export function FileiraDeRedes({ redes, de, tamanho = 'padrao' }: Props) {
  const { cores, variante } = useTema();
  const { avisar } = useAviso();
  if (!redes.length) return null;
  const pequeno = tamanho === 'pequeno';
  return (
    <View style={[estilos.fileira, pequeno ? estilos.fileiraPequena : null]}>
      {redes.map(({ rede, url }) => {
        const Icone = ICONE_DA_REDE[rede];
        const brilho = corDoBrilho(rede, cores);
        const nome = rede === 'site' ? 'site' : NOME_DA_REDE[rede];
        const abrir = () => {
          void abrirLinkExterno(url).then((ok) => { if (!ok) avisar('Não foi possível abrir o link. Tente de novo.', 'perigo'); });
        };
        return (
          <Pressable key={rede} accessibilityRole="button" accessibilityLabel={`Abrir ${nome}${de ? ` de ${de}` : ''}`} onPress={abrir} style={estilos.alvo}>
            {(estado) => (
              <View style={[estilos.circulo, pequeno ? estilos.circuloPequeno : null, {
                backgroundColor: sobre(estado) ? cores.sobreNaFaixa : cores.superficie,
                borderColor: misturar(cores.superficie, brilho, 0.55),
                // Mais forte no escuro (o brilho some no branco); o glifo continua na cor do texto.
                boxShadow: `0px 0px ${pequeno ? 8 : 12}px ${misturar(cores.superficie, brilho, variante === 'escuro' ? 0.8 : 0.4)}`,
              }]}>
                <Icone size={pequeno ? 16 : 20} color={cores.texto} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fileira: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  fileiraPequena: { gap: espaco(0.5) },
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: ALVO_TOQUE / 2 },
  circulo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  circuloPequeno: { width: 32, height: 32, borderRadius: 16 },
});
