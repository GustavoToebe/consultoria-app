import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../../global.css';
import { PortalHost } from '@rn-primitives/portal';
// Só os pesos usados (o import pela raiz do pacote levaria os 18 pesos da Inter para o bundle).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { MetalMania_400Regular } from '@expo-google-fonts/metal-mania/400Regular';
import { Oswald_700Bold } from '@expo-google-fonts/oswald/700Bold';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tituloDaPagina } from '../dominio/telas';
import { SessaoProvider, useSessao } from '../sessao/SessaoProvider';
import { TemaProvider, useTema } from '../tema/TemaProvider';
import { AvisoProvider } from '../ui/Aviso';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// O index.html do export sai em inglês; leitor de tela e tradutor do navegador precisam saber que é português.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.lang = 'pt-BR';
}

export default function Raiz() {
  const [fontesProntas, erroFontes] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    MetalMania_400Regular,
    BebasNeue_400Regular,
    Oswald_700Bold,
  });

  useEffect(() => {
    if (fontesProntas || erroFontes) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontesProntas, erroFontes]);

  if (!fontesProntas && !erroFontes) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider>
      <SessaoProvider>
        <TemaProvider>
          <AvisoProvider>
            <Conteudo />
            <PortalHost />
          </AvisoProvider>
        </TemaProvider>
      </SessaoProvider>
    </SafeAreaProvider></GestureHandlerRootView>
  );
}

function Conteudo() {
  const { cores, modo, preferencias } = useTema();
  // Web: `color-scheme` na raiz faz o navegador desenhar barras de rolagem (e as folhas, que são portais) no escuro.
  const barrasEscuras = modo === 'ESCURO' && preferencias.barrasEscuras;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.colorScheme = barrasEscuras ? 'dark' : 'light';
  }, [barrasEscuras]);
  // Título da aba do navegador: "Tela · Consultoria" (antes era sempre "Treinos", e várias abas abertas se confundiam).
  const caminho = usePathname();
  const { marca } = useSessao();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = tituloDaPagina(caminho, marca?.nome);
  }, [caminho, marca?.nome]);
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <StatusBar style={modo === 'ESCURO' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }} />
    </View>
  );
}
