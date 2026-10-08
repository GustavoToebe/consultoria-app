// Só os pesos usados (o import pela raiz do pacote levaria os 18 pesos da Inter para o bundle).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { MetalMania_400Regular } from '@expo-google-fonts/metal-mania/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessaoProvider } from '../sessao/SessaoProvider';
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
    <SafeAreaProvider>
      <SessaoProvider>
        <TemaProvider>
          <AvisoProvider>
            <Conteudo />
          </AvisoProvider>
        </TemaProvider>
      </SessaoProvider>
    </SafeAreaProvider>
  );
}

function Conteudo() {
  const { cores, modo } = useTema();
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <StatusBar style={modo === 'ESCURO' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }} />
    </View>
  );
}
