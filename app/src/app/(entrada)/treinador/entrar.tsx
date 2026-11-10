import { EntradaDoPublico } from '../../../ui/EntradaDoPublico';

/** Entrada do treinador e da equipe (`/treinador/entrar`). No grupo `(entrada)`, fora do layout guardado: abre sem login. */
export default function EntrarTreinador() {
  return <EntradaDoPublico publico="TREINADOR" />;
}
