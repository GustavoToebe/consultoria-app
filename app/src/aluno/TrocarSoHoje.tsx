import { ArrowLeftRight } from 'lucide-react-native';
import { useState } from 'react';

import type { ExercicioPlano } from '../api/tipos';
import { useAviso } from '../ui/Aviso';
import { Folha } from '../ui/Folha';
import { GradeDeOpcoes } from '../ui/GradeDeOpcoes';
import { IconeBotao } from '../ui/IconeBotao';
import { OpcaoCartao } from '../ui/OpcaoCartao';
import { Texto } from '../ui/Texto';
import { RotuloDoIcone } from './RotuloDoIcone';

/**
 * "Trocar só hoje" (plano `docs/planos/trocar-exercicio.md`, passo 3b): ícone na linha do "Como fazer" que abre a folha
 * com o exercício do plano e as alternativas que o treinador deixou. Escolher fecha a folha; o plano não muda. Sem
 * alternativa, nada aparece. Com série já marcada hoje a troca fica presa ao que foi feito: a folha diz como destravar.
 */
export function TrocarSoHoje({ principal, doDia, podeTrocar, aoEscolher, outroDia }: {
  principal: ExercicioPlano;
  /** O exercício que vale hoje (o principal ou uma alternativa). */
  doDia: ExercicioPlano;
  podeTrocar: boolean;
  /** `null` = voltar ao do plano. */
  aoEscolher: (exercicioId: string | null) => void;
  /** Registro de outra data ("17/10"); ausente = hoje. A troca vale para o dia registrado, e o texto diz qual. */
  outroDia?: string;
}) {
  const { avisar } = useAviso();
  const [aberta, setAberta] = useState(false);
  const alternativas = principal.alternativas ?? [];
  const so = outroDia ? `só em ${outroDia}` : 'só hoje';
  if (!alternativas.length) return null;

  const escolher = (exercicioId: string | null, nome: string) => {
    setAberta(false);
    if ((exercicioId ?? principal.exercicioId) === doDia.exercicioId) return;
    aoEscolher(exercicioId);
    avisar(exercicioId ? `${outroDia ? `Em ${outroDia}` : 'Hoje'}: ${nome} no lugar de ${principal.nome}.` : `De volta a ${principal.nome}, do plano.`);
  };

  return (
    <>
      <RotuloDoIcone texto="Trocar">
        <IconeBotao Icone={ArrowLeftRight} rotulo={`Trocar ${doDia.nome} ${so}`} aoTocar={() => setAberta(true)} />
      </RotuloDoIcone>
      {aberta ? (
        <Folha visivel titulo={`Trocar ${so}`} aoFechar={() => setAberta(false)}>
          {podeTrocar ? (
            <>
              <Texto variante="suave">Vale só para {outroDia ? `o dia ${outroDia}` : 'hoje'}: o plano não muda. Séries, cargas e recordes passam a ser do exercício escolhido.</Texto>
              <GradeDeOpcoes rotulo="Exercício do dia">
                <OpcaoCartao
                  titulo={principal.nome}
                  descricao="Do plano"
                  selecionada={doDia.exercicioId === principal.exercicioId}
                  aoEscolher={() => escolher(null, principal.nome)}
                />
                {alternativas.map((a) => (
                  <OpcaoCartao
                    key={a.exercicioId}
                    titulo={a.nome}
                    descricao="Alternativa"
                    selecionada={doDia.exercicioId === a.exercicioId}
                    aoEscolher={() => escolher(a.exercicioId, a.nome)}
                  />
                ))}
              </GradeDeOpcoes>
            </>
          ) : (
            <Texto>
              Você já marcou uma série de {doDia.nome} {outroDia ? `em ${outroDia}` : 'hoje'}, então o exercício do dia ficou definido. Para trocar, desmarque as séries feitas.
            </Texto>
          )}
        </Folha>
      ) : null}
    </>
  );
}
