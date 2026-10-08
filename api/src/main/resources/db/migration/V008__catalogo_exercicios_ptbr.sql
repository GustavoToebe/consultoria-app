-- Catálogo público de exercícios: exercicios-bd-ptbr (seção 6 do PLANO-CATALOGO-PUBLICO.md).
-- GERADO por scripts/catalogo/gerar_exercicios.py a partir de dados/fontes/exercicios-bd-ptbr/ (sha256 bea7728b7bb811bc1c304e2758e1e4eeecc8be592dfd3cd12b7534cc9fa89880)
-- e dos nomes revisados em dados/curadoria/exercicios-nomes.csv. Não editar à mão.
-- Fonte: exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense).
-- Os 52 exercícios do V006 continuam como estão (escritos à mão) e passam a ter fonte 'Catálogo próprio'.

alter table catalogo_exercicio add column instrucoes text;
alter table catalogo_exercicio add column fonte varchar(200);
alter table catalogo_exercicio add column nome_busca varchar(160);

update catalogo_exercicio set fonte = 'Catálogo próprio',
  nome_busca = translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, instrucoes, fonte, nome_busca) values
  (md5('catalogo-exercicio:fedb:' || 'Frog_Sit-Ups')::uuid, 'Abdominais de sapo', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão (ou em um colchonete) com as pernas estendidas.
Dobre os joelhos e coloque as coxas externas no chão, unindo as solas dos pés.
Aproxime as solas o máximo possível de você, mantendo as coxas externas no chão (formando um formato de diamante).
Cruze os braços tocando os ombros opostos. Esta é a posição inicial.
Expire, achatando a lombar no chão e elevando o tronco (como o primeiro quarto de um abdominal). Segure no topo por um segundo.
Inspire, retornando lentamente à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominais de sapo'),
  (md5('catalogo-exercicio:fedb:' || 'Oblique_Crunches')::uuid, 'Abdominais oblíquos', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão com a região lombar pressionada contra o solo. Coloque uma mão ao lado da cabeça e a outra no chão ao lado do corpo.
Mantenha os pés elevados e apoiados em uma superfície plana.
Levante o ombro correspondente à mão que está na cabeça.
Eleve o corpo para cima até o cotovelo tocar o joelho oposto. Por exemplo, se a mão direita está na cabeça, eleve até o cotovelo direito tocar o joelho esquerdo. Faça o mesmo para o outro lado.
Após tocar o joelho, abaixe o corpo até a posição inicial.
Inspire ao abaixar e expire ao elevar.
Continue alternando os lados até completar as repetições recomendadas para cada lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominais obliquos'),
  (md5('catalogo-exercicio:fedb:' || 'Oblique_Crunches_-_On_The_Floor')::uuid, 'Abdominais oblíquos no chão', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de lado direito com as pernas uma sobre a outra e os joelhos levemente flexionados.
Coloque a mão esquerda atrás da cabeça.
A partir dessa posição, mova o cotovelo esquerdo para cima, como em um abdominal normal, focando nos oblíquos.
Contraia o máximo possível, segure a contração por um segundo e depois retorne lentamente à posição inicial.
Inspire ao abaixar e expire ao elevar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominais obliquos no chao'),
  (md5('catalogo-exercicio:fedb:' || '3_4_Sit-Up')::uuid, 'Abdominal 3/4', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão e prenda os pés. As pernas devem estar flexionadas nos joelhos.
Coloque as mãos atrás ou ao lado da cabeça. Comece com as costas no chão. Esta é a posição inicial.
Flexione os quadris e a coluna para levantar o tronco em direção aos joelhos.
No topo da contração, o tronco deve estar perpendicular ao chão. Inverta o movimento, descendo apenas 3/4 do caminho.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal 3/4'),
  (md5('catalogo-exercicio:fedb:' || 'Tuck_Crunch')::uuid, 'Abdominal agrupado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão ou em um colchonete, com os braços ao lado do corpo e as palmas para baixo.
Cruze as pernas, envolvendo um tornozelo no outro, e eleve as pernas até as coxas ficarem perpendiculares ao chão, com os joelhos levemente flexionados. Os joelhos e pés devem ficar paralelos ao chão.
Mova os braços do chão e cruze-os sobre o peito. Esta é a posição inicial.
Mantendo a parte inferior das costas pressionada contra o chão, levante o tronco lentamente, expirando.
Abaixe o tronco de volta à posição inicial lentamente, inspirando.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal agrupado'),
  (md5('catalogo-exercicio:fedb:' || 'Air_Bike')::uuid, 'Abdominal bicicleta', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão, com a região lombar pressionada contra o solo. Coloque as mãos ao lado da cabeça, sem forçar o pescoço. Levante os ombros para a posição de crunch.
Levante os joelhos até ficarem perpendiculares ao chão, com as canelas paralelas ao chão. Esta é a posição inicial.
Simultaneamente, faça um movimento de pedalar, chutando para frente com a perna direita e trazendo o joelho esquerdo para perto. Aproxime o cotovelo direito do joelho esquerdo, fazendo um crunch lateral, enquanto expira.
Volte à posição inicial enquanto inspira.
Faça um crunch para o lado oposto, aproximando o cotovelo esquerdo do joelho direito e expire.
Continue alternando até completar as repetições recomendadas para cada lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal bicicleta'),
  (md5('catalogo-exercicio:fedb:' || 'Jackknife_Sit-Up')::uuid, 'Abdominal canivete', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão com os braços estendidos para trás da cabeça e as pernas estendidas. Esta é a posição inicial.
Expire e flexione o tronco, levantando simultaneamente as pernas e os braços para se encontrar em posição de canivete. As pernas devem estar elevadas a 35-45 graus do chão, e os braços paralelos a elas, com o torso fora do chão.
Inspire e retorne os braços e pernas à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal canivete'),
  (md5('catalogo-exercicio:fedb:' || 'Exercise_Ball_Pull-In')::uuid, 'Abdominal canivete na bola suíça', 'Abdômen', 'Bola suíça', 'OUTRO', 'Posicione uma bola suíça próximo a você e deite-se no chão na frente dela, com as mãos no chão na largura dos ombros, em posição de flexão.
Apoie a parte inferior das canelas em cima da bola. As pernas devem estar totalmente estendidas e o tronco apoiado pelos braços, como em uma flexão. Esta será sua posição inicial.
Mantendo as costas retas e o tronco imóvel, puxe os joelhos em direção ao peito enquanto expira, permitindo que a bola role para frente sob os tornozelos. Contraia os abdominais e segure por um segundo.
Estenda lentamente as pernas, rolando a bola de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal canivete na bola suica'),
  (md5('catalogo-exercicio:fedb:' || 'Cocoons')::uuid, 'Abdominal casulo', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Comece deitado de costas no chão. As pernas devem estar estendidas e os braços atrás da cabeça. Esta será sua posição inicial.
Para executar o movimento, leve os joelhos em direção ao peito, girando a pélvis para levantar os glúteos do chão. Ao mesmo tempo, flexione a coluna, trazendo os braços para a frente em um movimento de crunch.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal casulo'),
  (md5('catalogo-exercicio:fedb:' || 'Press_Sit-Up')::uuid, 'Abdominal com desenvolvimento', 'Abdômen', 'Barra', 'LIVRE', 'Deite-se em um banco com uma barra sobre o peito. Posicione as pernas fixas na extensão do banco abdominal. Esta é a posição inicial.
Inspire, contraia abdômen e glúteos. Simultaneamente, flexione o tronco como em um abdominal e pressione a barra para cima acima da cabeça, exalando. Use os braços para empurrar, mas foque nos abdominais.
Volte à posição inicial abaixando o tronco e a barra. Inspire ao descer.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal com desenvolvimento'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Sit-Ups_-_With_Bands')::uuid, 'Abdominal com elástico e sobrecarga', 'Abdômen', null, 'OUTRO', 'Prenda as faixas elásticas na base do banco declinado e posicione as alças para que você possa alcançá-las ao deitar.
Ajuste as pernas no suporte do banco e segure as alças das faixas com as mãos em pegada pronada, posicionando-as próximas à clavícula e girando os pulsos para uma pegada neutra. Mantenha os braços estáticos. Esta é a posição inicial.
Levante o tronco até que fique perpendicular ao chão, expirando. Segure a contração por um segundo e abaixe o tronco de volta à posição inicial, inspirando.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal com elastico e sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Crunch_-_Hands_Overhead')::uuid, 'Abdominal com mãos acima da cabeça', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com os joelhos flexionados a cerca de 60 graus.
Mantenha os pés no chão e estique os braços acima da cabeça com as palmas cruzadas. Esta é a posição inicial.
Flexione o tronco para frente, levantando as escápulas do chão. Mantenha os braços alinhados com a cabeça, pescoço e ombros, expirando. Segure a contração por um segundo.
Volte lentamente à posição inicial inspirando.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal com maos acima da cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Crunch_-_Legs_On_Exercise_Ball')::uuid, 'Abdominal com pernas na bola', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com os pés apoiados em uma bola de exercício e joelhos flexionados a 90 graus.
Mantenha os pés levemente afastados e dedos apontados para dentro, tocando-se.
Coloque as mãos levemente ao lado da cabeça, cotovelos para dentro.
Pressione a região lombar no chão para isolar o abdômen. Esta é a posição inicial.
Levante os ombros do chão cerca de 10 cm, mantendo a lombar no chão, expirando e contraindo o abdômen no topo. Segure por um segundo, com movimento controlado.
Volte lentamente à posição inicial inspirando.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal com pernas na bola'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Crunches')::uuid, 'Abdominal com sobrecarga', 'Abdômen', 'Medicine ball', 'OUTRO', 'Deite-se de costas com os pés apoiados no chão ou em um banco, joelhos dobrados em 90 graus.
Segure um peso no peito ou estendido acima do torso.
Expire e levante os ombros do chão cerca de 10 cm, mantendo a lombar no chão.
Contraia os abdominais no topo e segure brevemente.
Inspire e abaixe-se lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal com sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Cross-Body_Crunch')::uuid, 'Abdominal cruzado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com os joelhos flexionados a cerca de 60 graus.
Mantenha os pés apoiados no chão e as mãos soltas atrás da cabeça. Esta é a posição inicial.
Flexione o tronco e traga o cotovelo e ombro direito em direção ao joelho esquerdo, que deve se aproximar do ombro. Tente tocar o joelho com o cotovelo, expirando e contraindo o abdômen.
Volte à posição inicial inspirando e repita com o cotovelo esquerdo e joelho direito.
Continue alternando até completar as repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal cruzado'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Crunch')::uuid, 'Abdominal declinado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Prenda as pernas na extremidade do banco declinado e deite-se.
Coloque as mãos levemente ao lado da cabeça, com os cotovelos para dentro. Dica: Não entrelace os dedos atrás da cabeça.
Mantenha a região lombar pressionada no banco para isolar os abdominais e comece a levantar os ombros.
Continue pressionando a lombar enquanto contrai os abdominais e expira. Os ombros devem subir apenas cerca de 10 cm, e a lombar deve permanecer no banco. No topo, contraia os abdominais por um segundo. Dica: Faça movimentos lentos e controlados, sem usar impulso.
Após a contração, desça lentamente à posição inicial inspirando.
Repita pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal declinado'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Crunch')::uuid, 'Abdominal infra', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão com as pernas estendidas e os braços ao lado do torso, palmas no chão. Os braços devem ficar imóveis.
Levante as pernas até as coxas ficarem perpendiculares ao chão e os pés juntos e paralelos ao chão. Esta é a posição inicial.
Ao inspirar, aproxime as pernas do torso, rolando a pélvis para trás e elevando os quadris do chão. No final, os joelhos devem tocar o peito.
Segure a contração por um segundo e retorne as pernas à posição inicial enquanto expira.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal infra'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Reverse_Crunch')::uuid, 'Abdominal infra na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma tornozeira à polia baixa e coloque um colchonete no chão à frente.
Sente-se com os pés voltados para a polia e prenda o cabo aos tornozelos.
Deite-se, eleve as pernas e flexione os joelhos em um ângulo de 90 graus. As pernas e o cabo devem estar alinhados; ajuste a polia se necessário.
Com as mãos atrás da cabeça, aproxime os joelhos do torso e eleve os quadris do chão.
Faça uma pausa e, com controle, abaixe os quadris e retorne as pernas ao ângulo de 90 graus, mantendo tensão no abdômen.
Repita até a falha muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal infra na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Reverse_Crunch')::uuid, 'Abdominal infra no banco declinado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no banco declinado e segure a parte superior do banco com as duas mãos para não escorregar.
Mantenha as pernas paralelas ao chão, com joelhos e pés juntos, usando o abdômen para sustentar. Dica: Pernas estendidas com leve flexão nos joelhos. Esta é a posição inicial.
Expire e aproxime as pernas do torso, rolando a pélvis para trás e levantando os quadris do banco até os joelhos tocarem o peito.
Segure a contração por um segundo e retorne as pernas à posição inicial inspirando.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal infra no banco declinado'),
  (md5('catalogo-exercicio:fedb:' || 'Flat_Bench_Leg_Pull-In')::uuid, 'Abdominal infra no banco reto', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se em um banco plano ou colchonete com as pernas estendidas para fora.
Coloque as mãos sob os glúteos ou ao lado do corpo segurando o banco. Esta é a posição inicial.
Dobre os joelhos e puxe as coxas em direção ao tronco, expirando. Segure a contração por um segundo.
Inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal infra no banco reto'),
  (md5('catalogo-exercicio:fedb:' || 'Butt-Ups')::uuid, 'Abdominal infra no chão', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Comece em uma posição de flexão, mas com os cotovelos no chão e apoiados nos antebraços. Os braços devem estar dobrados em um ângulo de 90 graus.
Arqueie levemente as costas para fora, em vez de mantê-las completamente retas.
Levante os glúteos em direção ao teto, contraindo o abdômen firmemente para reduzir a distância entre a caixa torácica e os quadris. O resultado final será uma posição de ponte alta. Expire ao realizar esta parte do movimento.
Abaixe-se lentamente de volta à posição inicial enquanto inspira. Dica: não deixe as costas afundarem.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal infra no chao'),
  (md5('catalogo-exercicio:fedb:' || 'Suspended_Reverse_Crunch')::uuid, 'Abdominal invertido suspenso', 'Abdômen', null, 'OUTRO', 'Prenda as tiras de suspensão com as alças a cerca de 30 cm do chão. Posicione-se de costas para o rack, em posição de prancha para flexão.
Coloque os pés nas alças. Mantenha a postura reta, sem deixar os quadris caírem. Esta é a posição inicial.
Inicie o movimento flexionando joelhos e quadris, levando os joelhos em direção ao torso. Ao fazer isso, incline a pélvis anteriormente, flexionando a coluna.
No topo do movimento controlado, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal invertido suspenso'),
  (md5('catalogo-exercicio:fedb:' || 'Janda_Sit-Up')::uuid, 'Abdominal Janda', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Posicione-se no chão para um abdominal básico: joelhos flexionados a 90 graus, pés apoiados no chão e braços cruzados no peito ou ao lado do corpo. Esta é a posição inicial.
Contraia fortemente glúteos e isquiotibiais, inspire e levante o tronco lentamente (em 3 a 6 segundos), expirando. Isso inibe os flexores do quadril.
Inspire e retorne controladamente à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal janda'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Jackknife')::uuid, 'Abdominal lateral (jackknife)', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', null, 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal lateral (jackknife)'),
  (md5('catalogo-exercicio:fedb:' || 'Exercise_Ball_Crunch')::uuid, 'Abdominal na bola suíça', 'Abdômen', 'Bola suíça', 'OUTRO', 'Deite-se sobre uma bola suíça com a curvatura da região lombar pressionada contra a superfície esférica da bola. Os pés devem estar flexionados nos joelhos e firmemente apoiados no chão. A parte superior do tronco deve estar pendurada sobre o topo da bola. Mantenha os braços ao lado do corpo ou cruzados sobre o peito para evitar tensão no pescoço.
Abaixe o tronco para uma posição de alongamento, mantendo o pescoço imóvel. Esta será sua posição inicial.
Com os quadris estáveis, flexione a cintura contraindo os abdominais e eleve os ombros e o tronco até sentir uma boa contração. Os braços devem deslizar pelas pernas se estiverem ao lado ou permanecer no peito se cruzados. A região lombar deve manter contato com a bola. Expire ao executar o movimento e segure a contração por um segundo.
Inspire enquanto retorna à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na bola suica'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists')::uuid, 'Abdominal na polia ajoelhado com rotação', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma corda a uma polia alta e coloque um tapete no chão à frente.
Segure a corda com as duas mãos e ajoelhe-se a cerca de 60 cm da torre.
Posicione a corda atrás da cabeça, com as mãos próximas às orelhas.
Mantenha as mãos fixas, contraia o abdômen e puxe a corda para baixo em um movimento de crunch até os cotovelos tocarem os joelhos.
Faça uma pausa breve no ponto mais baixo e retorne lentamente à posição inicial.
Repita o movimento para baixo até a metade e, então, gire um cotovelo em direção ao joelho oposto.
Pause brevemente e retorne controladamente.
Na próxima repetição, alterne o outro cotovelo para o joelho oposto.
Continue a série até a falha muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia ajoelhado com rotacao'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Crunch')::uuid, 'Abdominal na polia alta', 'Abdômen', 'Polia', 'MAQUINA', 'Ajoelhe-se abaixo de uma polia alta com uma corda presa.
Segure a corda e abaixe-a até as mãos ficarem próximas ao rosto.
Flexione levemente os quadris para alongar a lombar. Esta é a posição inicial.
Com os quadris parados, flexione a cintura contraindo o abdômen até os cotovelos se aproximarem das coxas, expirando e segurando a contração por um segundo.
Retorne lentamente à posição inicial inspirando, mantendo tensão constante no abdômen.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia alta'),
  (md5('catalogo-exercicio:fedb:' || 'Rope_Crunch')::uuid, 'Abdominal na polia com corda', 'Abdômen', 'Polia', 'MAQUINA', 'Ajoelhe-se a 30-60 cm de um sistema de cabo com uma corda presa.
Segure a corda com as duas mãos acima da cabeça, com o tronco ereto.
Flexione a coluna, tentando aproximar as costelas das pernas enquanto puxa a corda para baixo.
Segure na parte inferior do movimento e retorne lentamente à posição inicial.
Pode ser feito com torções ou para os lados para trabalhar os oblíquos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Rope_Crunch')::uuid, 'Abdominal na polia em pé com corda', 'Abdômen', 'Polia', 'MAQUINA', 'Prenda uma corda em uma polia alta e selecione um peso adequado.
Fique de costas para a torre de cabo. Segure a corda com as duas mãos sobre os ombros, mantendo-a no peito. Esta é a posição inicial.
Execute o movimento flexionando a coluna, puxando o peso para baixo o máximo que puder.
Segure a contração máxima por um momento antes de retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia em pe com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Bosu_Ball_Cable_Crunch_With_Side_Bends')::uuid, 'Abdominal na polia no bosu com flexão lateral', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça a cada cabo de uma máquina, posicionando-os na parte mais baixa.
Coloque um Bosu Ball na frente da máquina.
Deite-se no Bosu Ball com a região lombar arqueada sobre a bola, glúteos próximos ao chão.
Segure as alças dos cabos com as duas mãos.
Com os pés afastados, estenda os braços para frente, entre os joelhos, na altura dos joelhos.
Mantenha os braços retos e eleve o torso em um movimento de crunch, sem dobrar os braços.
Desça lentamente à posição inicial, alongando os abdominais. Repita até a falha.
Após a falha, mantenha o abdômen contraído, eleve o torso para a posição de prancha e abaixe os braços ao lado do corpo. Faça flexões laterais alternadas, alcançando os calcanhares para trabalhar os oblíquos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia no bosu com flexao lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Seated_Crunch')::uuid, 'Abdominal na polia sentado', 'Abdômen', 'Polia', 'MAQUINA', 'Sente-se em um banco plano de costas para uma polia alta.
Segure a corda da polia com as duas mãos (palmas viradas uma para a outra) e posicione as mãos sobre os ombros. Dica: Permita uma leve hiperextensão lombar. Esta é a posição inicial.
Com os quadris imóveis, flexione a cintura trazendo os cotovelos em direção aos quadris. Expire durante o movimento.
Inspire ao retornar lentamente à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal na polia sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Flat_Bench_Leg_Pull-In')::uuid, 'Abdominal no banco sentado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Sente-se em um banco com as pernas estendidas à frente, ligeiramente abaixo do paralelo, e os braços segurando as laterais do banco. O torso deve estar inclinado para trás em um ângulo de cerca de 45 graus. Esta será a posição inicial.
Aproxime os joelhos em sua direção enquanto move o torso em direção a eles ao mesmo tempo. Expire ao realizar este movimento.
Após uma pausa de um segundo, retorne à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal no banco sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Oblique_Crunch')::uuid, 'Abdominal oblíquo no banco declinado', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Prenda as pernas na extremidade do banco declinado e deite-se lentamente.
Levante o tronco até formar um ângulo de 35-45 graus com o chão.
Coloque uma mão ao lado da cabeça e a outra na coxa. Esta é a posição inicial.
Levante o tronco lentamente enquanto gira para a esquerda, expirando até o cotovelo direito tocar o joelho esquerdo. Segure a contração por um segundo. Dica: Mantenha o abdômen contraído e o movimento controlado.
Abaixe o corpo lentamente à posição inicial inspirando.
Após uma série para o lado direito, troque para o lado esquerdo. Dica: Foque na torção do torso para sentir a contração.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal obliquo no banco declinado'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Ab_Rollout_-_On_Knees')::uuid, 'Abdominal rollout ajoelhado com barra', 'Abdômen', 'Barra', 'LIVRE', 'Segure uma barra olímpica com 2 a 5 kg de cada lado e ajoelhe-se no chão.
Coloque a barra no chão à sua frente, apoiando-se nas mãos e joelhos (como na posição de flexão ajoelhada). Esta será sua posição inicial.
Role a barra lentamente para frente, esticando o corpo em linha reta. Desça o máximo possível sem tocar o chão, inspirando durante o movimento.
Após uma pausa na posição esticada, puxe-se de volta à posição inicial enquanto expira. Mantenha os abdominais contraídos e vá devagar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal rollout ajoelhado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Ab_Rollout')::uuid, 'Abdominal rollout com barra', 'Abdômen', 'Barra', 'LIVRE', 'Posicione-se em uma posição de flexão, mas em vez de apoiar as mãos no chão, segure uma barra olímpica (com 2 a 5 kg de cada lado). Esta será sua posição inicial.
Mantendo uma leve curvatura nas costas, levante os quadris e role a barra em direção aos pés enquanto expira. Mantenha os abdominais contraídos e os braços perpendiculares ao chão.
Após uma breve contração no topo, role a barra de volta lentamente à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal rollout com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Rollout_from_Bench')::uuid, 'Abdominal rollout no banco com barra', 'Abdômen', 'Barra', 'LIVRE', 'Coloque uma barra carregada no chão, perto da ponta de um banco. Ajoelhe-se no banco e segure a barra com uma pegada média a estreita. Esta é a posição inicial.
Estenda os quadris para rolar a barra lentamente para frente, flexionando os ombros para elevá-la acima da cabeça. Mantenha os braços estendidos.
Quando a barra estiver no ponto máximo, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal rollout no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Leg_Tucks')::uuid, 'Abdominal sentado com flexão de joelhos', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Sente-se em um banco com as pernas estendidas ligeiramente abaixo do paralelo e as mãos segurando as laterais do banco. Incline o tronco para trás em um ângulo de 45 graus. Esta é a posição inicial.
Aproxime os joelhos de você enquanto move o tronco em direção a eles, expirando.
Após uma pausa de um segundo, retorne à posição inicial, inspirando.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal sentado com flexao de joelhos'),
  (md5('catalogo-exercicio:fedb:' || 'Crunches')::uuid, 'Abdominal supra', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com os pés no chão ou em um banco, joelhos a 90 graus. Se no banco, pés levemente afastados e dedos para dentro.
Coloque as mãos levemente ao lado da cabeça, cotovelos para dentro.
Pressione a lombar no chão e levante os ombros do chão, contraindo o abdômen e expirando. Os ombros devem subir cerca de 10 cm, com a lombar no chão. Contraia bem no topo por um segundo.
Volte lentamente à posição inicial inspirando.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal supra'),
  (md5('catalogo-exercicio:fedb:' || 'Alternate_Heel_Touchers')::uuid, 'Abdominal toque nos calcanhares', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão com os joelhos flexionados e os pés apoiados no chão, afastados cerca de 45-60 cm. Os braços devem estar estendidos ao lado do corpo. Esta é a posição inicial.
Faça uma flexão do tronco para frente e para cima cerca de 7-10 cm em direção ao lado direito e toque o calcanhar direito, mantendo a contração por um segundo. Expire durante o movimento.
Volte lentamente à posição inicial enquanto inspira.
Agora, flexione o tronco para frente e para cima cerca de 7-10 cm em direção ao lado esquerdo e toque o calcanhar esquerdo, mantendo a contração por um segundo. Expire durante o movimento e retorne à posição inicial enquanto inspira. Após tocar ambos os calcanhares, conta-se 1 repetição.
Continue alternando os lados dessa forma até completar todas as repetições prescritas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal toque nos calcanhares'),
  (md5('catalogo-exercicio:fedb:' || 'Sit-Up')::uuid, 'Abdominal tradicional', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão com os pés presos sob algo fixo ou com um parceiro segurando-os. As pernas devem estar flexionadas nos joelhos.
Coloque as mãos atrás da cabeça e entrelace os dedos. Esta é a posição inicial.
Eleve o tronco para formar um V imaginário com as coxas. Expire ao realizar esta parte do exercício.
Após sentir a contração por um segundo, abaixe o tronco de volta à posição inicial enquanto inspira.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abdominal tradicional'),
  (md5('catalogo-exercicio:fedb:' || 'Hug_A_Ball')::uuid, 'Abraçar a bola', 'Costas', 'Bola suíça', 'OUTRO', 'Sente-se no chão.
Coloque uma bola de exercício entre as pernas e abaixe os quadris em direção ao chão.
Abrace a bola com os braços para apoiar o corpo. Ajuste as pernas para que os pés fiquem apoiados no chão e os joelhos alinhados com os tornozelos. Segure bem a bola para evitar que role.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abracar a bola'),
  (md5('catalogo-exercicio:fedb:' || 'Hug_Knees_To_Chest')::uuid, 'Abraçar joelhos no peito', 'Costas', null, 'OUTRO', 'Deite-se de costas e puxe os dois joelhos em direção ao peito.
Segure os joelhos por baixo, não por cima (para não pressionar as articulações).
Puxe lentamente os joelhos em direção aos ombros. Isso também alonga os glúteos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'abracar joelhos no peito'),
  (md5('catalogo-exercicio:fedb:' || 'Linear_Acceleration_Wall_Drill')::uuid, 'Aceleração linear na parede', 'Posterior', null, 'OUTRO', 'Incline-se a cerca de 45 graus contra uma parede. Os pés devem estar juntos e os glúteos contraídos.
Comece levantando o joelho direito rapidamente, faça uma pausa e depois conduza-o reto para o chão.
Troque de pernas, levantando o joelho oposto e atacando o chão reto para baixo.
Repita mais uma vez com a perna direita e, assim que o pé direito tocar o chão, bata os pés rapidamente, alternando esquerda e direita o mais rápido possível.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'aceleracao linear na parede'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Hip_Adductions')::uuid, 'Adução de quadril com elástico', 'Adutores', 'Elástico', 'ELASTICO', 'Prenda uma banda em um poste sólido.
Fique com o lado esquerdo voltado para o poste e coloque o pé direito na banda, ao redor do tornozelo.
Fique em pé e segure o poste se precisar. Esta é a posição inicial.
Mantendo o joelho reto, levante a perna direita para o lado o máximo possível.
Retorne à posição inicial e repita para o número de repetições desejado.
Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'aducao de quadril com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Hip_Adduction')::uuid, 'Adução de quadril na polia', 'Quadríceps', 'Polia', 'MAQUINA', 'Fique de frente para uma polia baixa, com uma perna próxima à polia e a outra afastada.
Prenda a tornozeira no cabo e no tornozelo da perna próxima à polia.
Afaste-se da pilha de pesos com uma postura ampla e segure a barra da polia.
Fique na perna sem tornozeira e deixe a perna com tornozeira ser puxada em direção à polia. Esta é a posição inicial.
Mova a perna com tornozeira para frente, cruzando a perna de apoio, usando os adutores, expirando.
Retorne lentamente à posição inicial inspirando.
Repita e depois faça com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'aducao de quadril na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Adductor')::uuid, 'Adutor com rolo de espuma', 'Adutores', 'Rolo de liberação', 'OUTRO', 'Deite-se de bruços com uma perna sobre um rolo de espuma.
Gire a perna para que o rolo faça contato com a parte interna da coxa. Transfira o máximo de peso possível para o rolo.
Enquanto tenta relaxar os músculos da coxa interna, role sobre o rolo entre o quadril e o joelho, segurando pontos de tensão por 10-30 segundos. Repita com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'adutor com rolo de espuma'),
  (md5('catalogo-exercicio:fedb:' || 'Adductor_Groin')::uuid, 'Adutor/virilha com parceiro', 'Adutores', null, 'OUTRO', 'Deite-se de costas com os pés elevados em direção ao teto.
Peça ao seu parceiro para segurar seus pés ou tornozelos. Abduza as pernas o máximo que puder. Esta é a posição inicial.
Tente apertar as pernas juntas por 10 segundos ou mais, enquanto seu parceiro impede o movimento.
Relaxe os músculos das pernas enquanto seu parceiro empurra os pés para fora, alongando até onde for confortável. Avise seu parceiro quando o alongamento for adequado para evitar lesões.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'adutor/virilha com parceiro'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Lunge')::uuid, 'Afundo com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Para segurança, execute este exercício dentro de um rack de agachamento. Ajuste a barra logo abaixo da altura dos ombros. Após carregar a barra, posicione-se sob ela, apoiando-a nas costas dos ombros.
Segure a barra com as duas mãos e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e dê um passo à frente com a perna direita, agachando pelos quadris, mantendo o tronco ereto e o equilíbrio. Inspire ao descer. Dica: Não deixe o joelho ultrapassar a ponta dos pés.
Empurre com o calcanhar para retornar à posição inicial, expirando.
Repita pelo número recomendado de repetições e troque para a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Lunge_Pass_Through')::uuid, 'Afundo com passagem de kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', 'Fique em pé com o tronco ereto, segurando um kettlebell na mão direita. Esta será a posição inicial.
Dê um passo à frente com o pé esquerdo e abaixe o tronco flexionando o quadril e o joelho, mantendo o tronco ereto. Abaixe o joelho traseiro até quase tocar o chão.
Durante o afundo, passe o kettlebell sob a perna da frente para a mão oposta.
Empurrando pelo calcanhar, retorne à posição inicial.
Repita o movimento pelo número recomendado de repetições, alternando as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo com passagem de kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Lunge_Sprint')::uuid, 'Afundo explosivo no smith', 'Quadríceps', 'Máquina', 'MAQUINA', 'Ajuste a barra em uma máquina Smith à altura adequada. Posicione-se sob a barra, apoiando-a nas costas dos ombros. Retire a barra e afaste os pés, um à frente e outro atrás. Esta será a posição inicial.
Abaixe o joelho traseiro quase até o chão, flexionando os joelhos e baixando os quadris.
No ponto mais baixo, inverta imediatamente a direção. Exploda pelo calcanhar do pé da frente com leve pressão do pé de trás. Pule e troque a posição das pernas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo explosivo no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Elevated_Back_Lunge')::uuid, 'Afundo posterior elevado', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione uma barra em um suporte na altura dos ombros, com o peso adequado. Coloque uma plataforma baixa atrás de você.
Apoie a barra na parte superior das costas, mantendo as costas arqueadas e firmes. Suba na plataforma com os dois pés. Esta será sua posição inicial.
Dê um passo para trás com uma perna, flexionando quadris e joelhos até o joelho tocar o chão.
Pause e estenda quadris e joelhos para levantar, retornando à posição inicial antes de alternar as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo posterior elevado'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Rear_Lunge')::uuid, 'Afundo reverso com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Fique em pé com o torso ereto, segurando dois halteres ao lado do corpo. Esta é a posição inicial.
Dê um passo para trás com a perna direita, cerca de 60 cm da esquerda, e abaixe o corpo, mantendo o torso ereto e o equilíbrio. Inspire ao descer. Evite que o joelho da frente ultrapasse a ponta dos pés.
Expire e empurre com a ponta dos pés (para quadríceps) ou calcanhares (para glúteos) para voltar à posição inicial.
Repita com a perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo reverso com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Crossover_Reverse_Lunge')::uuid, 'Afundo reverso cruzado', 'Costas', null, 'OUTRO', 'Fique em pé com os pés na largura dos ombros. Esta é a posição inicial.
Dê um passo para trás com uma perna, flexionando os quadris e o joelho da frente, e gire o torso em direção à perna da frente.
Após uma pausa breve, retorne à posição inicial e repita do outro lado, alternando.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundo reverso cruzado'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Squats')::uuid, 'Afundos com salto', 'Posterior', null, 'OUTRO', 'Em pé, salte para uma posição de afundo, com uma perna à frente e a outra atrás, flexionando os joelhos e abaixando levemente os quadris.
Ao descer, inverta imediatamente a direção, levantando-se e saltando, trocando a posição das pernas. Repita 5 a 10 vezes em cada perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'afundos com salto'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Squat')::uuid, 'Agachamento ajoelhado com barra', 'Glúteos', 'Barra', 'LIVRE', 'Ajuste a barra na altura correta em um power rack. Ajoelhe-se atrás da barra; use um tapete para amortecer os joelhos. Passe sob a barra, apoiando-a nas costas. Retraia as escápulas e mantenha a barra firme. Desengate o peso.
Com o olhar para frente, sente-se para trás até os glúteos tocarem as panturrilhas.
Inverta o movimento, retornando o tronco à posição ereta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento ajoelhado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Squat_To_A_Bench')::uuid, 'Agachamento até o banco com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Fique em pé com um banco plano atrás de você, segurando um halter em cada mão (palmas voltadas para as pernas).
Posicione as pernas na largura dos ombros, com os pés levemente apontados para fora. Mantenha a cabeça erguida e as costas retas. Esta é sua posição inicial.
Abaixe o torso lentamente, flexionando os joelhos, até tocar levemente o banco atrás, inspirando. Dica: Evite que os joelhos ultrapassem os dedos dos pés.
Empurre o chão com os calcanhares para retornar à posição inicial, expirando.
Repita para o número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento ate o banco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Squat_with_Dumbbells')::uuid, 'Agachamento búlgaro com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Posicione-se em um afundo com o pé traseiro elevado e o pé dianteiro à frente.
Segure um halter em cada mão, deixando-os pendurados ao lado do corpo. Esta é a posição inicial.
Comece descendo, flexionando o joelho e o quadril para abaixar o corpo. Mantenha uma postura correta durante o movimento. Mantenha o joelho da frente alinhado com o pé.
No ponto mais baixo, empurre pelo calcanhar para estender o joelho e o quadril e retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento bulgaro com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Single-Leg_Split_Squat')::uuid, 'Agachamento búlgaro no smith', 'Quadríceps', 'Máquina', 'MAQUINA', 'Posicione um banco plano atrás da máquina Smith. Ajuste a barra para sua altura. Com a barra carregada, posicione-se sob ela, apoiando-a nas costas dos ombros.
Segure a barra com as duas mãos nas laterais, destrave-a e levante-a do suporte empurrando com as pernas e endireitando o tronco.
Posicione uma perna levemente para frente sob a barra e estenda a outra para trás, apoiando o peito do pé no banco. Esta é a posição inicial.
Abaixe a barra lentamente dobrando o joelho da perna da frente, mantendo a postura reta e a cabeça erguida. Desça até a coxa ficar abaixo do paralelo com o chão. Inspire durante esse movimento. Dica: O joelho não deve passar a linha dos dedos do pé.
Levante a barra enquanto expira, empurrando o chão principalmente com o calcanhar da perna da frente e estendendo a perna até voltar à posição inicial.
Repita para a quantidade recomendada de repetições.
Troque de perna e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento bulgaro no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Suspended_Split_Squat')::uuid, 'Agachamento búlgaro no TRX', 'Quadríceps', null, 'OUTRO', 'Suspenda as tiras para que as alças fiquem a 45-75 cm do chão.
De costas para a montagem, coloque o pé traseiro na alça atrás de você. Mantenha a cabeça erguida, peito para cima e joelho levemente flexionado. Esta é a posição inicial.
Desça flexionando o joelho e os quadris, abaixando-se em direção ao chão. Mantenha o peso no calcanhar e a postura durante o exercício.
No ponto mais baixo, inverta o movimento, estendendo o quadril e o joelho para voltar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento bulgaro no trx'),
  (md5('catalogo-exercicio:fedb:' || 'Squat_with_Chains')::uuid, 'Agachamento com correntes', 'Quadríceps', 'Barra', 'LIVRE', 'Para montar as correntes, passe a corrente guia sobre as extremidades da barra. A corrente pesada deve ser presa com um gancho. Ajuste o comprimento para que alguns elos ainda toquem o chão no topo do movimento.
Posicione-se sob a barra e apoie-a nas costas dos ombros. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros. Retire a barra do rack, mantendo uma curvatura firme na lombar, e afaste-se. Posicione os pés afastados para enfatizar costas, glúteos, adutores e isquiotibiais. Mantenha a cabeça voltada para a frente.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris o máximo possível. Idealmente, as canelas devem ficar perpendiculares ao chão. Continue até ultrapassar o paralelo, definido como a dobra do quadril alinhada com o topo do joelho.
Mantendo o peso nos calcanhares e empurrando os pés e joelhos para fora, suba liderando com a cabeça. Continue subindo, mantendo a tensão, até retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Squat_with_Plate_Movers')::uuid, 'Agachamento com deslocamento de anilhas', 'Quadríceps', 'Barra', 'LIVRE', 'Comece ajustando a barra em um rack logo abaixo da altura dos ombros. Coloque uma anilha no chão a alguns passos de distância. Com a barra carregada, posicione-se sob ela e apoie-a nas costas dos ombros.
Segure a barra com ambas as mãos e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e adote uma postura larga com os pés ligeiramente voltados para fora, com um pé sobre a anilha. Mantenha a cabeça erguida. Esta é a posição inicial.
Comece a abaixar a barra lentamente, flexionando joelhos e quadris. Continue até que o ângulo entre a coxa e a panturrilha fique ligeiramente menor que 90 graus.
Levante a barra expirando, empurrando o chão com os calcanhares e estendendo quadris e joelhos.
No topo do movimento, dê um passo lateral, juntando os pés no lado oposto da anilha.
Com o pé interno, empurre a anilha, deslizando-a pelo chão para onde você estava.
Coloque o pé interno na anilha, adotando uma postura larga para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com deslocamento de anilhas'),
  (md5('catalogo-exercicio:fedb:' || 'Squat_with_Bands')::uuid, 'Agachamento com elásticos', 'Quadríceps', 'Barra', 'LIVRE', 'Prenda os elásticos nas extremidades da barra, fixando-os em suportes, no rack ou em halteres para criar tensão adequada.
Posicione-se sob a barra e apoie-a nas costas dos ombros. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros. Retire a barra do rack, mantendo uma curvatura firme na lombar, e afaste-se. Posicione os pés afastados para enfatizar costas, glúteos, adutores e isquiotibiais. Mantenha a cabeça voltada para a frente.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris o máximo possível. Idealmente, as canelas devem ficar perpendiculares ao chão. Continue até ultrapassar o paralelo, definido como a dobra do quadril alinhada com o topo do joelho.
Mantendo o peso nos calcanhares e empurrando os pés e joelhos para fora, suba liderando com a cabeça. Continue subindo, mantendo a tensão, até retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Squat')::uuid, 'Agachamento com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Fique em pé segurando um halter em cada mão (palmas voltadas para as pernas).
Posicione as pernas na largura dos ombros, com os pés levemente apontados para fora. Mantenha a cabeça erguida e as costas retas. Esta é sua posição inicial.
Abaixe o torso lentamente, flexionando os joelhos, até que as coxas fiquem paralelas ao chão. Dica: Os joelhos não devem ultrapassar a linha dos dedos dos pés.
Empurre o chão com os calcanhares para retornar à posição inicial, expirando.
Repita para o número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Jump_Squat')::uuid, 'Agachamento com salto ajoelhado', 'Glúteos', 'Barra', 'LIVRE', 'Comece ajoelhado no chão com uma barra apoiada nas costas, ou use apenas o peso do corpo. Pode ser feito em um power rack para facilitar.
Sente-se para trás com os quadris até os glúteos tocarem os pés, mantendo o peito erguido.
Exploda para cima com os quadris, gerando força suficiente para aterrissar com os pés planos no chão.
Continue o agachamento, empurrando pelos calcanhares e estendendo os joelhos para ficar em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com salto ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Jump_Squat')::uuid, 'Agachamento com salto e sobrecarga', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione uma barra leve nas costas ou use um colete com peso. Pés ligeiramente além da largura dos ombros, cabeça e peito erguidos.
Faça um agachamento parcial e reverta rapidamente para explodir em um salto, estendendo quadris, joelhos e tornozelos.
Ao aterrissar, absorva o impacto com as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com salto e sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Freehand_Jump_Squat')::uuid, 'Agachamento com salto livre', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Cruze os braços sobre o peito.
Com a cabeça erguida e as costas retas, posicione os pés na largura dos ombros.
Mantendo as costas retas e o peito para cima, agache inspirando até as coxas ficarem paralelas ou abaixo do chão.
Pressione principalmente com a ponta dos pés e salte o mais alto possível, usando as coxas como molas. Expire durante o salto.
Ao tocar o chão, agache imediatamente e salte novamente.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com salto livre'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Squat')::uuid, 'Agachamento com sobrecarga', 'Quadríceps', null, 'OUTRO', 'Posicione dois bancos planos na largura dos ombros e fique em cima deles. Use um cinto de carga com o peso desejado na cintura, com os pés apontados para fora.
Com o corpo ereto e os braços estendidos para os lados, esta é a posição inicial.
Dobre os joelhos mantendo a postura reta e a cabeça erguida, descendo até que as coxas fiquem abaixo do paralelo ao chão (ângulo menor que 90 graus). Inspire ao descer, garantindo que os joelhos não ultrapassem a linha dos dedos dos pés.
Empurre o chão com a planta dos pés para retornar à posição inicial, expirando ao subir.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento com sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Band_Power_Squat')::uuid, 'Agachamento de potência com elástico reversa', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione-se em um rack de potência com os pinos e a barra na altura adequada. Após carregar a barra, prenda as bandas na parte superior do rack, usando pinos ou a estrutura. Conecte a outra extremidade à barra.
Passe por baixo da barra e apoie-a nas costas dos ombros. Junte as escápulas e gire os cotovelos para frente. Retire a barra do rack, mantendo a lombar arqueada, e dê um passo para trás. Posicione os pés afastados para enfatizar costas, glúteos, adutores e isquiotibiais.
Mantenha a cabeça erguida. Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás o máximo possível, com as canelas perpendiculares ao chão. Uma posição mais baixa da barra exige maior inclinação do tronco. Desça até o quadril ficar alinhado com os joelhos (paralelo).
Mantenha o peso nos calcanhares, empurre os pés e joelhos para fora e levante-se, liderando com a cabeça. Continue subindo com tensão total até a posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento de potencia com elastico reversa'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Leg_High_Box_Squat')::uuid, 'Agachamento em caixa alta unilateral', 'Quadríceps', null, 'OUTRO', 'Posicione uma caixa em um rack e prenda uma faixa ou corda acima dela.
Fique em frente à caixa, suba nela com uma perna até ficar em pé, mantendo a outra perna no ar. Segure a faixa para equilíbrio.
Continue subindo e descendo com a mesma perna antes de trocar de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento em caixa alta unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Speed_Box_Squat')::uuid, 'Agachamento em caixa de velocidade', 'Quadríceps', 'Barra', 'LIVRE', 'Prenda bandas à barra que estejam firmemente ancoradas perto do chão. Pode ser necessário ajustar as bandas para obter tensão adequada.
Use uma caixa de altura apropriada para este exercício. Carregue a barra com um peso que exija esforço, mas não tão pesado que comprometa a velocidade. Normalmente, entre 50-70% da sua repetição máxima.
Posicione a barra na parte superior das costas, com as escápulas retraídas, costas arqueadas e tudo tensionado da cabeça aos pés. Esta será a posição inicial.
Desengate a barra e posicione-se em frente à caixa. Sente-se para trás com os quadris até sentar na caixa, descendo com controle e sem bater na superfície.
Faça uma breve pausa e exploda para fora da caixa, estendendo os quadris e joelhos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento em caixa de velocidade'),
  (md5('catalogo-exercicio:fedb:' || 'Frankenstein_Squat')::uuid, 'Agachamento frankenstein', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício ensina a posição correta da barra e do corpo durante o clean e o agachamento frontal.
Posicione a barra na frente dos ombros, solte o pegada e estenda os braços para a frente. Empurre os ombros para frente para criar uma ''prateleira'', mantendo a barra em contato com a garganta. Mova apenas as escápulas para frente, sem arredondar a coluna torácica.
Agache flexionando joelhos e quadris, sentando entre as pernas. Mantenha o tronco ereto, braços levantados, ombros para frente, e a barra no lugar. Desça até os isquiotibiais tocarem as panturrilhas.
Retorne à posição inicial empurrando com a parte frontal do calcanhar e estendendo joelhos e quadris.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento frankenstein'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Barbell_Squat')::uuid, 'Agachamento frontal com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Execute este exercício em um rack de agachamento para segurança. Ajuste a barra na altura correta e carregue-a. Coloque os braços sob a barra com cotovelos altos e braços ligeiramente acima do paralelo ao chão. Apoie a barra nos deltoides e cruze os braços para controle.
Levante a barra do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack com os pés na largura dos ombros e dedos ligeiramente para fora. Mantenha a cabeça erguida e as costas retas. Esta é a posição inicial.
Abaixe a barra lentamente, flexionando os joelhos e mantendo a postura. Desça até as coxas ficarem abaixo do paralelo (ângulo menor que 90 graus). Inspire. Certifique-se de que os joelhos não ultrapassem a linha dos dedos.
Eleve a barra expirando, empurrando o chão com a parte média do pé e estendendo as pernas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento frontal com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Squats_With_Two_Kettlebells')::uuid, 'Agachamento frontal com dois kettlebells', 'Quadríceps', 'Kettlebell', 'LIVRE', 'Leve dois kettlebells aos ombros, estendendo as pernas e quadris para puxá-los, girando os pulsos.
Olhe sempre para frente, agache o máximo possível e pause no fundo. Ao agachar, empurre os joelhos para fora, mantendo o torso ereto e o peito para cima.
Volte à posição inicial empurrando pelos calcanhares e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento frontal com dois kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Barbell_Squat_To_A_Bench')::uuid, 'Agachamento frontal no banco com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Execute em um rack de agachamento com um banco plano atrás de você. Ajuste a barra na altura correta e carregue-a. Posicione os braços sob a barra com cotovelos altos, apoiando-a nos deltoides e cruzando os braços.
Levante a barra do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack com os pés na largura dos ombros e dedos ligeiramente para fora. Mantenha a cabeça erguida e as costas retas. Esta é a posição inicial.
Abaixe a barra lentamente até os glúteos tocarem o banco. Inspire. Verifique se os joelhos não ultrapassam os dedos.
Eleve a barra expirando, empurrando com os calcanhares e estendendo as pernas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento frontal no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Squat_Clean_Grip')::uuid, 'Agachamento frontal pegada clean', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione a barra no suporte logo abaixo da altura dos ombros. Apoie-a sobre os deltoides, pressionando as clavículas e tocando levemente a garganta. Use uma pegada de arranco, com os dedos ajudando a manter a barra.
Tire a barra do suporte empurrando com as pernas e endireitando o torso. Afaste-se e posicione os pés na largura dos ombros, com os dedos ligeiramente para fora. Mantenha a cabeça e os cotovelos altos. Esta é a posição inicial.
Dobre os joelhos, agachando-se entre as pernas até os isquiotibiais tocarem as panturrilhas. Mantenha os joelhos alinhados com os pés, empurrando-os para fora.
Levante a barra expirando, empurrando o chão com os calcanhares ou meio do pé, e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento frontal pegada clean'),
  (md5('catalogo-exercicio:fedb:' || 'Goblet_Squat')::uuid, 'Agachamento goblet com halter', 'Quadríceps', 'Kettlebell', 'LIVRE', 'Fique em pé segurando um kettlebell leve pelos chifres próximo ao peito. Esta será sua posição inicial.
Agache-se entre as pernas até que os isquiotibiais toquem as panturrilhas. Mantenha o peito e a cabeça erguidos e as costas retas.
Na posição mais baixa, faça uma pausa e use os cotovelos para empurrar os joelhos para fora. Retorne à posição inicial e repita por 10 a 20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento goblet com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Hack_Squat')::uuid, 'Agachamento hack', 'Quadríceps', 'Máquina', 'MAQUINA', 'Apoie as costas no encosto da máquina e encaixe os ombros sob as almofadas fornecidas.
Posicione as pernas na plataforma com uma postura de largura média dos ombros e os pés ligeiramente apontados para fora. Dica: Mantenha a cabeça erguida e as costas sempre apoiadas no encosto.
Coloque os braços nas alças laterais da máquina e desengate as travas de segurança (geralmente feito girando as alças de uma posição frontal para diagonal).
Estenda as pernas sem travar os joelhos. Esta será sua posição inicial.
Comece a abaixar a unidade lentamente, flexionando os joelhos enquanto mantém a postura reta e a cabeça erguida. Continue descendo até que o ângulo entre a coxa e a panturrilha fique ligeiramente menor que 90 graus (quando as coxas estão abaixo do paralelo ao chão). Inspire durante essa fase.
Comece a levantar a unidade ao expirar, empurrando o chão principalmente com os calcanhares enquanto estende as pernas de volta à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento hack'),
  (md5('catalogo-exercicio:fedb:' || 'Narrow_Stance_Hack_Squats')::uuid, 'Agachamento hack pés juntos', 'Quadríceps', 'Máquina', 'MAQUINA', 'Apoie as costas no encosto da máquina e encaixe os ombros sob as almofadas de apoio.
Posicione as pernas na plataforma com uma postura mais fechada que a largura dos ombros, dedos dos pés ligeiramente apontados para fora. Os pés devem estar cerca de 7 cm ou menos de distância. Dica: Mantenha a cabeça erguida e as costas sempre apoiadas no encosto.
Coloque os braços nas alças laterais da máquina e desengate as travas de segurança (geralmente girando as alças de uma posição frontal para diagonal).
Estenda as pernas sem travar os joelhos. Esta será a posição inicial.
Comece a abaixar a unidade flexionando os joelhos, mantendo a postura reta e a cabeça erguida. Desça até que o ângulo entre as coxas e as panturrilhas fique ligeiramente menor que 90 graus (quando as coxas estão abaixo do paralelo ao chão). Inspire durante essa parte.
Comece a levantar a unidade expirando, empurrando o chão principalmente com os calcanhares enquanto estende as pernas de volta à posição inicial.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento hack pes juntos'),
  (md5('catalogo-exercicio:fedb:' || 'Jefferson_Squats')::uuid, 'Agachamento jefferson', 'Quadríceps', 'Barra', 'LIVRE', 'Coloque uma barra no chão.
Fique no meio da barra no sentido do comprimento.
Abaixe-se flexionando os joelhos, com as costas retas, e segure a frente da barra com a mão direita (pegada neutra, palma para a esquerda) e a parte de trás com a mão esquerda (pegada neutra, palma para a direita). As distâncias das mãos ao torso devem ser iguais.
Fique em pé com a barra. Os pés devem estar na largura dos ombros, dedos ligeiramente para fora.
Agache flexionando os joelhos, mantendo as costas retas, até as coxas ficarem paralelas ao chão. Inspire e evite que os joelhos ultrapassem os dedos dos pés.
Volte à posição inicial empurrando com os pés. Os braços servem apenas como ganchos; o esforço é feito com as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento jefferson'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Side_Split_Squat')::uuid, 'Agachamento lateral com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Fique em pé, segurando uma barra apoiada nas costas dos ombros (ligeiramente abaixo do pescoço). Os pés devem estar bem afastados, com o pé da perna da frente virado para o lado. Esta será a posição inicial.
Abaixe o corpo em direção ao lado do pé virado, flexionando o joelho e o quadril da perna da frente, enquanto mantém a perna oposta levemente flexionada. Inspire enquanto abaixa o corpo.
Retorne à posição inicial estendendo o quadril e o joelho da perna da frente. Expire enquanto executa este movimento.
Após realizar a quantidade recomendada de repetições, repita o movimento com a perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento lateral com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Squat')::uuid, 'Agachamento livre com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Para começar, ajuste a barra no rack logo abaixo da altura dos ombros. Com a altura correta escolhida e a barra carregada, posicione-se sob a barra e apoie-a nas costas dos ombros (ligeiramente abaixo do pescoço).
Segure a barra com ambas as mãos nas laterais e levante-a do rack empurrando com as pernas e endireitando o tronco ao mesmo tempo.
Afaste-se do rack e posicione as pernas com uma postura média na largura dos ombros, com os pés levemente virados para fora. Mantenha a cabeça erguida e as costas retas. Esta será a posição inicial.
Comece a abaixar a barra lentamente, flexionando os joelhos e os quadris, mantendo a postura reta e a cabeça erguida. Continue descendo até que o ângulo entre a coxa e a panturrilha fique ligeiramente menor que 90 graus. Inspire durante esta parte do movimento.
Comece a levantar a barra enquanto expira, empurrando o chão com o calcanhar para estender as pernas e voltar à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento livre com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Wide_Stance_Barbell_Squat')::uuid, 'Agachamento livre com base aberta', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Comece ajustando a barra em uma altura adequada. Após carregar a barra, posicione-se sob ela, apoiando-a nas costas dos ombros (logo abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas em uma base mais larga que os ombros, com os pés ligeiramente voltados para fora. Mantenha a cabeça erguida e as costas retas. Esta é a posição inicial.
Comece a descer lentamente, flexionando os joelhos e mantendo a postura ereta. Desça até que as coxas fiquem abaixo do paralelo com o chão (ângulo menor que 90 graus). Inspire durante essa fase. Dica: Os joelhos não devem ultrapassar a linha dos pés.
Suba a barra expirando, empurrando o chão com os calcanhares e estendendo as pernas até voltar à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento livre com base aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Narrow_Stance_Squats')::uuid, 'Agachamento livre com base fechada', 'Quadríceps', 'Barra', 'LIVRE', 'Para segurança, realize este exercício dentro de um rack de agachamento. Ajuste a barra na altura adequada e carregue-a. Posicione-se sob a barra, apoiando-a nas costas dos ombros (logo abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack empurrando com as pernas e endireitando o torso.
Afaste-se do rack e posicione as pernas com uma postura mais fechada que a largura dos ombros, dedos dos pés ligeiramente apontados para fora. Os pés devem estar entre 7-15 cm de distância. Mantenha a cabeça erguida e as costas retas. Esta será a posição inicial.
Comece a abaixar a barra flexionando os joelhos, mantendo a postura reta. Desça até que o ângulo entre as coxas e as panturrilhas fique ligeiramente menor que 90 graus. Inspire durante essa parte. Dica: Os joelhos devem alinhar-se com os dedos dos pés; se passarem deles, a técnica está incorreta.
Comece a levantar a barra expirando, empurrando o chão com os calcanhares enquanto estende as pernas de volta à posição inicial.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento livre com base fechada'),
  (md5('catalogo-exercicio:fedb:' || 'Bodyweight_Squat')::uuid, 'Agachamento livre com peso corporal', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com os pés na largura dos ombros, mãos atrás da cabeça. Esta é a posição inicial.
Flexione joelhos e quadris, sentando para trás com os quadris.
Desça até a amplitude completa, se possível, e reverta rapidamente o movimento para retornar à posição inicial. Mantenha o peito erguido e os joelhos para fora durante o agachamento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento livre com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'Chair_Squat')::uuid, 'Agachamento na cadeira', 'Quadríceps', 'Máquina', 'MAQUINA', 'Ajuste a barra para uma altura adequada à sua estatura. Carregue a barra, posicione-se sob ela e apoie-a nas costas dos ombros.
Segure a barra com as palmas voltadas para frente, destrave-a e levante-a do suporte estendendo as pernas.
Dê um passo à frente, cerca de 45 cm, posicionando os pés na largura dos ombros com os dedos ligeiramente para fora. Mantenha o olhar para frente e a coluna neutra ou levemente arqueada. Esta é a posição inicial.
Abaixe a barra lentamente, flexionando os joelhos e mantendo a postura ereta, até que as coxas fiquem paralelas ao chão ou um pouco abaixo.
Levante a barra expirando, empurrando o chão com os calcanhares e estendendo os joelhos para voltar à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento na cadeira'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Band_Box_Squat')::uuid, 'Agachamento na caixa com elástico reversa', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione-se em um rack de potência com uma caixa atrás de você na altura adequada. Prenda as bandas em pinos ou na parte superior do rack, garantindo que fiquem diretamente acima da barra durante o agachamento. Conecte a outra extremidade à barra.
Passe por baixo da barra e apoie-a nas costas dos ombros. Junte as escápulas e gire os cotovelos para frente, como se tentasse dobrar a barra. Retire a barra do rack, mantendo uma leve curvatura na lombar, e dê um passo para trás. Posicione os pés mais afastados para ativar mais costas, glúteos, adutores e isquiotibiais, ou mais próximos para os quadríceps. Mantenha a cabeça erguida.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris até apoiar na caixa. Os canelas devem ficar perpendiculares ao chão. Faça uma pausa na caixa e relaxe os flexores do quadril. Evite quicar.
Mantenha o peso nos calcanhares, empurre os pés e joelhos para fora e levante-se da caixa, liderando com a cabeça. Continue subindo, mantendo a tensão corporal. Retorne a barra ao rack com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento na caixa com elastico reversa'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Machine_Squat')::uuid, 'Agachamento na máquina deitado', 'Quadríceps', 'Máquina', 'MAQUINA', 'Ajuste a máquina de pernas para uma altura que permita entrar com os joelhos flexionados e as coxas ligeiramente abaixo do paralelo.
Após selecionar o peso, posicione-se dentro da máquina de costas, com os joelhos flexionados e as coxas ligeiramente abaixo do paralelo à plataforma. Certifique-se de que os joelhos não ultrapassem os dedos dos pés. O ângulo entre os isquiotibiais e as panturrilhas deve ser menor que 90 graus. As costas e a cabeça devem estar apoiadas na máquina, com os ombros pressionados sob as almofadas.
Coloque as mãos nas alças e posicione os pés ligeiramente apontados para fora, na largura dos ombros. Esta será sua posição inicial.
Ao expirar, pressione com a ponta dos pés e erga o corpo, contraindo os quadríceps. Segure a posição contraída por um segundo. Dica: Na primeira repetição, pode-se usar as mãos para ajudar, pressionando as coxas.
Ao inspirar, agache lentamente, parando quando as coxas estiverem paralelas à plataforma (ângulo de 90 graus).
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento na maquina deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Squat_To_A_Bench')::uuid, 'Agachamento no banco com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Para começar, coloque um banco plano ou uma caixa atrás de você. O banco é usado para ensinar a levar os quadris para trás e atingir a profundidade correta.
Ajuste a barra no rack na altura adequada. Com a barra carregada, posicione-se sob ela e apoie-a nas costas dos ombros (ligeiramente abaixo do pescoço).
Segure a barra com ambas as mãos nas laterais e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas com uma postura média na largura dos ombros, com os pés levemente virados para fora. Mantenha a cabeça erguida e as costas retas. Esta será a posição inicial.
Comece a abaixar a barra lentamente, flexionando os joelhos e levando os quadris para trás, mantendo a postura reta. Continue descendo até tocar levemente o banco atrás de você. Inspire durante esta parte do movimento.
Comece a levantar a barra enquanto expira, empurrando o chão com o calcanhar para estender as pernas e os quadris, voltando à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Jerk_Dip_Squat')::uuid, 'Agachamento no fundo do jerk', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com a barra na posição de arranco: ombros para frente formando uma prateleira, barra levemente tocando o pescoço, pés sob os quadris e dedos virados para fora confortavelmente.
Mantendo o torso vertical, flexione os joelhos para fazer um fundo curto, permitindo que avancem sem mover os quadris para trás.
Retorne à posição inicial empurrando com força pelos pés.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento no fundo do jerk'),
  (md5('catalogo-exercicio:fedb:' || 'Olympic_Squat')::uuid, 'Agachamento olímpico', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com a barra apoiada no trapézio. Mantenha o peito para cima e a cabeça voltada para frente. Adote uma postura com os pés na largura do quadril, apontados para fora conforme necessário.
Desça flexionando os joelhos, evitando mover os quadris para trás. Isso faz com que os joelhos avancem; mantenha-os alinhados com os pés. O objetivo é manter o torso o mais ereto possível. Desça completamente, mantendo o peso nos calcanhares.
Quando as coxas tocarem as panturrilhas, inverta o movimento, empurrando o peso para cima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento olimpico'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Overhead_Kettlebell_Squats')::uuid, 'Agachamento overhead com kettlebell', 'Quadríceps', 'Kettlebell', 'LIVRE', 'Faça um clean e press com um kettlebell usando um braço. Leve o kettlebell ao ombro estendendo as pernas e quadris enquanto puxa o kettlebell em direção ao ombro, girando o pulso. Em seguida, pressione o peso acima da cabeça estendendo o cotovelo. Esta será sua posição inicial.
Olhando para frente e mantendo o kettlebell travado acima de você, flexione os joelhos e quadris, abaixando o tronco entre as pernas, mantendo a cabeça e o peito erguidos.
Faça uma pausa na posição inferior por um segundo antes de subir de volta ao topo, empurrando através dos calcanhares.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento overhead com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Pistol_Squat')::uuid, 'Agachamento pistol no smith', 'Quadríceps', 'Máquina', 'MAQUINA', 'Ajuste a barra para uma altura que combine com sua estatura. Posicione-se sob ela, apoiando a barra nas costas dos ombros.
Segure a barra com as mãos para frente, desengate-a e levante-a estendendo as pernas.
Coloque um pé cerca de 30 cm à frente da barra. Estenda a outra perna para frente, mantendo-a fora do chão. Olhe para frente e mantenha a coluna neutra ou levemente arqueada. Esta é a posição inicial.
Mantendo uma boa postura, abaixe-se flexionando o joelho e o quadril, indo o mais baixo que a flexibilidade permitir.
Faça uma pausa breve no fundo e retorne à posição inicial empurrando com o calcanhar, estendendo joelho e quadril.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento pistol no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Full_Squat')::uuid, 'Agachamento profundo com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione a barra em um rack logo acima da altura dos ombros. Coloque-se sob a barra, apoiando-a nas costas dos ombros (logo abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas na largura dos ombros, com os pés levemente apontados para fora. Mantenha a cabeça erguida e as costas retas. Esta será sua posição inicial.
Comece a descer lentamente, dobrando os joelhos e sentando com os quadris, mantendo a postura reta. Desça até que os isquiotibiais toquem as panturrilhas, inspirando.
Levante a barra expirando, empurrando o chão com os calcanhares e estendendo as pernas e quadris para voltar à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento profundo com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Sissy_Squat')::uuid, 'Agachamento sissy com sobrecarga', 'Quadríceps', 'Barra', 'LIVRE', 'Em pé, com os pés na largura dos ombros e os dedos levantados, segure-se em uma barra de suporte com uma mão e segure uma anilha no peito com a outra. Esta é a posição inicial.
Dobre os joelhos e abaixe o tronco lentamente, levando a pélvis e os joelhos para frente, até que as coxas e as panturrilhas formem um ângulo de quase 90 graus. Inspire ao descer e segure por um segundo.
Use os músculos das coxas para levantar o tronco de volta à posição inicial, expirando ao subir.
Repita para o número recomendado de vezes.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento sissy com sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Plie_Dumbbell_Squat')::uuid, 'Agachamento sumô com halter', 'Quadríceps', 'Halteres', 'LIVRE', 'Segure um halter pela base com as duas mãos e fique em pé com as pernas afastadas além da largura dos ombros e joelhos levemente flexionados.
Os pés devem estar apontados para fora. Dica: os braços devem ficar imóveis durante o exercício. Esta é a posição inicial.
Flexione os joelhos lentamente e abaixe-se até que as coxas fiquem paralelas ao chão. Inspire durante essa fase excêntrica.
Empurre principalmente com os calcanhares para voltar à posição inicial enquanto expira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento sumo com halter'),
  (md5('catalogo-exercicio:fedb:' || 'One_Leg_Barbell_Squat')::uuid, 'Agachamento unilateral com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Fique de pé a cerca de 2 a 3 pés de um banco plano, de costas para ele. Tenha uma barra no chão à sua frente.
Agache-se e segure a barra com pegada pronada, mãos mais largas que os ombros, e levante-a até apoiá-la no peito.
Levante a barra sobre a cabeça e apoie-a na base do pescoço. Coloque um pé atrás, com o dedo apoiado no banco; o outro pé deve ficar fixo à frente. Mantenha a cabeça erguida e as costas retas.
Inspire e abaixe a perna até a coxa ficar paralela ao chão, com o joelho alinhado com os dedos do pé.
Contraia os quadríceps e levante a perna de volta à posição inicial, expirando.
Repita as repetições recomendadas e troque de perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento unilateral com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Zercher_Squats')::uuid, 'Agachamento Zercher com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Comece ajustando a barra em uma altura adequada, acima da cintura e abaixo do peito. Com a barra carregada, entrelace as mãos e apoie a barra sobre os antebraços, entre o braço e o antebraço.
Levante a barra para que ela descanse sobre os antebraços. A posição correta deve parecer que você está com os braços cruzados segurando a barra.
Afaste-se do rack e posicione as pernas com uma postura na largura dos ombros, pés ligeiramente apontados para fora. Mantenha a cabeça erguida e as costas retas. Esta é a posição inicial.
Comece a descer flexionando os joelhos, mantendo a postura ereta e a cabeça para cima. Continue até que as coxas fiquem ligeiramente abaixo do paralelo com o chão (ângulo menor que 90 graus). Inspire durante essa fase. Dica: Os joelhos não devem ultrapassar a linha dos dedos dos pés para evitar estresse excessivo.
Para subir, expire e empurre o chão com a planta dos pés, estendendo as pernas até retornar à posição inicial.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamento zercher com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Squats_-_With_Bands')::uuid, 'Agachamentos com elásticos', 'Quadríceps', 'Elástico', 'ELASTICO', 'Para começar, certifique-se de que o elástico esteja dividido igualmente entre os lados do corpo. Segure ambos os lados do elástico e coloque os pés no meio dele. Os pés devem estar na largura dos ombros.
Ao segurar as alças, elas devem estar na mesma altura. Use uma pegada pronada (palmas para frente) e mantenha as alças próximas ao rosto. Esta é a posição inicial.
Comece a flexionar os joelhos e abaixar as pernas lentamente até que as coxas fiquem paralelas ao chão, expirando.
Use os calcanhares para empurrar o corpo de volta à posição inicial, expirando.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamentos com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'Speed_Squats')::uuid, 'Agachamentos de velocidade', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Para começar, ajuste a barra em um rack na sua altura. Com a altura correta e a barra carregada, posicione-se sob a barra e apoie-a na parte posterior dos ombros (ligeiramente abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas com uma postura na largura dos ombros, pés ligeiramente virados para fora. Mantenha a cabeça erguida e as costas retas. Esta será a posição inicial.
Comece a abaixar a barra flexionando os joelhos, mantendo a postura ereta e a cabeça erguida. Continue até que o ângulo entre as coxas e as panturrilhas fique ligeiramente menor que 90 graus (ponto em que as coxas estão abaixo do paralelo ao chão). Inspire durante essa fase.
Comece a levantar a barra o mais rápido possível, sem usar impulso, expirando e empurrando o chão com os calcanhares para endireitar as pernas e voltar à posição inicial. Execute de forma rápida, mas mantendo a forma correta e sem impulso.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamentos de velocidade'),
  (md5('catalogo-exercicio:fedb:' || 'Sit_Squats')::uuid, 'Agachamentos parciais', 'Quadríceps', null, 'OUTRO', 'Fique em pé com os pés na largura dos ombros. Esta é a posição inicial.
Comece o movimento flexionando os joelhos e quadris, sentando-se para trás com os quadris.
Continue até agachar parcialmente, mas acima do paralelo, e rapidamente inverta o movimento até retornar à posição inicial. Repita por 5 a 10 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'agachamentos parciais'),
  (md5('catalogo-exercicio:fedb:' || 'Spinal_Stretch')::uuid, 'Alongamento da coluna', 'Costas', null, 'OUTRO', 'Sente-se em uma cadeira com as costas retas e os pés apoiados no chão.
Entrelace os dedos atrás da cabeça, com os cotovelos para fora e o queixo baixo.
Gire a parte superior do corpo para um lado o máximo possível. Em seguida, incline-se para frente e gire o torso para tentar tocar o cotovelo no chão, dentro do joelho.
Volte à posição ereta e repita para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento da coluna'),
  (md5('catalogo-exercicio:fedb:' || 'Upper_Back_Stretch')::uuid, 'Alongamento da parte superior das costas', 'Costas', null, 'OUTRO', 'Entrelace os dedos com os polegares para baixo, arredonde os ombros e estique as mãos para frente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento da parte superior das costas'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Forearm_Stretch')::uuid, 'Alongamento de antebraço ajoelhado', 'Antebraço', null, 'OUTRO', 'Comece ajoelhado em um tapete, com as palmas das mãos no chão e os dedos apontando para os joelhos.
Incline-se lentamente para trás, mantendo as palmas apoiadas, até sentir o alongamento nos punhos e antebraços. Segure por 20-30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de antebraco ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Biceps_Stretch')::uuid, 'Alongamento de bíceps em pé', 'Bíceps', null, 'OUTRO', 'Entrelace as mãos atrás das costas com as palmas juntas, estenda os braços e gire-os para que as palmas fiquem viradas para baixo.
Levante os braços e segure até sentir o alongamento no bíceps.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de biceps em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Biceps')::uuid, 'Alongamento de bíceps sentado', 'Bíceps', 'Peso corporal', 'PESO_CORPORAL', 'Sente-se no chão com os joelhos flexionados e um parceiro atrás de você. Estenda os braços para trás com as palmas voltadas uma para a outra. O parceiro segurará seus pulsos. Esta é a posição inicial.
Tente flexionar os cotovelos, enquanto o parceiro impede o movimento.
Após 10 a 20 segundos, relaxe os braços enquanto o parceiro puxa suavemente os pulsos para alongar o bíceps. Comunique-se para evitar lesões.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de biceps sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Runners_Stretch')::uuid, 'Alongamento de corredor', 'Posterior', null, 'OUTRO', 'Em pé, coloque uma perna atrás da outra e abaixe o tronco lentamente em direção ao chão.
Mantenha o calcanhar da perna da frente no chão (se ele levantar, afaste mais a perna de trás).
Apoie as mãos ao lado da perna da frente. Para intensificar o alongamento, eleve o glúteo em direção ao teto e depois abaixe-o gradualmente. Isso alonga o flexor do quadril da perna de trás e o posterior da coxa e glúteo da perna da frente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de corredor'),
  (md5('catalogo-exercicio:fedb:' || 'Upper_Back-Leg_Grab')::uuid, 'Alongamento de costas e pernas', 'Posterior', null, 'OUTRO', 'Sentado, incline-se para frente e abrace as coxas por baixo.
Mantenha os joelhos juntos e as pernas estendidas, levando o peito em direção aos joelhos.
Para alongar as costas, puxe as costas para longe dos joelhos enquanto as abraça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de costas e pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Middle_Back_Stretch')::uuid, 'Alongamento de costas médias', 'Costas', null, 'OUTRO', 'Fique em pé com os pés na largura dos ombros e as mãos nos quadris.
Gire na cintura até sentir um alongamento. Segure por 10 a 15 segundos, depois gire para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de costas medias'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Front_Deltoid')::uuid, 'Alongamento de deltoide anterior sentado', 'Ombros', 'Peso corporal', 'PESO_CORPORAL', 'Sente-se ereto no chão com as pernas flexionadas, e seu parceiro atrás de você. Estenda os braços para os lados, com as palmas voltadas para o chão. Tente movê-los o máximo possível para trás, enquanto seu assistente segura seus pulsos. Esta será a posição inicial.
Mantendo os cotovelos retos, tente mover os braços para a frente, com o parceiro resistindo suavemente para evitar movimento por 10-20 segundos.
Agora, relaxe os músculos e permita que seu parceiro aumente suavemente o alongamento nos ombros e peito. Segure por 10 a 20 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de deltoide anterior sentado'),
  (md5('catalogo-exercicio:fedb:' || 'IT_Band_and_Glute_Stretch')::uuid, 'Alongamento de elástico iliotibial e glúteo', 'Abdutores', null, 'OUTRO', 'Enrole uma cinta, corda ou faixa em um dos pés e cruze essa perna para o lado oposto do corpo, mantendo a perna estendida enquanto está deitado no chão. Esta será a posição inicial.
Mantendo o pé fora do chão, puxe a cinta para levantar os dedos do pé. Segure por 10-20 segundos e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de elastico iliotibial e gluteo'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Hip_Flexors')::uuid, 'Alongamento de flexores do quadril em pé', 'Quadríceps', null, 'OUTRO', 'Fique em pé com a coluna reta, o pé esquerdo ligeiramente à frente do direito.
Flexione ambos os joelhos, levante o calcanhar de trás e empurre o quadril direito para a frente. Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de flexores do quadril em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Glute')::uuid, 'Alongamento de glúteo deitado', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com seu parceiro ajoelhado ao seu lado.
Flexione o quadril de uma perna, levantando-a do chão. Gire a perna para que o pé fique sobre o quadril oposto, com a perna inferior perpendicular ao corpo. Seu parceiro deve segurar o joelho e o tornozelo no lugar. Esta será sua posição inicial.
Tente empurrar a perna em direção ao seu parceiro, que deve impedir qualquer movimento real da perna.
Após 10-20 segundos, relaxe completamente enquanto seu parceiro empurra suavemente o tornozelo e o joelho em direção ao peito. Informe ao parceiro quando o alongamento for adequado para evitar lesões.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de gluteo deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Glute')::uuid, 'Alongamento de glúteo sentado', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Em uma posição sentada com os joelhos flexionados, cruze um tornozelo sobre o joelho oposto. Seu parceiro ficará atrás de você. Agora, incline-se para frente enquanto seu parceiro apoia seus ombros com as mãos. Esta será a posição inicial.
Tente empurrar o torso para trás por 10-20 segundos, enquanto seu parceiro impede qualquer movimento real do torso.
Agora relaxe os músculos enquanto seu parceiro aumenta o alongamento empurrando suavemente o torso para frente por 10-20 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de gluteo sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Hamstring_Stretch')::uuid, 'Alongamento de isquiotibiais', 'Posterior', null, 'OUTRO', 'Deite-se de costas com uma perna estendida para cima, formando um ângulo de 90 graus no quadril. Mantenha a outra perna reta no chão.
Passe uma cinta, faixa elástica ou corda sobre a ponta do pé. Esta será a posição inicial.
Puxe a cinta para criar tensão nas panturrilhas e isquiotibiais. Mantenha o alongamento por 10 a 30 segundos e repita com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de isquiotibiais'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Hamstring')::uuid, 'Alongamento de isquiotibiais deitado', 'Posterior', null, 'OUTRO', 'Deite-se de costas com as pernas estendidas. Seu parceiro deve estar ajoelhado ao seu lado. Levante uma perna em direção ao teto e peça ao parceiro para segurar o tornozelo. Se necessário, o parceiro pode usar o ombro para apoiar a perna. Esta será sua posição inicial.
Com o parceiro segurando a perna no lugar, tente flexionar o joelho, contraindo os isquiotibiais por 10-20 segundos.
Em seguida, relaxe a perna, permitindo que seu parceiro empurre suavemente a perna em direção à cabeça. Informe ao parceiro quando o alongamento for adequado para evitar lesões. Troque de lado ao terminar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de isquiotibiais deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Hamstring')::uuid, 'Alongamento de isquiotibiais sentado', 'Posterior', null, 'OUTRO', 'Sente-se com as pernas estendidas e tenha um parceiro atrás de você. Incline o tronco para frente enquanto o parceiro segura seus ombros com as mãos. Esta é a posição inicial.
Tente empurrar o tronco para trás por 10-20 segundos, enquanto o parceiro impede qualquer movimento real.
Relaxe os músculos enquanto o parceiro aumenta o alongamento empurrando suavemente o tronco para frente por 10-20 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de isquiotibiais sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Floor_Hamstring_Stretch')::uuid, 'Alongamento de isquiotibiais sentado no chão', 'Posterior', null, 'OUTRO', 'Sente-se em um colchonete com a perna direita estendida à frente e a perna esquerda flexionada, com o pé encostado na parte interna da coxa direita.
Incline-se para frente a partir dos quadris e alcance o tornozelo até sentir um alongamento nos isquiotibiais. Segure por 15 segundos, depois repita para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de isquiotibiais sentado no chao'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Lat')::uuid, 'Alongamento de lat com braço elevado', 'Costas', null, 'OUTRO', 'Sente-se ereto no chão com seu parceiro atrás de você. Levante um braço reto para cima e flexione o cotovelo, tentando tocar a mão nas costas. Seu parceiro deve segurar seu tríceps e pulso. Esta será sua posição inicial.
Tente puxar o braço para o lado enquanto seu parceiro impede que você o faça.
Após 10-20 segundos, relaxe o braço e permita que seu parceiro alongue ainda mais o lat aplicando pressão suave no tríceps. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de lat com braco elevado'),
  (md5('catalogo-exercicio:fedb:' || 'Shoulder_Stretch')::uuid, 'Alongamento de ombros', 'Ombros', null, 'OUTRO', 'Estenda o braço esquerdo para o lado oposto do corpo e segure-o reto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de ombros'),
  (md5('catalogo-exercicio:fedb:' || 'Round_The_World_Shoulder_Stretch')::uuid, 'Alongamento de ombros rotacional', 'Ombros', null, 'OUTRO', 'Fique em pé com as pernas juntas, segurando uma barra ou cabo de vassoura.
Segure a barra atrás dos quadris com uma pegada mais larga que os ombros, palmas para baixo e polegares para fora.
Levante os braços lentamente atrás da cabeça. Não force se ficar difícil.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de ombros rotacional'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Stretch_Hands_Against_Wall')::uuid, 'Alongamento de panturrilha com mãos na parede', 'Panturrilha', null, 'OUTRO', 'Fique de frente para uma parede, com os pés em posição escalonada (um à frente).
Incline-se para frente e apoie as mãos na parede, mantendo calcanhar, quadril e cabeça alinhados.
Tente manter o calcanhar no chão. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de panturrilha com maos na parede'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Gastrocnemius_Calf_Stretch')::uuid, 'Alongamento de panturrilha gastrocnêmio em pé', 'Panturrilha', null, 'OUTRO', 'Apoie o calcanhar direito em um degrau com o joelho estendido e incline-se para frente para segurar os dedos do pé direito com a mão direita.
Mantenha o joelho esquerdo levemente flexionado e as costas retas, apoiando o peso na perna esquerda.
Puxe os dedos do pé direito em direção ao joelho até sentir o alongamento na panturrilha.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de panturrilha gastrocnemio em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Stretch_Elbows_Against_Wall')::uuid, 'Alongamento de panturrilha na parede', 'Panturrilha', null, 'OUTRO', 'Fique de frente para uma parede, a alguns passos de distância.
Incline-se contra a parede, apoiando o peso nos antebraços.
Tente manter os calcanhares no chão. Segure por 10-20 segundos. Ajuste a distância para aumentar ou diminuir a dificuldade.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de panturrilha na parede'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Calf_Stretch')::uuid, 'Alongamento de panturrilha sentado', 'Panturrilha', null, 'OUTRO', 'Sente-se ereto em um colchonete.
Dobre um joelho e apoie o pé no chão para estabilizar o torso.
Estenda a outra perna e flexione o tornozelo.
Use uma faixa, toalha ou a mão para puxar os dedos do pé em sua direção. Segure por 10 a 20 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de panturrilha sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Behind_Head_Chest_Stretch')::uuid, 'Alongamento de peito atrás da cabeça', 'Peito', null, 'OUTRO', 'Sente-se ereto no chão com seu parceiro atrás de você.
Coloque as mãos atrás da cabeça e empurre os cotovelos para trás o máximo que puder. Seu parceiro deve segurar seus cotovelos. Esta será a posição inicial.
Tente gentilmente puxar os cotovelos para a frente, com as mãos ainda atrás da cabeça, por 10 segundos ou mais. Seu parceiro deve impedir que os cotovelos se movam.
Agora, relaxe os músculos e peça ao parceiro para puxar gentilmente os cotovelos para trás, até onde for confortável. Certifique-se de avisar quando o alongamento for adequado para evitar excessos ou lesões.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de peito atras da cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_And_Front_Of_Shoulder_Stretch')::uuid, 'Alongamento de peitoral e ombro', 'Peito', null, 'OUTRO', 'Fique em pé com as pernas juntas, segurando uma barra ou cabo de vassoura.
Segure a barra com as mãos um pouco mais afastadas que a largura dos ombros, palmas para baixo, na frente do corpo.
Levante a barra cuidadosamente para cima e atrás da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de peitoral e ombro'),
  (md5('catalogo-exercicio:fedb:' || 'Chair_Leg_Extended_Stretch')::uuid, 'Alongamento de perna estendida na cadeira', 'Posterior', null, 'OUTRO', 'Sente-se ereto em uma cadeira e segure a lateral do assento.
Levante uma perna, estendendo o joelho e flexionando o tornozelo.
Mova lentamente a perna para o lado o máximo possível e depois retorne ao centro e abaixe.
Repita para a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de perna estendida na cadeira'),
  (md5('catalogo-exercicio:fedb:' || '90_90_Hamstring')::uuid, 'Alongamento de posterior 90/90', 'Posterior', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas, com uma perna estendida para fora.
Com a outra perna, flexione o quadril e o joelho a 90 graus. Você pode apoiar a perna com as mãos, se necessário. Esta é a posição inicial.
Estenda a perna reta para cima, parando brevemente no topo. Retorne a perna à posição inicial.
Repita por 10-20 repetições e depois troque para a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de posterior 90/90'),
  (md5('catalogo-exercicio:fedb:' || 'Leg-Up_Hamstring_Stretch')::uuid, 'Alongamento de posterior com perna elevada', 'Posterior', null, 'OUTRO', 'Deite-se de costas, dobre um joelho e coloque esse pé no chão para estabilizar a coluna.
Estenda a outra perna no ar. Se estiver tenso, você pode não conseguir endireitá-la completamente. Tudo bem. Estenda o joelho para que a sola do pé levantado fique voltada para o teto (ou o mais próximo possível).
Lentamente, endireite a perna o máximo possível e puxe-a em direção ao nariz. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de posterior com perna elevada'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Hamstring_and_Calf_Stretch')::uuid, 'Alongamento de posterior e panturrilha', 'Posterior', null, 'OUTRO', 'Passe uma cinta, faixa ou corda em volta de um pé, mantendo-o à frente com a perna estendida.
Flexione a perna de trás, levante os dedos do pé da frente e incline-se para a frente.
Puxe a cinta para aumentar o alongamento na panturrilha. Segure por 10-20 segundos e repita com o outro pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de posterior e panturrilha'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Hamstring_and_Calf_Stretch')::uuid, 'Alongamento de posterior sentado', 'Posterior', null, 'OUTRO', 'Passe uma cinta, corda ou faixa em volta de um pé. Sente-se com ambas as pernas estendidas. Esta é a posição inicial.
Inclinando-se levemente para frente, puxe a cinta para levar os dedos do pé para trás. Segure por 10-20 segundos e repita com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de posterior sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Quad_Stretch')::uuid, 'Alongamento de quadríceps', 'Quadríceps', null, 'OUTRO', 'Deite-se de lado. Passe uma cinta, corda ou faixa ao redor do pé superior. Flexione o joelho e estenda o quadril, tentando tocar os glúteos com o pé, e segurando a cinta com as mãos. Esta será sua posição inicial.
Com a cinta sendo segurada sobre o ombro ou acima da cabeça, puxe suavemente para aumentar o alongamento no quadríceps. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps'),
  (md5('catalogo-exercicio:fedb:' || 'On-Your-Back_Quad_Stretch')::uuid, 'Alongamento de quadríceps de costas', 'Quadríceps', null, 'OUTRO', 'Deite-se em um banco ou step plano, com uma perna e um braço pendurados para o lado.
Dobre o joelho e segure a parte superior do pé. Cuidado para não arquear a lombar.
Contraia o abdômen para manter a coluna neutra. Pressione o pé para baixo e contra a mão. Para alongar o quadril, levante o quadril da perna que está segurando em direção ao teto.
Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps de costas'),
  (md5('catalogo-exercicio:fedb:' || 'On_Your_Side_Quad_Stretch')::uuid, 'Alongamento de quadríceps de lado', 'Quadríceps', null, 'OUTRO', 'Deite-se sobre o lado direito, com o joelho direito dobrado em 90 graus apoiado no chão à frente (para estabilizar o tronco).
Dobre o joelho esquerdo atrás de você e segure o pé esquerdo com a mão esquerda. Para alongar o flexor do quadril, pressione o quadril esquerdo para frente enquanto empurra o pé para trás contra a mão. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps de lado'),
  (md5('catalogo-exercicio:fedb:' || 'Intermediate_Hip_Flexor_and_Quad_Stretch')::uuid, 'Alongamento de quadríceps e quadril', 'Quadríceps', null, 'OUTRO', 'Deite-se de bruços no chão, com uma corda, cinta ou faixa em volta de um dos pés.
Flexione o joelho e estenda o quadril da perna a ser alongada, usando as duas mãos para puxar a cinta. O joelho e o quadril devem sair do chão, criando tensão nos flexores do quadril e quadríceps. Segure o alongamento por 10-20 segundos e repita com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps e quadril'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Elevated_Quad_Stretch')::uuid, 'Alongamento de quadríceps elevado em pé', 'Quadríceps', null, 'OUTRO', 'Fique em pé com as costas a cerca de 60-90 cm de um banco ou degrau.
Levante uma perna para trás e apoie o pé no degrau, no peito do pé ou na ponta, o que for mais confortável.
Mantenha o joelho de apoio levemente flexionado, evitando que ultrapasse os dedos dos pés. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps elevado em pe'),
  (md5('catalogo-exercicio:fedb:' || 'All_Fours_Quad_Stretch')::uuid, 'Alongamento de quadríceps em quatro apoios', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece na posição de quatro apoios, depois levante a perna do chão e segure o pé com a mão.
Use a mão para segurar o pé ou tornozelo, mantendo o joelho totalmente flexionado, alongando os quadríceps e flexores do quadril.
Foque em estender os quadris, empurrando-os em direção ao chão. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de quadriceps em quatro apoios'),
  (md5('catalogo-exercicio:fedb:' || 'Chin_To_Chest_Stretch')::uuid, 'Alongamento de queixo ao peito', 'Pescoço', null, 'OUTRO', 'Sente-se no chão.
Coloque as duas mãos atrás da cabeça, com os dedos entrelaçados, polegares apontando para baixo e cotovelos apontando para frente. Puxe a cabeça lentamente em direção ao peito. Mantenha por 20-30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de queixo ao peito'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Soleus_And_Achilles_Stretch')::uuid, 'Alongamento de sóleo e aquiles em pé', 'Panturrilha', null, 'OUTRO', 'Fique em pé com os pés afastados na largura dos quadris, um pé ligeiramente à frente do outro.
Dobre ambos os joelhos, mantendo o calcanhar de trás no chão. Alterne os lados.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de soleo e aquiles em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Triceps_Stretch')::uuid, 'Alongamento de tríceps', 'Tríceps', null, 'OUTRO', 'Leve a mão atrás da cabeça, segure o cotovelo e puxe suavemente. Mantenha por 10 a 20 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de triceps'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Triceps')::uuid, 'Alongamento de tríceps com braço elevado', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Sente-se ereto no chão com seu parceiro atrás de você. Levante um braço reto para cima e flexione o cotovelo, tentando tocar a mão nas costas. Seu parceiro deve segurar seu cotovelo e pulso. Esta será sua posição inicial.
Tente estender o braço para cima enquanto seu parceiro impede que você o faça.
Após 10-20 segundos, relaxe o braço e permita que seu parceiro alongue ainda mais o tríceps aplicando pressão suave no pulso. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de triceps com braco elevado'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Bent_Leg_Groin')::uuid, 'Alongamento de virilha deitado', 'Adutores', null, 'OUTRO', 'Deite-se de costas com os joelhos dobrados e as solas dos pés juntas. Peça a um parceiro para segurar seus joelhos. Esta será a posição inicial.
Tente juntar os joelhos, enquanto seu parceiro impede o movimento.
Após 10-20 segundos, relaxe os músculos enquanto seu parceiro empurra suavemente os joelhos em direção ao chão. Avise quando o alongamento for suficiente para evitar lesões.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de virilha deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Groin_and_Back_Stretch')::uuid, 'Alongamento de virilha e costas', 'Adutores', null, 'OUTRO', 'Sente-se no chão com os joelhos dobrados e os pés juntos.
Entrelace os dedos atrás da cabeça. Esta será sua posição inicial.
Curve-se para baixo, trazendo os cotovelos para dentro das coxas. Após uma breve pausa, retorne à posição inicial com a cabeça erguida e as costas retas. Repita por 10 a 20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de virilha e costas'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Lying_Groin_Stretch')::uuid, 'Alongamento de virilha em decúbito lateral', 'Adutores', null, 'OUTRO', 'Comece deitado sobre o lado direito e dobre o joelho direito na frente para estabilizar o tronco.
Apoie a cabeça na mão ou ombro direito. Levante a perna esquerda para cima e segure-a pela parte de trás do joelho (mais fácil) ou pelo pé (mais difícil).
Puxe o joelho esquerdo em direção ao ombro esquerdo e, ao mesmo tempo, pressione o pé ou joelho em direção ao chão. Para intensificar, estenda a perna esquerda. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento de virilha em decubito lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Dynamic_Back_Stretch')::uuid, 'Alongamento dinâmico das costas', 'Costas', null, 'OUTRO', 'Fique em pé com os pés afastados na largura dos ombros. Esta será sua posição inicial.
Mantendo os braços retos, balance-os para cima na sua frente 5 a 10 vezes, aumentando a amplitude de movimento a cada vez até que os braços estejam acima da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento dinamico das costas'),
  (md5('catalogo-exercicio:fedb:' || 'Dynamic_Chest_Stretch')::uuid, 'Alongamento dinâmico do peito', 'Peito', null, 'OUTRO', 'Fique em pé com as mãos juntas, braços estendidos diretamente à sua frente. Esta será sua posição inicial.
Mantendo os braços retos, mova-os rapidamente para trás o máximo possível e de volta, como um movimento exagerado de bater palmas. Repita 5 a 10 vezes, aumentando a velocidade conforme avança.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento dinamico do peito'),
  (md5('catalogo-exercicio:fedb:' || 'Dancers_Stretch')::uuid, 'Alongamento do dançarino', 'Costas', null, 'OUTRO', 'Sente-se no chão.
Cruze a perna direita sobre a esquerda, mantendo o joelho flexionado. A perna esquerda fica estendida no chão.
Coloque o braço esquerdo sobre a perna direita e a mão direita no chão.
Gire o tronco para a direita e mantenha a posição por 10-20 segundos. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento do dancarino'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Hip_Flexor')::uuid, 'Alongamento do flexor do quadril ajoelhado', 'Quadríceps', null, 'OUTRO', 'Ajoelhe-se em um tapete e levante o joelho direito, apoiando a sola do pé no chão, enquanto estende a perna esquerda para trás, com o dorso do pé no chão.
Desloque o peso para frente até sentir o alongamento no quadril. Segure por 15 segundos e repita para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento do flexor do quadril ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Cat_Stretch')::uuid, 'Alongamento do gato', 'Costas', null, 'OUTRO', 'Posicione-se no chão em quatro apoios (mãos e joelhos).
Puxe a barriga para dentro e arredonde a coluna, a região lombar, os ombros e o pescoço, deixando a cabeça cair.
Mantenha a posição por 15 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento do gato'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_Stretch_on_Stability_Ball')::uuid, 'Alongamento do peito na bola de estabilidade', 'Peito', 'Bola suíça', 'OUTRO', 'Fique de quatro ao lado de uma bola de exercício.
Apoie os cotovelos em cima da bola, com os braços afastados. Esta é a posição inicial.
Abaixe o tronco em direção ao chão, mantendo os cotovelos na bola. Segure o alongamento por 20-30 segundos e repita com o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento do peito na bola de estabilidade'),
  (md5('catalogo-exercicio:fedb:' || 'Posterior_Tibialis_Stretch')::uuid, 'Alongamento do tibial posterior', 'Panturrilha', null, 'OUTRO', 'Sente-se e passe uma cinta, corda ou faixa em volta de um pé. Esta é a posição inicial.
Com a perna estendida e o calcanhar fora do chão, puxe a cinta para eversão do pé, trazendo a parte externa do pé em sua direção. Segure por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento do tibial posterior'),
  (md5('catalogo-exercicio:fedb:' || 'Peroneals_Stretch')::uuid, 'Alongamento dos fibulares', 'Panturrilha', null, 'OUTRO', 'Sente-se e envolva um pé com uma cinta, corda ou faixa.
Com a perna estendida e o calcanhar fora do chão, puxe a cinta para inverter o pé, alongando a parte interna. Segure por 10-20 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento dos fibulares'),
  (md5('catalogo-exercicio:fedb:' || 'The_Straddle')::uuid, 'Alongamento em v', 'Posterior', null, 'OUTRO', 'Sente-se ereto.
Estenda as pernas à frente em forma de V.
Com as mãos no chão, incline-se para a frente o máximo possível. Segure por 10 a 20 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento em v'),
  (md5('catalogo-exercicio:fedb:' || 'Intermediate_Groin_Stretch')::uuid, 'Alongamento intermediário de virilha', 'Posterior', null, 'OUTRO', 'Deite-se de costas com as pernas estendidas. Passe uma cinta, corda ou faixa em volta de um dos pés e balance essa perna o máximo possível para o lado. Esta será a posição inicial.
Puxe suavemente a cinta para criar tensão nos músculos da virilha e dos isquiotibiais. Segure por 10-20 segundos e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento intermediario de virilha'),
  (md5('catalogo-exercicio:fedb:' || 'Inchworm')::uuid, 'Alongamento lagarta', 'Posterior', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com os pés juntos. Mantendo as pernas retas, incline-se e coloque as mãos no chão diretamente à sua frente. Esta será a posição inicial.
Comece andando com as mãos para frente lentamente, alternando a esquerda e a direita. Ao fazer isso, dobre apenas no quadril, mantendo as pernas retas.
Continue até o corpo ficar paralelo ao chão, em posição de flexão.
Mantenha as mãos no lugar e dê passos curtos com os pés, movendo-se poucos centímetros de cada vez.
Continue andando até os pés ficarem próximos às mãos, mantendo as pernas retas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lagarta'),
  (md5('catalogo-exercicio:fedb:' || 'Tricep_Side_Stretch')::uuid, 'Alongamento lateral de tríceps', 'Tríceps', null, 'OUTRO', 'Leve o braço direito pelo corpo sobre o ombro esquerdo, segurando o cotovelo com a mão esquerda até sentir o alongamento no tríceps. Repita para o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lateral de triceps'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Neck_Stretch')::uuid, 'Alongamento lateral do pescoço', 'Pescoço', null, 'OUTRO', 'Comece com os ombros relaxados, incline suavemente a cabeça em direção ao ombro.
Auxilie o alongamento com uma puxada leve no lado da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lateral do pescoco'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Lateral_Stretch')::uuid, 'Alongamento lateral em pé', 'Abdômen', null, 'OUTRO', 'Fique com os pés ligeiramente mais largos que os quadris e joelhos levemente flexionados.
Apoie a mão direita no quadril direito e levante o braço esquerdo, colocando a mão atrás da cabeça.
Incline o tronco para a direita, mantendo o peso distribuído igualmente entre as pernas. Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lateral em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Side-Lying_Floor_Stretch')::uuid, 'Alongamento lateral no chão', 'Costas', null, 'OUTRO', 'Primeiro, deite-se sobre o lado esquerdo, dobrando o joelho esquerdo na frente para estabilizar o tronco (use também os músculos abdominais para manter-se ereto).
Estenda a perna direita e apoie o pé direito no chão atrás da esquerda. Estenda o braço direito sobre a cabeça e puxe suavemente o pulso direito para alongar todo o lado direito do corpo. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lateral no chao'),
  (md5('catalogo-exercicio:fedb:' || 'Chair_Lower_Back_Stretch')::uuid, 'Alongamento lombar na cadeira', 'Costas', null, 'OUTRO', 'Sente-se ereto em uma cadeira.
Incline-se para um lado com o braço sobre a cabeça. Você pode segurar a cadeira com a mão livre.
Mantenha a posição por 10 segundos e repita para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento lombar na cadeira'),
  (md5('catalogo-exercicio:fedb:' || 'Upward_Stretch')::uuid, 'Alongamento para cima', 'Ombros', null, 'OUTRO', 'Estenda as duas mãos retas acima da cabeça, com as palmas se tocando.
Empurre lentamente as mãos para cima e para trás, mantendo as costas retas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento para cima'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Stretch')::uuid, 'Alongamento por cima da cabeça', 'Abdômen', null, 'OUTRO', 'Fique em pé, entrelace os dedos e vire as palmas para o teto. Mantenha os ombros abaixados enquanto estende os braços para cima.
Para um alongamento completo do torso, puxe o cóccix para baixo e estabilize o torso. Alongue os músculos da frente e de trás do torso.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento por cima da cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Overhead_Stretch')::uuid, 'Alongamento sentado com braço sobre a cabeça', 'Abdômen', null, 'OUTRO', 'Sente-se ereto em um colchonete.
Junte as solas dos pés, com os pés a 15-20 cm à frente dos quadris.
Coloque uma mão no chão ao lado e a outra atrás da cabeça.
Levante o cotovelo para o teto enquanto inclina o tronco para o lado oposto. Segure por 10 a 20 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento sentado com braco sobre a cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Chair_Upper_Body_Stretch')::uuid, 'Alongamento superior na cadeira', 'Ombros', null, 'OUTRO', 'Sente-se na borda de uma cadeira, segurando a parte de trás dela.
Estique os braços, mantenha as costas retas e puxe o tronco para frente até sentir o alongamento. Segure por 20-30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'alongamento superior na cadeira'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Olympic_Plate_Hand_Squeeze')::uuid, 'Aperto de mão com anilha olímpica em pé', 'Antebraço', null, 'OUTRO', 'Para começar, fique em pé segurando uma anilha pela borda com cada mão, com os braços estendidos e pegada neutra (palmas voltadas para dentro). Os pés devem estar na largura dos ombros. Esta é a posição inicial.
Abaixe as anilhas até que os dedos estejam quase estendidos, mas ainda possam segurar os pesos. Inspire ao abaixar as anilhas.
Levante as anilhas de volta à posição inicial enquanto expira, fechando as mãos.
Repita para a quantidade recomendada de repetições prescritas no seu programa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'aperto de mao com anilha olimpica em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Clean')::uuid, 'Arremesso com divisão de pernas', 'Quadríceps', 'Barra', 'LIVRE', 'Com uma barra no chão perto das canelas, segure com uma pegada pronada logo fora das pernas. Abaixe os quadris com o peso nos calcanhares, costas retas, cabeça para frente, peito erguido e ombros ligeiramente à frente da barra. Esta será a posição inicial.
Inicie a primeira puxada empurrando pelos calcanhares, estendendo os joelhos. Mantenha o ângulo das costas e os braços retos. Mova o peso com controle até acima dos joelhos.
Em seguida, faça a segunda puxada, a principal fonte de aceleração. Quando a barra se aproximar da coxa, comece a estender os quadris. Em um movimento de salto, acelere estendendo quadris, joelhos e tornozelos, usando velocidade para levantar a barra. Não puxe ativamente com os braços; no final, o corpo deve estar totalmente estendido, levemente inclinado para trás, com os braços estendidos.
Ao atingir a extensão total, transicione para a terceira puxada encolhendo os ombros e flexionando os braços com os cotovelos para cima e para fora. No pico, puxe-se agressivamente para baixo, girando os cotovelos sob a barra.
Receba a barra com os pés em divisão, movendo um pé para frente e outro para trás. A barra deve repousar nos ombros, tocando levemente a garganta com as mãos relaxadas. Continue a descer para a posição mais baixa.
Recupere-se imediatamente empurrando pelos calcanhares, mantendo o tronco ereto e os cotovelos altos. Junte os pés ao levantar-se.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso com divisao de pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Medicine_Ball_Scoop_Throw')::uuid, 'Arremesso de concha com medicine ball', 'Ombros', 'Medicine ball', 'OUTRO', 'Assuma uma posição de meio agachamento com uma medicine ball nas mãos. Seus braços devem estar pendurados, de modo que a bola fique perto dos pés.
Comece empurrando os quadris para frente enquanto estende as pernas, saltando.
Ao fazer isso, balance os braços para cima e sobre a cabeça, mantendo-os estendidos, e solte a bola no pico do movimento. O objetivo é arremessar a bola o mais longe possível atrás de você.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de concha com medicine ball'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Medicine_Ball_Slam')::uuid, 'Arremesso de medicine ball com um braço', 'Abdômen', 'Medicine ball', 'OUTRO', 'Inicie em pé com uma postura atlética e pernas escalonadas. Segure uma medicine ball com uma mão, no mesmo lado da perna de trás. Esta é a posição inicial.
Comece girando o braço, levantando a medicine ball acima da cabeça. Ao fazer isso, estenda os quadris, joelhos e tornozelos para carregar o movimento para o arremesso.
No pico da extensão, flexione os ombros, coluna e quadris para arremessar a bola com força no chão, diretamente à sua frente.
Pegue a bola no quique e continue para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de medicine ball com um braco'),
  (md5('catalogo-exercicio:fedb:' || 'Supine_Two-Arm_Overhead_Throw')::uuid, 'Arremesso de medicine ball deitado', 'Abdômen', 'Medicine ball', 'OUTRO', 'Deite-se de costas no chão com os joelhos flexionados.
Segure a bola com as duas mãos, estendendo os braços totalmente atrás da cabeça. Esta é a posição inicial.
Inicie o movimento no ombro, arremessando a bola para frente enquanto se senta, buscando a máxima distância.
A bola pode ser arremessada para um parceiro ou quicada em uma parede.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de medicine ball deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Medicine_Ball_Chest_Pass')::uuid, 'Arremesso de medicine ball no peito', 'Peito', 'Medicine ball', 'OUTRO', 'Você precisará de um parceiro para este exercício. Na falta de um, o movimento pode ser realizado contra uma parede.
Comece de frente para seu parceiro, segurando a medicine ball no torso com as duas mãos.
Puxe a bola em direção ao peito e reverta o movimento estendendo os cotovelos. Para aplicações esportivas, você pode dar um passo ao arremessar.
Seu parceiro deve pegar a bola e arremessá-la de volta para você.
Receba o arremesso com as duas mãos na altura do peito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de medicine ball no peito'),
  (md5('catalogo-exercicio:fedb:' || 'Backward_Medicine_Ball_Throw')::uuid, 'Arremesso de medicine ball para trás', 'Ombros', 'Medicine ball', 'OUTRO', 'Este exercício é melhor feito com um parceiro. Se não tiver, arremesse a bola contra uma parede ou a recupere.
Fique de pé a alguns metros do parceiro, ambos virados para a mesma direção, segurando a bola entre as pernas.
Agache-se e, em seguida, estique-se rapidamente, arremessando a bola por cima da cabeça para o parceiro.
O parceiro devolve a bola. Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de medicine ball para tras'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Slam')::uuid, 'Arremesso de medicine ball por cima da cabeça', 'Costas', 'Medicine ball', 'OUTRO', 'Segure uma medicine ball com as duas mãos e fique em pé com os pés na largura dos ombros. Esta será sua posição inicial.
Inicie o movimento elevando a bola acima da cabeça e estendendo completamente o corpo.
Inverta o movimento, arremessando a bola no chão com força, diretamente à sua frente.
Receba a bola com as duas mãos no quique e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de medicine ball por cima da cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_Push_multiple_response')::uuid, 'Arremesso de peito (resposta múltipla)', 'Peito', 'Medicine ball', 'OUTRO', 'Ajoelhe-se de frente para uma parede ou com um parceiro, segurando a bola firmemente contra o peito.
Arremesse a bola explosivamente para frente, empurrando com os quadris.
Complete o movimento caindo para frente e apoiando-se com as mãos.
Volte rapidamente à posição ereta e repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de peito (resposta multipla)'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_Push_single_response')::uuid, 'Arremesso de peito (resposta única)', 'Peito', 'Medicine ball', 'OUTRO', 'Ajoelhe-se segurando a medicine ball firmemente contra o peito.
Arremesse a bola explosivamente para frente, empurrando com os quadris.
Complete o movimento caindo para frente e apoiando-se com as mãos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de peito (resposta unica)'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_Push_from_3_point_stance')::uuid, 'Arremesso de peito com base de três pontos', 'Peito', 'Medicine ball', 'OUTRO', 'Inicie em uma posição agachada com as costas retas e uma mão no chão, segurando a medicine ball à sua frente.
Dê o primeiro passo, puxando a bola para o peito e preparando as mãos para o arremesso.
No segundo passo, arremesse a bola explosivamente para frente com força máxima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de peito com base de tres pontos'),
  (md5('catalogo-exercicio:fedb:' || 'Chest_Push_with_Run_Release')::uuid, 'Arremesso de peito com corrida', 'Peito', 'Medicine ball', 'OUTRO', 'Fique em posição atlética com joelhos flexionados, quadris para trás e costas retas, segurando a medicine ball perto das pernas. Esta é a posição inicial.
Ao dar o primeiro passo, puxe a bola para o peito.
No segundo passo, arremesse a bola explosivamente para frente e imediatamente corra 10 jardas (cerca de 9 metros) após o lançamento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de peito com corrida'),
  (md5('catalogo-exercicio:fedb:' || 'Supine_Chest_Throw')::uuid, 'Arremesso de peito supino', 'Tríceps', 'Medicine ball', 'OUTRO', 'Este exercício é ideal para arremessos de peito quando não há um parceiro ou parede resistente. Deite-se de costas no chão com os joelhos flexionados.
Comece com a bola no peito, segurando-a com as duas mãos na parte inferior.
Exploda para cima, estendendo os cotovelos para arremessar a bola verticalmente o mais alto possível.
Agarre a bola com as duas mãos ao descer.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso de peito supino'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Two-Arm_Overhead_Throw')::uuid, 'Arremesso overhead de medicine ball em pé', 'Ombros', 'Medicine ball', 'OUTRO', 'Fique em pé com os pés afastados na largura dos ombros, segurando uma medicine ball com as duas mãos. Para começar, leve a bola bem atrás da cabeça enquanto dobra levemente os joelhos e inclina-se para trás.
Arremesse a bola violentamente para frente, flexionando os quadris e usando todo o corpo para completar o movimento.
A medicine ball pode ser arremessada para um parceiro ou para uma parede, recebendo-a no retorno.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso overhead de medicine ball em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Catch_and_Overhead_Throw')::uuid, 'Arremesso por cima com recepção', 'Costas', 'Medicine ball', 'OUTRO', 'Comece em pé, de frente para uma parede ou parceiro.
Com as duas mãos, posicione a bola atrás da cabeça, alongando o máximo possível, e arremesse a bola com força para a frente.
Certifique-se de acompanhar o movimento do arremesso e esteja preparado para receber a bola de volta. Se estiver arremessando contra a parede, fique perto o suficiente para pegar o rebote e mire um pouco mais alto do que faria com um parceiro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso por cima com recepcao'),
  (md5('catalogo-exercicio:fedb:' || 'Supine_One-Arm_Overhead_Throw')::uuid, 'Arremesso supino com um braço acima da cabeça', 'Abdômen', 'Medicine ball', 'OUTRO', 'Deite-se de costas no chão com os joelhos flexionados. Segure a bola com uma mão, estendendo o braço totalmente atrás da cabeça. Esta é a posição inicial.
Inicie o movimento no ombro, arremessando a bola para frente enquanto se senta, buscando a máxima distância.
A bola pode ser arremessada para um parceiro ou quicada em uma parede.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'arremesso supino com um braco acima da cabeca'),
  (md5('catalogo-exercicio:fedb:' || 'Hamstring-SMR')::uuid, 'Auto-massagem de isquiotibiais', 'Posterior', 'Rolo de liberação', 'OUTRO', 'Sente-se no chão e estenda as pernas sobre um rolo de espuma, posicionando-o na parte posterior das coxas. Coloque as mãos ao lado ou atrás de você para apoiar o peso. Esta será a posição inicial.
Com as mãos, levante os quadris do chão e desloque o peso para uma perna sobre o rolo. Relaxe os isquiotibiais da perna que está sendo alongada.
Role o rolo da região abaixo do quadril até acima da parte posterior do joelho, parando nos pontos de tensão por 10 a 30 segundos. Repita para a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'auto-massagem de isquiotibiais'),
  (md5('catalogo-exercicio:fedb:' || 'Calves-SMR')::uuid, 'Auto-massagem na panturrilha', 'Panturrilha', 'Rolo de liberação', 'OUTRO', 'Sente-se no chão. Coloque um rolo de espuma sob a parte inferior da perna. A outra perna pode estar cruzada sobre a oposta ou apoiada no chão, sustentando parte do peso. Esta será a posição inicial.
Coloque as mãos ao lado do corpo ou logo atrás de você e pressione para levantar os quadris do chão, transferindo boa parte do peso para o músculo da panturrilha. Role da região abaixo do joelho até acima do tornozelo, pausando nos pontos de tensão por 10 a 30 segundos. Repita para a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'auto-massagem na panturrilha'),
  (md5('catalogo-exercicio:fedb:' || 'Lower_Back-SMR')::uuid, 'Auto-massagem para lombar', 'Costas', 'Rolo de liberação', 'OUTRO', 'Sente-se e coloque um rolo de espuma sob a lombar. Cruze os braços à frente e projete os ombros para a frente. Esta será a posição inicial.
Levante os quadris do chão e incline-se para trás, mantendo o peso na lombar. Desloque o peso levemente para um lado, evitando a coluna e focando nos músculos laterais. Role sobre a lombar, segurando pontos de tensão por 10-30 segundos. Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'auto-massagem para lombar'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Lunges')::uuid, 'Avanço com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Fique em pé com o tronco ereto, segurando dois halteres nas mãos ao lado do corpo. Esta será a posição inicial.
Dê um passo à frente com a perna direita, cerca de 60 cm da perna esquerda estacionária atrás, e abaixe o tronco, mantendo-o ereto e o equilíbrio. Inspire ao descer. Nota: Não permita que o joelho da frente ultrapasse a linha dos dedos dos pés ao descer, para evitar estresse excessivo na articulação. Mantenha a canela da perna da frente perpendicular ao chão.
Usando principalmente o calcanhar do pé, empurre para cima e volte à posição inicial enquanto expira.
Repita o movimento pelo número recomendado de repetições e, em seguida, execute com a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'avanco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Jerk_Balance')::uuid, 'Balanceamento no jerk', 'Ombros', 'Barra', 'LIVRE', 'Comece com a barra na posição de arranco: ombros para frente, torso ereto e pés ligeiramente afastados.
Inicie o movimento como um arranco normal: flexione os joelhos mantendo o torso vertical e impulsione para cima com força, usando o momentum, não os braços.
Mantenha o pé traseiro no lugar, usando-o para avançar o corpo em uma abertura completa durante o arranco. Finalize em pé com a barra sobre a cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'balanceamento no jerk'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Pull_Apart')::uuid, 'Band pull-apart', 'Ombros', 'Elástico', 'ELASTICO', 'Comece com os braços estendidos à frente, segurando a banda com as duas mãos.
Faça um movimento de crucifixo invertido, movendo as mãos para os lados.
Mantenha os cotovelos estendidos, trazendo a banda para o peito, com os ombros para trás.
Pause no final do movimento e retorne à posição inicial com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'band pull-apart'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Assisted_Pull-Up')::uuid, 'Barra fixa assistida com elástico', 'Costas', null, 'OUTRO', 'Prenda uma banda no centro da barra de pull-up, usando bandas de diferentes resistências para assistência.
Puxe a banda para baixo e coloque um joelho flexionado no laço, garantindo que não escorregue. Segure a barra com uma pegada média a ampla. Esta é a posição inicial.
Puxe-se para cima contraindo as costas e flexionando os cotovelos, levando-os para os lados. Tente levar o queixo acima da barra, sem balançar.
Após uma pausa breve, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa assistida com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Gorilla_Chin_Crunch')::uuid, 'Barra fixa com abdominal gorila', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Pendure-se em uma barra de pull-up com uma pegada supinada (palmas voltadas para você) ligeiramente mais larga que a largura dos ombros.
Dobre os joelhos em um ângulo de 90 graus, de modo que as panturrilhas fiquem paralelas ao chão e as coxas perpendiculares a ele. Esta será sua posição inicial.
Ao expirar, puxe-se para cima enquanto levanta os joelhos ao mesmo tempo, até que os joelhos cheguem ao nível do peito. Pare de subir quando o nariz estiver na mesma altura da barra. Dica: Neste ponto, você também deve finalizar o abdominal.
Comece a inspirar lentamente enquanto retorna à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa com abdominal gorila'),
  (md5('catalogo-exercicio:fedb:' || 'Mixed_Grip_Chin')::uuid, 'Barra fixa com pegada mista', 'Costas', null, 'OUTRO', 'Usando uma pegada ligeiramente mais larga que a largura dos ombros, segure uma barra de pull-up com as palmas de uma mão voltadas para frente e as palmas da outra mão voltadas para você. Esta será sua posição inicial.
Agora, comece a puxar-se para cima enquanto expira. Dica: Com o braço que tem as palmas voltadas para cima, concentre-se em usar os músculos das costas para realizar o movimento. O cotovelo desse braço deve permanecer próximo ao torso. Com o outro braço, que tem as palmas voltadas para frente, os cotovelos ficarão afastados, mas alinhados com o torso. Concentre-se em usar os dorsais para puxar o corpo para cima.
Após uma contração no topo, comece a descer lentamente enquanto inspira.
Repita para a quantidade recomendada de repetições.
Na série seguinte, troque as pegadas; por exemplo, se você tinha a mão direita com as palmas voltadas para você e a esquerda com as palmas para frente, na próxima série terá a direita com as palmas para frente e a esquerda voltadas para você.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa com pegada mista'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Pull_Ups')::uuid, 'Barra fixa com sobrecarga', 'Costas', null, 'OUTRO', 'Prenda um peso a um cinto de carga e ajuste-o na cintura. Segure a barra fixa com as palmas das mãos voltadas para frente, com as mãos na largura dos ombros e os braços estendidos.
Incline o tronco cerca de 30 graus para trás, arqueando levemente a lombar e projetando o peito para frente. Esta é a posição inicial.
Expire e puxe o tronco para cima até que a cabeça fique acima das mãos, concentrando-se em contrair as escápulas para trás e para baixo no topo do movimento.
Após uma breve pausa no topo, inspire e abaixe lentamente o tronco de volta à posição inicial, com os braços estendidos e os dorsais alongados.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa com sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Scapular_Pull-Up')::uuid, 'Barra fixa escapular', 'Trapézio', null, 'OUTRO', 'Segure uma barra de pull-up com as palmas voltadas para frente.
Da posição pendurada, eleve-se alguns centímetros sem usar os braços, deprimindo as escápulas em um movimento de encolher invertido.
Segure no topo do movimento e retorne lentamente à posição inicial antes de repetir.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa escapular'),
  (md5('catalogo-exercicio:fedb:' || 'Side_To_Side_Chins')::uuid, 'Barra fixa lateral', 'Costas', null, 'OUTRO', 'Segure a barra de pull-up com as palmas voltadas para frente e pegada larga.
Com os braços estendidos, incline o tronco para trás cerca de 30 graus, arqueando a lombar e projetando o peito para fora. Esta é a posição inicial.
Puxe o tronco para cima, inclinando-se para o lado esquerdo até a barra quase tocar o peito, puxando os ombros e braços para baixo e para trás. Expire durante o movimento. Dica: Contraia os músculos das costas na posição máxima, mantendo o tronco estável e apenas os braços se movendo.
Após um segundo, inspire ao voltar à posição inicial.
Repita o movimento, agora inclinando-se para o lado direito.
Continue alternando os lados até completar as repetições prescritas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa lateral'),
  (md5('catalogo-exercicio:fedb:' || 'V-Bar_Pullup')::uuid, 'Barra fixa neutra com pegador V', 'Costas', 'Peso corporal', 'PESO_CORPORAL', 'Prenda a barra V no meio da barra de pull-up, com as alças voltadas para baixo.
Segure a barra V de cada lado e pendure-se nela. Estufe o peito e incline-se levemente para trás.
Puxe o tronco para cima usando os dorsais, inclinando a cabeça para trás para evitar bater no queixo. Continue até o peito quase tocar a barra. Expire durante o movimento.
Segure por um segundo e abaixe o corpo lentamente à posição inicial, inspirando.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa neutra com pegador v'),
  (md5('catalogo-exercicio:fedb:' || 'Gironda_Sternum_Chins')::uuid, 'Barra fixa no esterno Gironda', 'Costas', null, 'OUTRO', 'Segure a barra de pull-up com uma pegada supinada na largura dos ombros.
Fique pendurado com os braços estendidos, peito para fora e corpo inclinado para trás. Esta é a posição inicial.
Puxe-se em direção à barra com a coluna arqueada e a cabeça para trás, até o esterno tocar a barra. Expire e segure a contração por um segundo.
Volte lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa no esterno gironda'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Rear_Pull-Up')::uuid, 'Barra fixa por trás da nuca pegada aberta', 'Costas', 'Peso corporal', 'PESO_CORPORAL', 'Segure a barra fixa com uma pegada larga e as palmas voltadas para frente.
Com os braços estendidos, incline o tronco e a cabeça para frente, alinhando a barra com a nuca. Esta é a posição inicial.
Puxe o tronco para cima até que a barra fique próxima à nuca, expirando e contraindo as costas. Mantenha o tronco estável e use apenas os braços.
Após um segundo na posição contraída, inspire e abaixe o tronco lentamente até os braços estenderem completamente e os dorsais alongarem.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa por tras da nuca pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Chin-Up')::uuid, 'Barra fixa supinada', 'Costas', 'Peso corporal', 'PESO_CORPORAL', 'Segure a barra de pull-up com as palmas voltadas para você e as mãos mais próximas que a largura dos ombros.
Com os braços estendidos, mantenha o tronco reto, arqueie levemente a lombar e projete o peito para fora. Esta é a posição inicial.
Puxe o tronco para cima expirando, até que o queixo passe a barra, focando no uso do bíceps e mantendo os cotovelos próximos ao corpo.
Mantenha a contração por um segundo e depois abaixe o tronco lentamente até os braços ficarem estendidos, inspirando.
Repita para a quantidade prescrita de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa supinada'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Chin-Up')::uuid, 'Barra fixa unilateral', 'Costas', null, 'OUTRO', 'Para este exercício, comece colocando uma toalha em uma barra fixa.
Segure a barra fixa com a palma da mão voltada para você. Uma mão segurará a barra e a outra a toalha.
Leve o tronco para trás cerca de 30 graus, criando uma curvatura na lombar e projetando o peito para fora. Esta é sua posição inicial.
Puxe o tronco para cima até a barra tocar a parte superior do peito, puxando os ombros e a parte superior dos braços para baixo e para trás. Expire ao executar esta parte. Dica: Concentre-se em contrair os músculos das costas na posição contraída. O tronco superior deve permanecer estável; apenas os braços se movem. Os antebraços só devem segurar a barra.
Após um segundo na posição contraída, inspire e abaixe lentamente o tronco até a posição inicial, com os braços totalmente estendidos e os dorsais alongados.
Repita o movimento pelo número recomendado de repetições.
Troque de braço e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Rocky_Pull-Ups_Pulldowns')::uuid, 'Barra fixa/pulldown rocky', 'Costas', null, 'OUTRO', 'Segure a barra de pull-up com as palmas voltadas para frente e uma pegada larga.
Com os braços estendidos, incline o tronco para trás cerca de 30 graus, arqueando levemente as costas e projetando o peito para fora. Esta é a posição inicial.
Puxe o tronco para cima até a barra tocar a parte superior do peito, puxando os ombros e braços para baixo e para trás. Expire durante essa fase.
Segure a posição contraída por um segundo e retorne lentamente à posição inicial ao inspirar, estendendo os braços completamente.
Agora, repita o movimento mantendo o tronco reto, tocando a barra na nuca. Incline a cabeça levemente para frente para auxiliar.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'barra fixa/pulldown rocky'),
  (md5('catalogo-exercicio:fedb:' || 'Battling_Ropes')::uuid, 'Battle rope', 'Ombros', null, 'OUTRO', 'Para este exercício, você precisará de uma corda pesada ancorada no centro a 5-6 metros de distância. Em pé de frente para a corda, segure uma ponta em cada mão, com os braços estendidos ao lado do corpo. Esta será a posição inicial.
Inicie o movimento levantando rapidamente um braço até a altura do ombro, o mais rápido possível.
Ao abaixar esse braço para a posição inicial, levante o braço oposto.
Continue alternando os braços esquerdo e direito, movimentando as cordas para cima e para baixo o mais rápido que puder.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'battle rope'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Press')::uuid, 'Bent press com kettlebell', 'Abdômen', 'Kettlebell', 'LIVRE', 'Leve o kettlebell ao ombro com um movimento de clean, girando o punho. Esta é a posição inicial.
Incline-se para o lado oposto ao kettlebell até tocar o chão com a mão livre, mantendo os olhos no peso. Ao mesmo tempo, pressione o kettlebell verticalmente para cima, estendendo o cotovelo.
Retorne à posição ereta com o kettlebell acima da cabeça. Baixe-o ao ombro e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'bent press com kettlebell');

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, instrucoes, fonte, nome_busca) values
  (md5('catalogo-exercicio:fedb:' || 'Recumbent_Bike')::uuid, 'Bicicleta recumbente', 'Cardio', 'Máquina', 'CARDIO', 'Para começar, sente-se na bicicleta e ajuste o banco à sua altura.
Selecione a opção desejada no menu. Você pode ter que começar a pedalar para ligá-la. Você pode usar a configuração manual ou selecionar um programa. Normalmente, você pode inserir sua idade e peso para estimar a quantidade de calorias queimadas durante o exercício. O nível de resistência pode ser alterado durante o treino. As alças podem ser usadas para monitorar sua frequência cardíaca e ajudar a manter uma intensidade adequada.
As bicicletas recumbentes oferecem conveniência, benefícios cardiovasculares e têm menos impacto do que outras atividades. Uma pessoa de 68 kg queimará cerca de 230 calorias pedalando em um ritmo moderado por 30 minutos, comparado a 450 calorias ou mais correndo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'bicicleta recumbente'),
  (md5('catalogo-exercicio:fedb:' || 'Body-Up')::uuid, 'Body-up', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Assuma a posição de prancha no chão, apoiando o peso corporal nas pontas dos pés e antebraços, com o torso reto e os antebraços na largura dos ombros. Esta é a posição inicial.
Pressione as palmas das mãos firmemente no chão e estenda os cotovelos para elevar o corpo, mantendo o torso rígido.
Lentamente, flexione os cotovelos para baixar os antebraços de volta ao chão.
Repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'body-up'),
  (md5('catalogo-exercicio:fedb:' || 'Hanging_Bar_Good_Morning')::uuid, 'Bom dia com barra suspensa', 'Posterior', 'Barra', 'LIVRE', 'Posicione uma barra em um suporte na altura do estômago, suspensa por correntes ou alças.
Incline-se sob a barra e apoie-a na parte posterior dos ombros, como em um agachamento. Na altura correta, você deve ficar quase paralelo ao chão. Mantenha as costas firmes, ombros para trás, joelhos levemente flexionados, coluna arqueada e cabeça alinhada.
Estenda os quadris usando glúteos e isquiotibiais para levantar até ficar em pé.
Abaixe a barra lentamente de volta à posição inicial, onde fica suspensa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'bom dia com barra suspensa'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Good_Morning')::uuid, 'Bom dia com elástico', 'Posterior', 'Elástico', 'ELASTICO', 'Fique em pé sobre uma ponta de uma banda de 41 polegadas, com os pés levemente afastados. Incline-se para colocar a outra ponta da banda atrás do pescoço. Esta é a posição inicial.
Mantendo as pernas retas, estenda os quadris para ficar quase vertical.
Certifique-se de não curvar as costas ao retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'bom dia com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Good_Morning_Pull_Through')::uuid, 'Bom dia com puxada de elástico', 'Posterior', 'Elástico', 'ELASTICO', 'Prenda uma banda em um poste. Fique a uma distância, com a outra ponta da banda atrás do pescoço, segurando com as mãos se necessário.
Incline-se para a frente a partir dos quadris, mantendo as costas retas e os joelhos levemente flexionados, até cerca de 90 graus.
Retorne à posição em pé empurrando com os quadris.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'bom dia com puxada de elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Box_Jump_Multiple_Response')::uuid, 'Box jump contínuo', 'Posterior', null, 'OUTRO', 'Fique em pé relaxado, de frente para a caixa ou plataforma, a cerca de um braço de distância, com braços ao lado e pernas levemente flexionadas.
Use os braços para impulsão, salte para cima e para frente, aterrissando com os dois pés simultaneamente na caixa.
Imediatamente, desça ou salte de volta ao local inicial e repita a sequência.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box jump continuo'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Box_Jump')::uuid, 'Box jump frontal', 'Posterior', null, 'OUTRO', 'Posicione uma caixa de altura adequada 1-2 pés à sua frente. Fique em pé com os pés na largura dos ombros. Esta é a posição inicial.
Faça um agachamento curto para preparar o salto, balançando os braços para trás.
Impulsione-se, estendendo quadris, joelhos e tornozelos para saltar o mais alto possível. Balance os braços para frente e para cima.
Aterrisse na caixa com joelhos flexionados para absorver o impacto. Pule de volta ao chão ou desça com um pé de cada vez.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box jump frontal'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Seated_Box_Jump')::uuid, 'Box jump sentado com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Posicione uma caixa a alguns pés de distância de um banco. Segure um halter contra o peito com as duas mãos e sente-se no banco de frente para a caixa. Esta será sua posição inicial.
Com os pés firmes no chão, incline-se para frente e impulsione-se com os quadris e joelhos para saltar para cima e em direção à caixa.
Aterrisse na caixa com ambos os pés, amortecendo o impacto flexionando os quadris e joelhos.
Desça da caixa e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box jump sentado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Box_Squat')::uuid, 'Box squat com barra', 'Quadríceps', 'Barra', 'LIVRE', 'O agachamento na caixa permite que você agache até a profundidade desejada e desenvolva força explosiva no movimento. Comece em um rack de potência com uma caixa na altura apropriada atrás de você. Normalmente, a altura da caixa deve levar você a um agachamento paralelo, mas você pode treinar mais alto ou mais baixo, se desejar.
Comece passando por baixo da barra e posicionando-a nas costas dos ombros. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros. Retire a barra do rack, criando um arco firme na lombar, e dê um passo para trás para se posicionar. Posicione os pés mais afastados para mais ênfase nas costas, glúteos, adutores e isquiotibiais, ou mais juntos para mais desenvolvimento do quadríceps. Mantenha a cabeça virada para frente.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris até estar sentado na caixa. Idealmente, as canelas devem ficar perpendiculares ao chão. Faça uma pausa ao atingir a caixa e relaxe os flexores do quadril. Nunca quique na caixa.
Mantendo o peso nos calcanhares e empurrando os pés e joelhos para fora, impulsione para cima saindo da caixa, liderando o movimento com a cabeça. Continue subindo, mantendo a tensão da cabeça aos pés.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box squat com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Box_Squat_with_Chains')::uuid, 'Box squat com correntes', 'Quadríceps', 'Barra', 'LIVRE', 'Comece em um rack de potência com uma caixa na altura apropriada atrás de você. Normalmente, a altura da caixa deve levar a um agachamento paralelo, mas você pode ajustar conforme desejar.
Para instalar as correntes, comece passando a corrente guia sobre as extremidades da barra. A corrente pesada deve ser presa com um gancho. Ajuste o comprimento da corrente guia para que alguns elos ainda estejam no chão no topo do movimento.
Comece passando por baixo da barra e posicionando-a nas costas dos ombros. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros. Retire a barra do rack, criando um arco firme na lombar, e dê um passo para trás para se posicionar. Posicione os pés mais afastados para mais ênfase nas costas, glúteos, adutores e isquiotibiais, ou mais juntos para mais desenvolvimento do quadríceps. Mantenha a cabeça virada para frente.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris até estar sentado na caixa. Idealmente, as canelas devem ficar perpendiculares ao chão. Faça uma pausa ao atingir a caixa e relaxe os flexores do quadril. Nunca quique na caixa.
Mantendo o peso nos calcanhares e empurrando os pés e joelhos para fora, impulsione para cima saindo da caixa, liderando o movimento com a cabeça. Continue subindo, mantendo a tensão da cabeça aos pés.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box squat com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Box_Squat_with_Bands')::uuid, 'Box squat com elástico', 'Quadríceps', 'Barra', 'LIVRE', 'Comece em um rack de potência com uma caixa na altura apropriada atrás de você. Instale os elásticos nas extremidades da barra, presos a pinos de elástico, ao rack ou a halteres, de modo que haja tensão adequada. Se usar halteres, fixe-os para que não se movam. Além disso, certifique-se de que os halteres sejam pesados o suficiente para os elásticos usados. Pode-se adicionar pesos para segurar os halteres. Se precisar de mais tensão, alargue a base no chão ou encurte os elásticos. Normalmente, a altura da caixa deve levar a um agachamento paralelo, mas ajuste conforme necessário.
Comece passando por baixo da barra e posicionando-a nas costas dos ombros. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros. Retire a barra do rack, criando um arco firme na lombar, e dê um passo para trás para se posicionar. Posicione os pés mais afastados para mais ênfase nas costas, glúteos, adutores e isquiotibiais, ou mais juntos para mais desenvolvimento do quadríceps. Mantenha a cabeça virada para frente.
Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris até estar sentado na caixa. Idealmente, as canelas devem ficar perpendiculares ao chão. Faça uma pausa ao atingir a caixa e relaxe os flexores do quadril. Nunca quique na caixa.
Mantendo o peso nos calcanhares e empurrando os pés e joelhos para fora, impulsione para cima saindo da caixa, liderando o movimento com a cabeça. Continue subindo, mantendo a tensão da cabeça aos pés. Tenha cuidado ao devolver a barra ao rack.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'box squat com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Thigh_Abductor')::uuid, 'Cadeira abdutora', 'Abdutores', 'Máquina', 'MAQUINA', 'Sente-se na máquina de abdutor e selecione um peso confortável. Posicione as pernas corretamente e segure as alças laterais. O tronco deve ficar imóvel. Esta é a posição inicial.
Pressione lentamente contra a máquina com as pernas para afastá-las, expirando.
Sinta a contração por um segundo e retorne as pernas à posição inicial, inspirando. Mantenha o tronco imóvel para evitar lesões.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cadeira abdutora'),
  (md5('catalogo-exercicio:fedb:' || 'Thigh_Adductor')::uuid, 'Cadeira adutora', 'Adutores', 'Máquina', 'MAQUINA', 'Sente-se na máquina de adutor e selecione um peso confortável. Posicione as pernas nos apoios e segure as alças laterais. O tronco deve ficar imóvel. Esta é a posição inicial.
Pressione lentamente contra a máquina com as pernas para aproximá-las, expirando.
Sinta a contração por um segundo e retorne as pernas à posição inicial, inspirando. Mantenha o tronco imóvel e evite movimentos bruscos para prevenir lesões.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cadeira adutora'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Leg_Leg_Extension')::uuid, 'Cadeira extensora unilateral', 'Quadríceps', 'Máquina', 'MAQUINA', 'Sente-se na máquina e ajuste-a para posicionar-se corretamente. A almofada deve ficar na parte inferior da canela, mas sem tocar o tornozelo. Ajuste o banco para que o ponto de pivô fique alinhado com o joelho. Selecione um peso adequado à sua capacidade.
Mantendo uma boa postura, estenda completamente uma perna, fazendo uma pausa no topo do movimento.
Retorne à posição inicial sem deixar o peso parar, mantendo a tensão no músculo.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cadeira extensora unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Monster_Walk')::uuid, 'Caminhada de monstro', 'Abdutores', 'Elástico', 'ELASTICO', 'Coloque uma faixa elástica em ambos os tornozelos e outra em ambos os joelhos. Deve haver tensão suficiente para que fiquem apertadas quando os pés estiverem na largura dos ombros.
Para começar, dê passos curtos para frente, alternando o pé esquerdo e direito.
Após vários passos, faça o oposto e caminhe para trás até o ponto de partida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'caminhada de monstro'),
  (md5('catalogo-exercicio:fedb:' || 'Walking_Treadmill')::uuid, 'Caminhada na esteira', 'Cardio', 'Máquina', 'CARDIO', 'Suba na esteira e selecione a opção desejada no menu. Ajuste a inclinação para variar a intensidade.
Caminhe em um ritmo moderado a rápido, mantendo uma postura adequada. Segure os apoios apenas se necessário.
A caminhada na esteira é conveniente, oferece benefícios cardiovasculares e tem baixo impacto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'caminhada na esteira'),
  (md5('catalogo-exercicio:fedb:' || 'Sled_Overhead_Backward_Walk')::uuid, 'Caminhada para trás com halter por cima', 'Ombros', null, 'OUTRO', 'Acople duas alças a um trenó usando uma corda ou corrente. Carregue o trenó com um peso leve.
Fique de frente para o trenó e dê alguns passos para trás até sentir tensão na corda. Mantenha as mãos diretamente acima da cabeça, com os cotovelos estendidos. Esta é a posição inicial.
Caminhe para trás, mantendo os braços levantados acima da cabeça. Evite movimentos bruscos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'caminhada para tras com halter por cima'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Leg_Butt_Kick')::uuid, 'Chute no glúteo com duas pernas', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Inicie em pé, com os joelhos levemente flexionados.
Agache rapidamente e salte para cima, maximizando a altura.
Durante o salto, flexione os joelhos para tocar os calcanhares nos glúteos.
Aterrisse com os joelhos flexionados para absorver o impacto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'chute no gluteo com duas pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Single_Leg_Butt_Kick')::uuid, 'Chute no glúteo unilateral', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece em pé sobre uma perna, com o joelho flexionado e elevado. Esta é a posição inicial.
Usando um movimento de contragolpe, impulsione-se para cima estendendo o quadril, joelho e tornozelo da perna de apoio.
Imediatamente, flexione o joelho e tente tocar o glúteo com o calcanhar da perna que saltou.
Retorne a perna a uma posição parcialmente flexionada sob os quadris e aterrisse. A perna oposta deve permanecer relativamente na mesma posição durante o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'chute no gluteo unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Scissor_Kick')::uuid, 'Chute tesoura', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão ou em um colchonete. Estique os braços para os lados com as palmas para baixo, mantendo-os imóveis.
Com os joelhos levemente flexionados, levante as pernas até os calcanhares ficarem a cerca de 15 cm do chão. Esta é a posição inicial.
Levante a perna esquerda a cerca de 45 graus enquanto abaixa a direita até o calcanhar ficar a 5-8 cm do chão.
Alternne os movimentos, levantando a perna direita e abaixando a esquerda. Respire durante o exercício.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'chute tesoura'),
  (md5('catalogo-exercicio:fedb:' || 'Flutter_Kicks')::uuid, 'Chutes alternados', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços em um banco plano com os quadris na borda, pernas estendidas e braços segurando a frente do banco.
Contraia glúteos e isquiostibiais, elevando as pernas até a altura dos quadris. Esta é a posição inicial.
Alternadamente, levante uma perna mais alta que a outra, imitando um movimento de natação.
Continue alternando de forma controlada pela quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'chutes alternados'),
  (md5('catalogo-exercicio:fedb:' || 'Bicycling')::uuid, 'Ciclismo', 'Cardio', null, 'CARDIO', 'Sente-se na bicicleta e ajuste o banco à sua altura.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ciclismo'),
  (md5('catalogo-exercicio:fedb:' || 'Arm_Circles')::uuid, 'Círculos com os braços', 'Ombros', null, 'OUTRO', 'Fique em pé e estenda os braços retos para os lados, paralelos ao chão e formando um ângulo de 90 graus com o torso. Esta é a posição inicial.
Comece a fazer círculos de cerca de 30 cm de diâmetro com cada braço estendido. Respire normalmente.
Continue o movimento circular por cerca de dez segundos. Depois, inverta a direção dos círculos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos com os bracos'),
  (md5('catalogo-exercicio:fedb:' || 'Elbow_Circles')::uuid, 'Círculos com os cotovelos', 'Ombros', null, 'OUTRO', 'Sente-se ou fique em pé com os pés ligeiramente afastados.
Coloque as mãos nos ombros, com os cotovelos na altura dos ombros e apontados para fora.
Faça lentamente um círculo com os cotovelos. Expire ao iniciar o círculo e inspire ao completá-lo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos com os cotovelos'),
  (md5('catalogo-exercicio:fedb:' || 'Knee_Circles')::uuid, 'Círculos com os joelhos', 'Panturrilha', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com as pernas juntas e as mãos na cintura.
Faça círculos com os joelhos, respirando normalmente.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos com os joelhos'),
  (md5('catalogo-exercicio:fedb:' || 'Shoulder_Circles')::uuid, 'Círculos com os ombros', 'Ombros', null, 'OUTRO', 'Com os ombros relaxados e os braços soltos ao lado do corpo (ou no colo, se estiver sentado), gire suavemente os ombros para frente, para cima, para trás e para baixo.
Inverta a direção. Você pode fazer este exercício alternando os ombros ou ambos ao mesmo tempo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos com os ombros'),
  (md5('catalogo-exercicio:fedb:' || 'Wrist_Circles')::uuid, 'Círculos com os punhos', 'Antebraço', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com os pés na largura dos ombros. Eleve os braços para os lados até ficarem totalmente estendidos e paralelos ao chão, alinhados com os ombros. Dica: Seu corpo e braços devem formar um "T", com as palmas para baixo. Esta é a posição inicial.
Mantendo o corpo parado, gire ambos os punhos para frente em um movimento circular. Dica: Imagine que está desenhando círculos com as mãos. Respire normalmente.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos com os punhos'),
  (md5('catalogo-exercicio:fedb:' || 'Hip_Circles_prone')::uuid, 'Círculos de quadril (de quatro)', 'Abdutores', 'Peso corporal', 'PESO_CORPORAL', 'Posicione-se de quatro no chão. Mantenha uma boa postura e levante um joelho dobrado do chão. Esta é a posição inicial.
Com o joelho flexionado, gire a coxa em um arco, tentando fazer um grande círculo com o joelho.
Execute lentamente por várias repetições e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos de quadril (de quatro)'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Hip_Circles')::uuid, 'Círculos de quadril em pé', 'Abdutores', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé sobre uma perna, segurando um apoio vertical.
Levante o joelho da perna livre a 90 graus. Esta é a posição inicial.
Abra o quadril o máximo possível, fazendo um grande círculo com o joelho.
Execute o movimento lentamente por várias repetições e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos de quadril em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Ankle_Circles')::uuid, 'Círculos de tornozelo', 'Panturrilha', null, 'OUTRO', 'Segure-se em um objeto firme, como um suporte de agachamento.
Levante a perna direita no ar (cerca de 5 cm do chão) e faça um movimento circular com o dedão do pé, como se estivesse desenhando um círculo grande. Dica: Um círculo equivale a uma repetição. Respire normalmente durante o movimento.
Após completar com o pé direito, repita com a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'circulos de tornozelo'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Hang_Clean')::uuid, 'Clean alternado a partir da suspensão', 'Posterior', 'Kettlebell', 'LIVRE', 'Coloque dois kettlebells entre os pés. Para a posição inicial, empurre o bumbum para trás e olhe para frente.
Faça o arranco de um kettlebell até o ombro, segurando o outro kettlebell em suspensão. Execute o arranco estendendo as pernas e quadris enquanto puxa o kettlebell em direção aos ombros, girando o pulso.
Abaixe o kettlebell arrancado para a posição de suspensão e faça o arranco com o kettlebell alternado. Repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean alternado a partir da suspensao'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Clean_and_Jerk')::uuid, 'Clean and jerk unilateral com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure um kettlebell pela alça.
Faça o clean levando o kettlebell ao ombro, estendendo pernas e quadris e girando o pulso para a palma ficar para frente.
Flexione os joelhos em um agachamento rápido, mantendo o tronco ereto.
Inverta o movimento imediatamente, impulsionando-se com os calcanhares para gerar momentum e pressione o kettlebell sobre a cabeça até a extensão total dos braços.
Receba o peso sobre a cabeça agachando-se ligeiramente.
Mantenha o peso alto e retorne à posição em pé. Abaixe o peso para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean and jerk unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Clean')::uuid, 'Clean com barra', 'Posterior', 'Barra', 'LIVRE', 'Com a barra no chão perto das canelas, segure com pegada pronada (ou hook) logo fora das pernas. Abaixe os quadris com o peso nos calcanhares, costas retas, cabeça para frente, peito para cima e ombros ligeiramente à frente da barra. Esta é a posição inicial.
Inicie a primeira puxada empurrando pelos calcanhares e estendendo os joelhos. Mantenha o ângulo das costas e os braços retos. Mova a barra com controle até acima dos joelhos.
Na segunda puxada, acelere estendendo os quadris em um movimento de salto. Use a velocidade para levantar a barra, sem puxar com os braços. Ao final, o corpo deve estar totalmente estendido, levemente inclinado para trás.
Ao atingir a extensão total, faça a terceira puxada encolhendo os ombros e flexionando os braços com cotovelos para cima e fora. Puxe-se para baixo, girando os cotovelos sob a barra. Receba a barra na posição de agachamento frontal, apoiada nos ombros.
Recupere-se imediatamente empurrando pelos calcanhares, mantendo o tronco ereto e cotovelos altos, até ficar em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Two-Arm_Kettlebell_Clean')::uuid, 'Clean com dois kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Posicione dois kettlebells entre seus pés. Para a posição inicial, empine o bumbum e olhe para frente.
Leve os kettlebells aos ombros estendendo as pernas e quadris enquanto os eleva. Gire os pulsos durante o movimento.
Abaixe os kettlebells de volta à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean com dois kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Clean')::uuid, 'Clean com halteres', 'Posterior', 'Halteres', 'LIVRE', 'Comece em pé com um halter em cada mão e os pés na largura dos ombros.
Abaixe os pesos até o chão flexionando os quadris e os joelhos, empurrando os quadris para trás até que os halteres toquem o chão. Esta será a posição inicial.
Para iniciar o movimento, pule violentamente para cima estendendo quadris, joelhos e tornozelos para acelerar os pesos para cima. Mantenha uma pegada neutra nos halteres e os braços retos até a extensão completa.
Após a extensão completa, flexione novamente os quadris e joelhos para receber o peso em uma posição de agachamento. Deixe os braços se flexionarem, guiando os halteres até os ombros.
Ao receber o peso na posição de agachamento, estenda os quadris e joelhos para terminar em pé com os pesos sobre os ombros.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Open_Palm_Kettlebell_Clean')::uuid, 'Clean com kettlebell e palma aberta', 'Posterior', 'Kettlebell', 'LIVRE', 'Coloque um kettlebell entre os pés. Faça o clean estendendo as pernas e quadris para levantar o kettlebell em direção aos ombros.
Solte o kettlebell durante a subida, deixando-o girar para que a bola caia na palma das mãos.
Solte o kettlebell à frente e segure a alça com ambas as mãos. Abaixe-o à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean com kettlebell e palma aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_and_Press')::uuid, 'Clean e desenvolvimento com barra', 'Ombros', 'Barra', 'LIVRE', 'Fique em pé com pés na largura dos ombros, joelhos dentro dos braços. Agache para segurar a barra com pegada pronada ligeiramente mais larga que os ombros, cotovelos para fora. Barra perto das canelas, ombros sobre a barra. Posição inicial.
Puxe a barra estendendo os joelhos, mantendo as costas retas. Guie a barra para cima perto do corpo.
Ao passar os joelhos, estenda tornozelos, joelhos e quadris em um salto. Encolha os ombros e puxe a barra o mais alto possível.
No ponto mais alto, agache para receber a barra nos ombros, com cotovelos para frente. Fique em pé.
Sem mover os pés, pressione a barra acima da cabeça expirando. Abaixe com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean e desenvolvimento com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_and_Jerk')::uuid, 'Clean e jerk com barra', 'Ombros', 'Barra', 'LIVRE', 'Posicione-se como no clean: barra no chão, pegada pronada ou hook, quadris abaixados, costas retas. Posição inicial.
Execute o clean: primeira puxada estendendo joelhos, segunda puxada com salto, terceira puxada recebendo a barra no agachamento frontal. Fique em pé.
Para o arranco: com a barra nos ombros, faça um pequeno agachamento (dip) e empurre violentamente pelos calcanhares, movendo a cabeça para o lado.
Ao levantar a barra, separe os pés rapidamente (um à frente, outro atrás) e receba a barra com braços estendidos acima da cabeça. Volte à posição em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean e jerk com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Dead_Clean')::uuid, 'Clean morto com kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', 'Posicione o kettlebell entre os pés. Para a posição inicial, empine o bumbum para trás e olhe para frente.
Faça um clean do kettlebell até o ombro, estendendo pernas e quadris ao elevá-lo. O pulso deve girar durante o movimento.
Abaixe o kettlebell, mantendo os isquiotibiais tensionados com as costas retas e o bumbum para fora.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean morto com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_from_Blocks')::uuid, 'Clean sobre blocos com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Com a barra em blocos na altura desejada, segure com pegada pronada ou hook. Abaixe os quadris, costas retas, ombros à frente da barra. Posição inicial.
Inicie a puxada empurrando pelos calcanhares e estendendo os joelhos, mantendo braços retos.
Ao estender totalmente, encolha os ombros e puxe-se para baixo, girando os cotovelos sob a barra. Receba a barra no agachamento frontal.
Recupere-se empurrando pelos calcanhares até ficar em pé. Devolva a barra aos blocos para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean sobre blocos com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Hang_Clean')::uuid, 'Clean suspenso com kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', 'Posicione o kettlebell entre os pés. Para a posição inicial, empine o bumbum para trás e olhe para frente.
Faça um clean do kettlebell até o ombro, estendendo pernas e quadris ao elevá-lo. O pulso deve girar durante o movimento.
Abaixe o kettlebell para uma posição suspensa entre as pernas, mantendo os isquiotibiais tensionados. Mantenha a cabeça erguida o tempo todo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean suspenso com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Clean')::uuid, 'Clean unilateral com kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', 'Posicione um kettlebell entre os pés. Agache-se para pegá-lo, empurrando o glúteo para trás e olhando para frente.
Levante o kettlebell até o ombro estendendo as pernas e quadris, girando o pulso durante o movimento.
Retorne o peso à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'clean unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Isometric_Chest_Squeezes')::uuid, 'Compressões isométricas do peito', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Sentado ou em pé, dobre os braços em um ângulo de 90 graus e junte as palmas das mãos na frente do peito. Dica: as mãos devem estar abertas, com as palmas juntas e os dedos voltados para a frente (perpendiculares ao torso).
Pressione as duas mãos uma contra a outra enquanto contrai o peito. Comece com tensão lenta e aumente gradualmente. Respire normalmente durante a contração.
Segure pelo número recomendado de segundos.
Agora, libere a tensão lentamente.
Descanse pelo tempo recomendado e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'compressoes isometricas do peito'),
  (md5('catalogo-exercicio:fedb:' || 'Prowler_Sprint')::uuid, 'Corrida com prowler', 'Cardio', null, 'CARDIO', 'Posicione o trenó (Prowler) em uma superfície adequada, com carga que exija esforço sem atrapalhar a velocidade.
Use as alças altas ou baixas. Coloque as mãos nas alças com braços estendidos, inclinando-se para frente.
Com boa postura, empurre o chão com passadas curtas e alternadas. Corra o mais rápido possível por uma distância curta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'corrida com prowler'),
  (md5('catalogo-exercicio:fedb:' || 'Running_Treadmill')::uuid, 'Corrida na esteira', 'Cardio', 'Máquina', 'CARDIO', 'Pise na esteira e selecione a opção desejada no menu. A maioria das esteiras tem modo manual ou programas pré-definidos. Você pode inserir idade e peso para estimar calorias queimadas. Ajuste a inclinação para variar a intensidade.
A esteira oferece conveniência, benefícios cardiovasculares e geralmente menos impacto que correr ao ar livre. Uma pessoa de 68 kg queima mais de 450 calorias correndo a 13 km/h por 30 minutos. Mantenha a postura correta e segure os apoios apenas quando necessário, como para descer ou verificar a frequência cardíaca.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'corrida na esteira'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Sprint')::uuid, 'Corrida no banco', 'Quadríceps', null, 'OUTRO', 'Fique em pé no chão com um pé apoiado em um banco ou caixa, com o calcanhar próximo à borda.
Impulsione com o pé no banco, estendendo o quadril e o joelho.
Aterre com o pé oposto no topo do banco, retornando o outro pé à posição inicial.
Continue alternando os pés para completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'corrida no banco'),
  (md5('catalogo-exercicio:fedb:' || 'Trail_Running_Walking')::uuid, 'Corrida/caminhada em trilha', 'Cardio', null, 'CARDIO', 'Correr ou caminhar em trilhas aumenta a circulação e a frequência cardíaca rapidamente. Use calçados adequados. Ao subir, os músculos da panturrilha e glúteos são ativados; na descida, joelhos, articulações e tornozelos absorvem o impacto. Dê passos menores na descida, mantenha os joelhos flexionados para reduzir o impacto e diminua a velocidade para evitar quedas.
Uma pessoa de 68 kg pode queimar mais de 200 calorias em 30 minutos de caminhada em subida, comparado a 175 em superfície plana. Se correr, pode queimar mais de 500 calorias em 30 minutos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'corrida/caminhada em trilha'),
  (md5('catalogo-exercicio:fedb:' || 'Elbow_to_Knee')::uuid, 'Cotovelo no joelho', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão, cruzando a perna direita sobre o joelho esquerdo flexionado. Entrelace as mãos atrás da cabeça, com as omoplatas no chão. Esta será sua posição inicial.
Flexione a coluna e gire o tronco para levar o cotovelo esquerdo até o joelho direito.
Volte à posição inicial e repita o movimento para o número desejado de repetições antes de trocar de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cotovelo no joelho'),
  (md5('catalogo-exercicio:fedb:' || 'Elbows_Back')::uuid, 'Cotovelos para trás', 'Peito', null, 'OUTRO', 'Fique em pé ereto.
Coloque as duas mãos na região lombar, com os dedos apontando para baixo e os cotovelos para fora.
Puxe suavemente os cotovelos para trás, tentando aproximá-los um do outro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cotovelos para tras'),
  (md5('catalogo-exercicio:fedb:' || 'Cross_Over_-_With_Bands')::uuid, 'Crossover com elástico', 'Peito', 'Elástico', 'ELASTICO', 'Prenda uma faixa elástica em um ponto fixo.
De costas para o ponto, segure as alças da faixa e afaste-se para criar tensão.
Eleve os braços para os lados, paralelos ao chão, com uma leve flexão nos cotovelos e palmas para frente, formando um "T" com o torso. Esta é a posição inicial.
Mantendo os braços retos, traga-os para a frente em um movimento semicircular, expirando e contraindo o peitoral. Segure a contração por um segundo.
Volte lentamente à posição inicial inspirando.
Execute as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crossover com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Crossover')::uuid, 'Crossover deitado', 'Abdutores', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com as pernas estendidas.
Cruze uma perna sobre o corpo com o joelho flexionado, tentando tocar o joelho no chão. Seu parceiro deve ajoelhar ao seu lado, segurando seu ombro com uma mão e controlando a perna cruzada com a outra. Esta será sua posição inicial.
Tente levantar o joelho flexionado do chão enquanto seu parceiro impede qualquer movimento real.
Após 10-20 segundos, relaxe a perna enquanto seu parceiro pressiona suavemente o joelho em direção ao chão. Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crossover deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Low_Cable_Crossover')::uuid, 'Crossover na polia baixa', 'Peito', 'Polia', 'MAQUINA', 'Para a posição inicial, ajuste as polias na posição baixa, selecione a resistência e segure uma alça em cada mão.
Dê um passo à frente para criar tensão nas polias. As palmas devem estar voltadas para frente, as mãos abaixo da cintura e os braços retos. Esta será a posição inicial.
Com uma leve flexão nos braços, puxe as mãos para cima e em direção à linha média do corpo. As mãos devem se encontrar na frente do peito, com as palmas para cima.
Retorne os braços à posição inicial após uma breve pausa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crossover na polia baixa'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Arm_Cable_Crossover')::uuid, 'Crossover unilateral na polia', 'Peito', 'Polia', 'MAQUINA', 'Ajuste as polias para a posição alta, selecione a resistência e segure uma alça em cada mão.
Dê um passo à frente, com os braços estendidos e mãos juntas, tronco ereto e pés escalonados. Esta é a posição inicial.
Mantenha o braço esquerdo fixo e estenda o braço direito para o lado, com cotovelo levemente flexionado, até a altura do ombro.
Retorne o braço à posição inicial, puxando a mão de volta para a linha média do corpo.
Segure por um segundo e repita com o braço oposto, alternando os lados até completar as repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crossover unilateral na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Around_The_Worlds')::uuid, 'Crucifixo 360 com halteres', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco plano segurando um halter em cada mão, com as palmas voltadas para o teto. Dica: Os braços devem estar paralelos ao chão e próximos às coxas. Mantenha os cotovelos levemente dobrados para evitar lesões. Esta é a posição inicial.
Mova os halteres em um semicírculo, deslocando-os da posição inicial até acima da cabeça, mantendo os braços paralelos ao chão. Inspire durante essa fase.
Inverta o movimento para retornar os halteres à posição inicial, expirando.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo 360 com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Bodyweight_Flyes')::uuid, 'Crucifixo com peso corporal', 'Peito', 'Barra W', 'LIVRE', 'Posicione duas barras EZ carregadas igualmente no chão, lado a lado, garantindo que possam rolar.
Assuma a posição de flexão sobre as barras, apoiando o peso nas mãos e pés, com braços estendidos e corpo reto.
Coloque as mãos nas barras. Esta é a posição inicial.
Movimente as mãos lentamente para longe da linha média do corpo, afastando as barras, inspirando.
Após afastar as barras o máximo possível, retorne à posição inicial puxando-as juntas, expirando.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Dumbbell_Flyes')::uuid, 'Crucifixo declinado com halteres', 'Peito', 'Halteres', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se com um halter em cada mão sobre as coxas, palmas voltadas uma para a outra.
Ao deitar, posicione os halteres à frente na largura dos ombros, com os braços estendidos e perpendiculares ao chão. Esta é a posição inicial.
Com uma ligeira flexão nos cotovelos para evitar estresse, abaixe os braços em um arco amplo até sentir o alongamento no peito, inspirando. Dica: Movimente apenas os ombros.
Retorne os braços à posição inicial contraindo os peitorais e expirando. Dica: Use o mesmo arco de movimento.
Segure por um segundo no topo e repita pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo declinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Dumbbell_Flyes')::uuid, 'Crucifixo inclinado com halteres', 'Peito', 'Halteres', 'LIVRE', 'Segure um haltere em cada mão e deite-se em um banco inclinado com ângulo máximo de 30 graus.
Estenda os braços acima de você com uma leve flexão nos cotovelos.
Gire os punhos até as palmas das mãos ficarem voltadas para você, com os dedos mindinhos próximos um do outro. Esta é a posição inicial.
Inspire e abaixe os braços lateralmente, mantendo-os estendidos e girando os punhos até as palmas se enfrentarem. Ao final, os braços estarão ao lado do corpo com as palmas para cima.
Expire e retorne os halteres à posição inicial, revertendo o movimento e girando as mãos para os mindinhos ficarem próximos novamente. O movimento ocorre apenas nas articulações do ombro e do punho, sem mexer os cotovelos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inclinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Dumbbell_Flyes_-_With_A_Twist')::uuid, 'Crucifixo inclinado com halteres e rotação', 'Peito', 'Halteres', 'LIVRE', 'Segure um haltere em cada mão e deite-se em um banco inclinado com ângulo máximo de 30 graus.
Estenda os braços acima de você com uma leve flexão nos cotovelos.
Gire os punhos até as palmas das mãos ficarem voltadas para você, com os dedos mindinhos próximos um do outro. Esta é a posição inicial.
Inspire e abaixe os braços lateralmente, mantendo-os estendidos e girando os punhos até as palmas se enfrentarem. Ao final, os braços estarão ao lado do corpo com as palmas para cima.
Expire e retorne os halteres à posição inicial, revertendo o movimento e girando as mãos para os mindinhos ficarem próximos novamente. O movimento ocorre apenas nas articulações do ombro e do punho, sem mexer os cotovelos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inclinado com halteres e rotacao'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Cable_Flye')::uuid, 'Crucifixo inclinado na polia', 'Peito', 'Polia', 'MAQUINA', 'Posicione as polias no nível mais baixo, abaixo do torso.
Coloque um banco inclinado a 45 graus entre as polias, selecione o peso e segure uma polia em cada mão.
Deitado no banco, una as mãos à frente do rosto com os braços estendidos. Esta será a posição inicial.
Com uma leve flexão dos cotovelos, abra os braços em um arco amplo até sentir um alongamento no peito. Inspire ao fazer isso. Dica: Movimente apenas os ombros, mantendo os braços fixos.
Retorne os braços à posição inicial enquanto expira e contrai o peito. Segure a contração por um segundo. Dica: Use o mesmo arco de movimento.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inclinado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')::uuid, 'Crucifixo inverso com halter apoiado no banco', 'Ombros', 'Halteres', 'LIVRE', 'Fique em pé segurando um halter em cada mão, com um banco inclinado à sua frente.
Mantendo as costas retas e a curvatura natural, incline-se para frente até a testa tocar o banco. Deixe os braços pendurados perpendicularmente ao chão, com as palmas voltadas uma para a outra e o tronco paralelo ao solo. Esta é a posição inicial.
Com o tronco fixo e os braços estendidos com leve flexão nos cotovelos, levante os halteres lateralmente até os braços ficarem paralelos ao chão. Expire ao levantar. Evite balançar o tronco ou mover os braços para trás.
Contraia por um segundo no topo e depois abaixe os halteres lentamente à posição inicial.
Repita o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso com halter apoiado no banco'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Flyes')::uuid, 'Crucifixo inverso com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Deite-se em um banco inclinado com o peito e o estômago pressionados contra o encosto. Segure halteres com as palmas voltadas uma para a outra (pegada neutra).
Estenda os braços à frente, perpendicularmente ao banco. As pernas devem ficar firmes, com a pressão nas pontas dos pés. Esta é a posição inicial.
Mantendo os cotovelos levemente flexionados, mova os pesos para os lados em um arco enquanto expira. Dica: Contraia as escápulas para melhores resultados.
Eleve os braços até ficarem paralelos ao chão.
Sinta a contração e abaixe lentamente os pesos à posição inicial enquanto inspira.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Flyes_With_External_Rotation')::uuid, 'Crucifixo inverso com rotação externa', 'Ombros', 'Halteres', 'LIVRE', 'Deite-se em um banco inclinado a 30 graus com o peito e o estômago pressionados contra o encosto.
Segure halteres com as palmas voltadas para baixo. Os braços devem estar à frente, perpendicularmente ao banco, com cotovelos levemente flexionados. As pernas firmes, pressionando as pontas dos pés (calcanhares fora do chão). Esta é a posição inicial.
Mantendo os cotovelos flexionados, mova os pesos para os lados em um arco enquanto expira.
Ao levantar, gire os punhos externamente em 90 graus, passando de palmas para baixo (pronada) para palmas uma para a outra (neutra). Dica: Contraia as escápulas.
Eleve os braços até o nível da cabeça.
Sinta a contração e abaixe lentamente os pesos à posição inicial enquanto inspira.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso com rotacao externa'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Lying_Rear_Lateral_Raise')::uuid, 'Crucifixo inverso deitado com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e deite-se de bruços em um banco ajustável levemente inclinado (cerca de 15 graus em relação ao chão).
Mantenha os braços estendidos com os cotovelos levemente flexionados e as palmas das mãos voltadas para o torso. Esta é a posição inicial.
Eleve os braços para os lados até os cotovelos ficarem na altura dos ombros e os braços paralelos ao chão, expirando. Mantenha os braços perpendiculares ao torso e contraia por um segundo no topo.
Abaixe os halteres lentamente até a posição inicial, inspirando.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso deitado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Lying_One-Arm_Rear_Lateral_Raise')::uuid, 'Crucifixo inverso deitado unilateral', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter com uma mão e deite-se de bruços em um banco ajustável levemente inclinado (cerca de 15 graus em relação ao chão). Use a outra mão para segurar a perna do banco para estabilidade.
Mantenha o braço estendido com o cotovelo levemente flexionado e a palma da mão voltada para o torso. Esta é a posição inicial.
Eleve o braço com o halter para o lado até o cotovelo ficar na altura do ombro e o braço paralelo ao chão, expirando. Mantenha o braço perpendicular ao torso e contraia por um segundo no topo.
Abaixe o halter lentamente até a posição inicial, inspirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso deitado unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Rear_Delt_Fly')::uuid, 'Crucifixo inverso na polia', 'Ombros', 'Polia', 'MAQUINA', 'Ajuste as polias para uma altura acima da cabeça e selecione o peso.
Segure a polia esquerda com a mão direita e a polia direita com a mão esquerda, cruzando os braços à frente. Esta é a posição inicial.
Movimente os braços para trás e para os lados, mantendo-os estendidos.
Faça uma pausa no final do movimento antes de retornar as alças à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Bent-Over_Rear_Delt_Raise')::uuid, 'Crucifixo inverso sentado com halter', 'Ombros', 'Halteres', 'LIVRE', 'Coloque alguns halteres à frente de um banco plano.
Sente-se na ponta do banco com as pernas juntas e os halteres atrás das panturrilhas.
Incline-se para frente, mantendo as costas retas, para pegar os halteres com as palmas voltadas uma para a outra. Esta é a posição inicial.
Com o torso inclinado e imóvel, e os braços levemente flexionados, levante os halteres para os lados até os braços ficarem paralelos ao chão. Expire ao levantar.
Contraia por um segundo no topo e depois abaixe os halteres lentamente à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso sentado com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_Low-Pulley_Side_Lateral')::uuid, 'Crucifixo inverso unilateral na polia baixa', 'Ombros', 'Polia', 'MAQUINA', 'Selecione o peso e segure a alça da polia baixa com a mão direita.
Incline-se na cintura até o tronco ficar quase paralelo ao chão, com os joelhos levemente flexionados e a mão esquerda apoiada na coxa esquerda. O braço direito deve estar pendurado com cotovelo levemente flexionado. Esta é a posição inicial.
Levante o braço direito lateralmente, com cotovelo flexionado, até ficar paralelo ao chão e alinhado com a orelha direita. Expire ao executar.
Abaixe o peso lentamente à posição inicial enquanto inspira.
Repita o número recomendado de repetições e troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo inverso unilateral na polia baixa'),
  (md5('catalogo-exercicio:fedb:' || 'Back_Flyes_-_With_Bands')::uuid, 'Crucifixo invertido com elástico', 'Ombros', 'Elástico', 'ELASTICO', 'Prenda uma banda em um poste fixo, como o de um rack de agachamento.
Segure as alças da banda e afaste-se para criar tensão.
Estenda e levante os braços à sua frente, retos e paralelos ao chão, com os pés afastados na largura dos ombros. Esta é a posição inicial.
Ao expirar, mova os braços para os lados e para trás, mantendo-os estendidos e paralelos ao chão, até que estejam abertos.
Após uma pausa, retorne à posição inicial enquanto inspira.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo invertido com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Sled_Reverse_Flye')::uuid, 'Crucifixo invertido com trenó', 'Ombros', null, 'OUTRO', 'Acople duas alças a um trenó usando uma corda ou corrente. Carregue o trenó com um peso leve.
Fique de frente para o trenó e afaste-se até sentir tensão na corda. Segure as duas alças com os braços estendidos na altura da cintura. Flexione levemente os joelhos e mantenha o peito e a cabeça erguidos. Esta é a posição inicial.
Sem flexionar os cotovelos, puxe as alças para cima e para os lados, realizando um crucifixo invertido com uma rotação externa. As palmas das mãos devem estar voltadas para a frente durante o movimento.
Retorne à posição inicial, dando alguns passos para trás para eliminar a folga na corda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo invertido com treno'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Iron_Cross')::uuid, 'Crucifixo invertido iron cross na polia', 'Peito', 'Polia', 'MAQUINA', 'Ajuste as polias para a posição alta, selecione a resistência e segure uma alça em cada mão.
Fique entre as polias com os braços estendidos lateralmente em forma de "T", peito erguido. Esta é a posição inicial.
Mantenha os cotovelos estendidos e puxe os braços para os lados.
Retorne os braços à posição inicial após uma pausa na contração máxima.
Continue pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo invertido iron cross na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Flat_Bench_Cable_Flyes')::uuid, 'Crucifixo na polia no banco reto', 'Peito', 'Polia', 'MAQUINA', 'Posicione um banco plano entre duas polias baixas, de modo que, ao deitar, seu peito fique alinhado com as polias.
Deite-se de costas no banco com os pés no chão.
Pegue as alças com as palmas voltadas para cima, mantendo os braços estendidos ao lado do corpo com uma leve flexão nos cotovelos. Esta é a posição inicial.
Levante os braços em um movimento semicircular à sua frente, juntando as mãos no topo. Contraia o peito, expire e segure a contração por um segundo.
Retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo na polia no banco reto'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Flyes')::uuid, 'Crucifixo reto com halteres', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco plano com um halter em cada mão apoiado sobre as coxas. As palmas das mãos devem estar voltadas uma para a outra.
Use as coxas para ajudar a levantar os halteres, erguendo-os um de cada vez até segurá-los na frente de você na largura dos ombros, com as palmas se enfrentando. Levante os halteres como se fosse fazer um supino, mas pare e segure logo antes de travar os braços. Esta será a posição inicial.
Com uma leve flexão nos cotovelos para evitar estresse no tendão do bíceps, abaixe os braços para os lados em um arco amplo até sentir um alongamento no peito. Inspire ao realizar essa parte do movimento. Dica: Lembre-se de que os braços devem permanecer estáticos; o movimento deve ocorrer apenas na articulação do ombro.
Volte os braços à posição inicial enquanto contrai os músculos do peito e expira. Dica: Use o mesmo arco de movimento usado para baixar os pesos.
Segure por um segundo na posição contraída e repita o movimento pelo número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo reto com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Flat_Bench_Dumbbell_Flye')::uuid, 'Crucifixo unilateral no banco reto com halter', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco plano com um halter em uma mão apoiado na coxa, em pegada neutra.
Use a coxa para ajudar a levantar o halter até a frente, com o braço totalmente estendido. A mão livre deve segurar o banco para apoio. Esta é a posição inicial.
Mantenha o cotovelo levemente flexionado. Abaixe o braço em um arco amplo até sentir o alongamento no peito. Inspire durante esse movimento.
Retorne o braço à posição inicial contraindo o peito e expire. Use o mesmo arco de movimento.
Segure por um segundo na posição contraída e repita as repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'crucifixo unilateral no banco reto com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Cuban_Press')::uuid, 'Cuban press', 'Ombros', 'Halteres', 'LIVRE', 'Em pé, segure um halter em cada mão com pegada pronada. Eleve os braços superiores paralelos ao chão, com os antebraços pendurados como em um "espantalho". Esta é a posição inicial.
Gire os ombros externamente até que os pulsos fiquem acima dos cotovelos, com os antebraços perpendiculares ao chão.
Estenda os cotovelos, elevando os halteres acima da cabeça.
Volte à posição inicial inspirando, revertendo os movimentos.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'cuban press'),
  (md5('catalogo-exercicio:fedb:' || 'Lower_Back_Curl')::uuid, 'Curl para lombar', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços com os braços abertos para os lados. Esta será a posição inicial.
Usando os músculos da lombar, estenda a coluna levantando o peito do chão. Não use os braços para se empurrar. Mantenha a cabeça erguida durante o movimento. Repita por 10-20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'curl para lombar'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Alternating_Dumbbell_Press')::uuid, 'Desenvolvimento alternado com halteres em pé', 'Ombros', 'Halteres', 'LIVRE', 'Fique em pé com um halter em cada mão. Levante os halteres até os ombros, com as palmas viradas para frente e os cotovelos apontados para fora. Esta será a posição inicial.
Estenda um braço para pressionar o halter para cima, mantendo a outra mão no lugar. Não incline o corpo ou dê impulso durante o movimento.
Após uma breve pausa, retorne o peso à posição inicial.
Repita para o lado oposto, alternando entre os braços.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento alternado com halteres em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Kettlebell_Press')::uuid, 'Desenvolvimento alternado com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Faça o arranco de dois kettlebells até os ombros, estendendo as pernas e quadris enquanto os puxa em direção aos ombros, girando os pulsos.
Pressione um diretamente acima da cabeça estendendo o cotovelo, girando-o para que a palma fique voltada para frente, enquanto mantém o outro kettlebell parado.
Abaixe o kettlebell pressionado à posição inicial e pressione imediatamente com o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento alternado com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Cable_Shoulder_Press')::uuid, 'Desenvolvimento alternado na polia', 'Ombros', 'Polia', 'MAQUINA', 'Ajuste os cabos para a parte inferior da torre e selecione um peso adequado.
Segure os cabos na altura dos ombros, com as palmas voltadas para frente. Esta é a posição inicial.
Mantendo a cabeça e o peito erguidos, estenda o cotovelo para pressionar um lado diretamente acima da cabeça.
Após uma pausa no topo, retorne à posição inicial e repita do lado oposto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento alternado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Anti-Gravity_Press')::uuid, 'Desenvolvimento anti-gravidade com barra', 'Ombros', 'Barra', 'LIVRE', 'Coloque uma barra no chão atrás da cabeça de um banco inclinado.
Deite-se de bruços no banco. Com uma pegada pronada, levante a barra do chão. Dobre os cotovelos, fazendo um curl reverso para trazer a barra perto do peito. Esta é a posição inicial.
Para começar, estenda os cotovelos para pressionar a barra para frente, mantendo os braços paralelos ao chão.
Volte à posição inicial e repita para completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento anti-gravidade com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Arnold_Dumbbell_Press')::uuid, 'Desenvolvimento Arnold com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Sente-se em um banco com apoio para as costas e segure dois halteres na frente do corpo, na altura do peito, com as palmas voltadas para você e os cotovelos dobrados. Dica: Os braços devem ficar próximos ao torso, como na fase contraída de um curl com halteres.
Para executar o movimento, levante os halteres enquanto gira as palmas das mãos até ficarem voltadas para frente.
Continue levantando até estender os braços completamente acima da cabeça. Expire ao realizar esta parte.
Após uma pausa breve no topo, abaixe os halteres girando as palmas de volta para você. Dica: O braço esquerdo gira no sentido anti-horário e o direito no sentido horário. Inspire durante essa fase.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento arnold com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Arnold_Press')::uuid, 'Desenvolvimento Arnold com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Faça um clean com o kettlebell até o ombro, estendendo pernas e quadris ao elevá-lo. A palma da mão deve ficar virada para dentro.
Olhando para frente, pressione o kettlebell para cima e sobre a cabeça, girando o pulso para que a palma fique virada para frente no topo do movimento.
Retorne o kettlebell à posição inicial, com a palma virada para dentro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento arnold com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Barbell_Press_Behind_Neck')::uuid, 'Desenvolvimento atrás da nuca com barra', 'Ombros', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento para facilitar o levantamento da barra. Comece ajustando a barra em uma altura adequada. Com a barra carregada, posicione-se sob ela e apoie-a na parte de trás dos ombros (logo abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack, empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas com uma postura na largura dos ombros, dedos ligeiramente para fora. Mantenha as costas retas. Esta é a posição inicial.
Eleve a barra sobre a cabeça, estendendo completamente os braços enquanto expira.
Segure a contração por um segundo e abaixe a barra de volta à posição inicial, inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento atras da nuca com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Bradford_Rocky_Presses')::uuid, 'Desenvolvimento Bradford com barra', 'Ombros', 'Barra', 'LIVRE', 'Sente-se em um banco de desenvolvimento militar com uma barra na altura dos ombros, com pegada pronada (palmas viradas para frente). Dica: a pegada deve ser mais larga que a largura dos ombros, criando um ângulo de 90 graus entre o antebraço e o braço quando a barra desce. Esta é a posição inicial.
Ao pegar a barra com a pegada correta, levante-a sobre a cabeça travando os braços.
Abaixe a barra lentamente atrás da cabeça enquanto inspira.
Levante a barra de volta à posição inicial enquanto expira.
Abaixe a barra lentamente à posição inicial enquanto inspira. Isso é uma repetição.
Alternar dessa maneira até completar as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento bradford com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Bradford_Press')::uuid, 'Desenvolvimento Bradford em pé com barra', 'Ombros', 'Barra', 'LIVRE', 'Coloque uma barra carregada na altura dos ombros em um rack. Com uma pegada pronada na largura dos ombros, comece com a barra apoiada na frente dos ombros. Esta é a posição inicial.
Inicie o movimento estendendo os cotovelos para pressionar a barra sobre a cabeça. Evite travar os cotovelos ao mover o peso atrás da cabeça.
Abaixe a barra até a parte de trás da cabeça, formando um ângulo reto no cotovelo.
Levante a barra de volta sobre a cabeça, estendendo os cotovelos.
Abaixe a barra até a posição inicial.
Alternar dessa maneira até completar o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento bradford em pe com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Two-Arm_Kettlebell_Military_Press')::uuid, 'Desenvolvimento com dois kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Faça um clean com dois kettlebells até os ombros, girando os pulsos para que as palmas fiquem voltadas para frente.
Pressione os kettlebells para cima e para fora. Ao passarem da cabeça, incline-se para trás para apoiá-los atrás da nuca.
Contraia os dorsais, glúteos e abdômen para estabilidade.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento com dois kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Palms-In_Dumbbell_Press')::uuid, 'Desenvolvimento com halteres pegada neutra', 'Ombros', 'Halteres', 'LIVRE', 'Comece com um halter em cada mão, com os braços totalmente estendidos para os lados usando uma pegada neutra. Os pés devem estar na largura dos ombros. Lentamente, levante os halteres até formar um ângulo de 90 graus com os braços. Nota: Os antebraços devem estar perpendiculares ao chão. Esta é a posição inicial.
Mantenha a pegada neutra durante todo o exercício. Lentamente, levante os halteres até os braços estarem totalmente estendidos.
Enquanto inspira, abaixe os pesos até os braços estarem novamente em um ângulo de 90 graus.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento com halteres pegada neutra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Press')::uuid, 'Desenvolvimento em pé com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Em pé, com os pés na largura dos ombros, segure um halter em cada mão. Levante os halteres até a altura da cabeça, com os cotovelos para fora e cerca de 90 graus. Esta é a posição inicial.
Mantendo a técnica rigorosa, sem impulso das pernas ou inclinar para trás, estenda os cotovelos para levantar os pesos juntos acima da cabeça.
Faça uma pausa e retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento em pe com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Shoulder_Press')::uuid, 'Desenvolvimento militar com barra', 'Ombros', 'Barra', 'LIVRE', 'Sente-se em um banco com apoio dorsal em um rack de agachamento. Posicione a barra logo acima da cabeça. Segure a barra com pegada pronada (palmas para frente).
Após pegar a barra, levante-a acima da cabeça travando os braços. Segure na altura dos ombros e ligeiramente à frente da cabeça. Esta é a posição inicial.
Abaixe a barra lentamente até os ombros inspirando.
Levante a barra de volta à posição inicial expirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento militar com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Military_Press')::uuid, 'Desenvolvimento militar em pé com barra', 'Ombros', 'Barra', 'LIVRE', 'Comece posicionando uma barra na altura do peito em um suporte de agachamento. Após selecionar os pesos, segure a barra com uma pegada pronada (palmas voltadas para frente). Certifique-se de que as mãos estejam mais afastadas que a largura dos ombros.
Flexione levemente os joelhos e apoie a barra na clavícula. Levante a barra mantendo-a apoiada no peito. Dê um passo para trás e posicione os pés na largura dos ombros.
Com a pegada correta, levante a barra acima da cabeça travando os braços. Segure na altura dos ombros e ligeiramente à frente da cabeça. Esta é a posição inicial.
Abaixe a barra lentamente até a clavícula enquanto inspira.
Levante a barra de volta à posição inicial enquanto expira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento militar em pe com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Barbell_Military_Press')::uuid, 'Desenvolvimento militar sentado com barra', 'Ombros', 'Barra', 'LIVRE', 'Sente-se em um banco de desenvolvimento militar com a barra atrás da cabeça. Peça a um assistente para passar a barra (melhor para os ombros) ou segure-a com cuidado, com as palmas para frente e pegada mais larga que os ombros, formando um ângulo de 90 graus entre antebraço e braço quando a barra desce.
Com a barra na pegada correta, levante-a acima da cabeça até os braços ficarem estendidos. Segure na altura dos ombros e ligeiramente à frente da cabeça. Esta é a posição inicial.
Abaixe a barra lentamente até a altura da clavícula, inspirando.
Levante a barra de volta à posição inicial, expirando.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento militar sentado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Shoulder_Press')::uuid, 'Desenvolvimento na máquina articulada', 'Ombros', 'Máquina', 'MAQUINA', 'Ajuste o peso e o banco para que as alças fiquem na altura dos ombros. Mantenha o peito erguido e segure as alças com pegada pronada. Esta é a posição inicial.
Empurre as alças para cima, estendendo os cotovelos.
Após uma breve pausa no topo, retorne o peso logo acima da posição inicial, mantendo a tensão muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Shoulder_Press')::uuid, 'Desenvolvimento na polia', 'Ombros', 'Polia', 'MAQUINA', 'Ajuste os cabos para a parte inferior das torres e selecione um peso adequado.
Fique em pé entre as torres. Segure os cabos na altura dos ombros, com as palmas voltadas para frente. Esta é a posição inicial.
Mantendo a cabeça e o peito erguidos, estenda os cotovelos para empurrar as alças diretamente acima da cabeça.
Após uma pausa no topo, retorne à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Palm-In_One-Arm_Dumbbell_Press')::uuid, 'Desenvolvimento neutro em pé com halter', 'Ombros', 'Halteres', 'LIVRE', 'Comece com um halter em uma mão, com o braço totalmente estendido para o lado usando uma pegada neutra. Use a outra mão para segurar um banco inclinado para manter o equilíbrio.
Os pés devem estar na largura dos ombros. Lentamente, levante o halter até formar um ângulo de 90 graus com o braço. Nota: O antebraço deve estar perpendicular ao chão. Mantenha a pegada neutra durante todo o exercício.
Lentamente, levante o halter até o braço estar totalmente estendido. Esta é a posição inicial.
Enquanto inspira, abaixe o peso até o braço estar novamente em um ângulo de 90 graus.
Sinta a contração por um segundo e então levante o peso de volta à posição inicial enquanto expira. Lembre-se de segurar o banco inclinado e manter os pés posicionados para equilíbrio.
Repita para a quantidade recomendada de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento neutro em pe com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Overhead_Shoulder_Press')::uuid, 'Desenvolvimento no smith', 'Ombros', 'Máquina', 'MAQUINA', 'Posicione um banco plano (de preferência com encosto) sob o Smith Machine. Ajuste a barra para que, ao sentar no banco, os braços precisem estar quase totalmente estendidos para alcançá-la.
Sente-se ligeiramente atrás da barra, formando uma linha reta imaginária do nariz à barra. Pés firmes no chão. Pegue a barra com as palmas para frente, desengate-a e levante até os braços ficarem totalmente estendidos. Esta é a posição inicial.
Inspire e abaixe lentamente a barra até a altura do queixo.
Levante a barra de volta à posição inicial usando os ombros enquanto expira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento no smith'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Para_Press')::uuid, 'Desenvolvimento para press com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Leve o kettlebell ao ombro com um movimento de arranco, estendendo as pernas e quadris enquanto puxa o peso em direção ao ombro. Gire o pulso para que a palma da mão fique virada para frente. Esta é a posição inicial.
Segure o kettlebell com o cotovelo para o lado e pressione-o para cima e para fora até estender completamente o braço acima da cabeça.
Abaixe o kettlebell de volta ao ombro com controle e repita. Contraia o latíssimo, glúteos e abdômen com força para maior estabilidade e força.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento para press com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Dumbbell_Press')::uuid, 'Desenvolvimento sentado com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Pegue um par de halteres e sente-se em um banco de desenvolvimento militar ou um banco utilitário com encosto, colocando os halteres em pé sobre as coxas.
Levante os halteres um de cada vez usando as coxas para trazê-los à altura dos ombros em cada lado.
Gire os pulsos para que as palmas das mãos fiquem voltadas para a frente. Esta é a posição inicial.
Ao expirar, empurre os halteres para cima até que se toquem no topo.
Após uma pausa de um segundo, volte lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento sentado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Seated_Press')::uuid, 'Desenvolvimento sentado com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Sente-se no chão e afaste as pernas confortavelmente.
Faça um clean com um kettlebell até o ombro.
Pressione o kettlebell para cima até travar os braços sobre a cabeça. Retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento sentado com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Cable_Shoulder_Press')::uuid, 'Desenvolvimento sentado na polia', 'Ombros', 'Polia', 'MAQUINA', 'Ajuste o peso e sente-se, segurando as alças. Os braços devem estar a 90 graus do corpo, com a cabeça e o peito erguidos. Os cotovelos também a 90 graus. Esta é a posição inicial.
Estenda os cotovelos, pressionando as alças acima da cabeça.
Após uma pausa no topo, retorne as alças à posição inicial, mantendo a tensão nos cabos.
Pode-se fazer com as costas fora do encosto e alternando as mãos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento sentado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_One-Arm_Shoulder_Press')::uuid, 'Desenvolvimento unilateral com halter', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter e sente-se em um banco militar ou em um banco com encosto, ou fique em pé, com o halter apoiado na coxa.
Levante o halter até a altura do ombro. A outra mão pode ficar estendida ao lado, na cintura ou segurando uma superfície fixa.
Gire o pulso para que a palma da mão fique voltada para frente. Esta é a posição inicial.
Expire e empurre o halter para cima até o braço ficar totalmente estendido.
Após uma pausa de um segundo, inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Military_Press_To_The_Side')::uuid, 'Desenvolvimento unilateral com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Leve o kettlebell ao ombro com um movimento de arranco, estendendo as pernas e quadris enquanto puxa o peso em direção ao ombro. Gire o pulso para que a palma da mão fique virada para dentro. Esta é a posição inicial.
Olhe para o kettlebell e pressione-o para cima e para fora até estender completamente o braço acima da cabeça.
Abaixe o kettlebell de volta ao ombro com controle e repita. Contraia o latíssimo, glúteos e abdômen com força para maior estabilidade e força.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'desenvolvimento unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Platform_Hamstring_Slides')::uuid, 'Deslizamento de isquiotibiais no chão', 'Posterior', null, 'OUTRO', 'Para este exercício, é necessário um piso liso, como de madeira. Deite-se de costas com as pernas estendidas. Coloque uma toalha de ginástica ou um peso leve sob o calcanhar. Esta será a posição inicial.
Comece o movimento flexionando o joelho, mantendo a outra perna estendida.
Continue trazendo o calcanhar em sua direção, deslizando-o no chão.
Na flexão máxima do joelho, inverta o movimento para retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'deslizamento de isquiotibiais no chao'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Arm_Drill')::uuid, 'Drill de braços ajoelhado', 'Ombros', null, 'OUTRO', 'Este exercício melhora a eficiência dos braços na corrida. Comece ajoelhado, com o pé esquerdo à frente e o joelho direito no chão. Aplique pressão no calcanhar da frente para ativar glúteos e isquiotibiais.
Balance os braços como pêndulos longos. Feche o ângulo dos braços, simulando o movimento de uma corrida leve, progredindo para corrida e depois sprint.
Assim que as mãos passarem pelos quadris, acelere-as para frente no movimento de sprint, movendo-as o mais rápido possível.
Troque a posição dos joelhos e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'drill de bracos ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Cone_Sprint_Drill')::uuid, 'Drill de sprint com cone único', 'Quadríceps', null, 'OUTRO', 'Fique ao lado do cone com um braço para trás e outro para frente.
Movimente os pés rapidamente, bloqueando com os braços, e circule o cone mantendo os joelhos altos e ação vigorosa dos pés.
Descanse após três voltas ao redor do cone.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'drill de sprint com cone unico'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Deltoid_Raise')::uuid, 'Elevação alternada do deltoide', 'Ombros', 'Halteres', 'LIVRE', 'Em pé, segure um par de halteres ao lado do corpo.
Mantendo os cotovelos ligeiramente flexionados, levante os pesos diretamente à frente até a altura dos ombros, evitando balanços ou trapaças.
Volte os pesos à posição inicial.
Na próxima repetição, levante os pesos lateralmente, elevando-os para os lados até cerca da altura dos ombros.
Retorne os pesos à posição inicial e continue alternando entre a frente e o lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao alternada do deltoide'),
  (md5('catalogo-exercicio:fedb:' || 'Single_Dumbbell_Raise')::uuid, 'Elevação com halter único', 'Ombros', 'Halteres', 'LIVRE', 'Com os pés afastados, segure um halter com as duas mãos, agarrando a cabeça do halter em vez da alça. Os braços devem estar estendidos e pendurados na altura da cintura. Esta é a posição inicial.
Eleve o peso até que fique acima do nível dos ombros, mantendo os braços estendidos. O tronco e os quadris devem permanecer imóveis durante o movimento.
Retorne à posição inicial e repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao com halter unico'),
  (md5('catalogo-exercicio:fedb:' || 'Natural_Glute_Ham_Raise')::uuid, 'Elevação de glúteos e isquiotibiais natural', 'Posterior', 'Peso corporal', 'PESO_CORPORAL', 'Use a almofada de pernas de uma máquina de pulley ou um banco de preacher. Posicione-se com os tornozelos sob as almofadas, joelhos no assento, e de costas para a máquina. Mantenha-se ereto com boa postura. Esta será a posição inicial.
Abaixe-se com controle até que os joelhos estejam quase totalmente estendidos.
Com controle, levante-se de volta à posição inicial.
Se não conseguir completar uma repetição, use uma faixa elástica, a ajuda de um parceiro ou empurre-se de uma caixa para auxiliar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de gluteos e isquiotibiais natural'),
  (md5('catalogo-exercicio:fedb:' || 'Shoulder_Raise')::uuid, 'Elevação de ombros', 'Ombros', null, 'OUTRO', 'Relaxe os braços ao lado do corpo e levante os ombros em direção às orelhas, depois abaixe-os.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de ombros'),
  (md5('catalogo-exercicio:fedb:' || 'Rocking_Standing_Calf_Raise')::uuid, 'Elevação de panturrilha em pé com balanço', 'Panturrilha', 'Barra', 'LIVRE', 'Posicione-se em pé com os pés na largura dos ombros e os dedos ligeiramente apontados para fora. Mantenha a cabeça erguida e as costas retas, com os joelhos levemente flexionados.
Eleve os calcanhares ao expirar, estendendo os tornozelos o mais alto possível e contraindo a panturrilha. Mantenha os joelhos estáticos.
Segure a posição contraída por um segundo e retorne lentamente à posição inicial ao inspirar, abaixando os calcanhares.
Agora, levante os dedos dos pés ao expirar, contraindo os músculos da tíbia na frente da panturrilha.
Segure por um segundo e retorne à posição inicial ao inspirar.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de panturrilha em pe com balanco'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Reverse_Calf_Raises')::uuid, 'Elevação de panturrilha invertida no smith', 'Panturrilha', 'Máquina', 'MAQUINA', 'Ajuste a barra na máquina Smith para sua altura e posicione uma plataforma elevada logo abaixo dela.
Fique em pé na plataforma com os calcanhares apoiados nela e a parte da frente dos pés estendida para fora. Posicione os dedos dos pés para frente, com os pés na largura dos ombros.
Coloque os ombros sob a barra, mantendo a posição dos pés, e empurre a barra para cima estendendo os quadris e joelhos até ficar ereto. Mantenha os joelhos levemente flexionados, nunca travados. Esta é a posição inicial. Dica: A barra nas costas é apenas para equilíbrio.
Eleve a parte da frente dos pés enquanto expira, estendendo os dedos o mais alto possível e contraindo a panturrilha. Mantenha os joelhos imóveis, sem dobrá-los. Segure a posição contraída por um segundo antes de voltar.
Volte lentamente à posição inicial enquanto inspira, abaixando a parte da frente dos pés e os dedos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de panturrilha invertida no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Leg_Lift')::uuid, 'Elevação de perna', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé, ereto, com os pés juntos na largura dos ombros. Segure uma superfície firme, como as laterais de um rack de agachamento ou o topo de uma cadeira, para se apoiar e manter o equilíbrio.
Com ou sem peso no tornozelo, levante uma perna para trás, como em um curl de perna, mas em pé, mantendo a outra perna estendida. Expire ao realizar o movimento.
Volte lentamente a perna elevada ao chão enquanto inspira.
Repita para a quantidade recomendada de repetições.
Repita o movimento com a perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de perna'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Leg_Raises')::uuid, 'Elevação de perna frontal', 'Posterior', 'Peso corporal', 'PESO_CORPORAL', 'Fique de pé ao lado de uma cadeira ou apoio, segurando com uma mão.
Balance a perna para frente, mantendo-a reta. Continue o movimento para baixo, levando a perna para trás o máximo que sua flexibilidade permitir. Repita 5 a 10 vezes e troque de perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de perna frontal'),
  (md5('catalogo-exercicio:fedb:' || 'Rear_Leg_Raises')::uuid, 'Elevação de perna traseira', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Posicione-se de quatro em uma esteira de exercícios. Sua cabeça deve estar olhando para frente e a flexão dos joelhos deve criar um ângulo de 90 graus entre os isquiotibiais e as panturrilhas. Esta será sua posição inicial.
Estenda uma perna para cima e para trás. O joelho e o quadril devem se estender. Repita por 5-10 repetições e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de perna traseira'),
  (md5('catalogo-exercicio:fedb:' || 'Hanging_Leg_Raise')::uuid, 'Elevação de pernas na barra fixa', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Pendure-se em uma barra de pull-up com os braços estendidos, usando pegada média ou larga. As pernas devem estar retas para baixo, com a pélvis levemente inclinada para trás. Esta é a posição inicial.
Levante as pernas até formar um ângulo de 90 graus com o tronco. Expire ao fazer o movimento e segure a contração por um segundo.
Volte lentamente à posição inicial inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de pernas na barra fixa'),
  (md5('catalogo-exercicio:fedb:' || 'Knee_Hip_Raise_On_Parallel_Bars')::uuid, 'Elevação de pernas nas paralelas', 'Abdômen', null, 'OUTRO', 'Posicione-se no aparelho com os antebraços apoiados e as pernas estendidas para baixo.
Eleve as pernas estendidas até ficarem paralelas ao chão, contraindo o abdômen.
Volte lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de pernas nas paralelas'),
  (md5('catalogo-exercicio:fedb:' || 'Flat_Bench_Lying_Leg_Raise')::uuid, 'Elevação de pernas no banco reto', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas em um banco plano com as pernas estendidas para fora.
Coloque as mãos sob os glúteos ou ao lado do corpo segurando o banco. Esta é a posição inicial.
Com as pernas estendidas e joelhos levemente flexionados, eleve-as até formar um ângulo de 90 graus com o chão, expirando. Segure a contração no topo por um segundo.
Inspire e abaixe as pernas lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de pernas no banco reto'),
  (md5('catalogo-exercicio:fedb:' || 'Hip_Lift_with_Band')::uuid, 'Elevação de quadril com elástico', 'Glúteos', 'Elástico', 'ELASTICO', 'Após escolher uma banda adequada, deite-se no centro do rack, com a banda presa em ambos os lados. Se o rack não tiver pinos, use halteres pesados para segurar a banda, garantindo que não se movam.
Ajuste-se para que a banda fique diretamente sobre os quadris. Dobre os joelhos e apoie os pés no chão. As mãos podem ficar no chão ou segurando a banda.
Com os ombros no chão, empurre com os calcanhares para levantar os quadris, pressionando contra a banda o mais alto possível.
Pause no topo do movimento e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de quadril com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Bent-Knee_Hip_Raise')::uuid, 'Elevação de quadril com joelhos flexionados', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão com os braços ao lado do corpo.
Flexione os joelhos em um ângulo de cerca de 75 graus e levante os pés do chão por aproximadamente 5 cm.
Use o abdômen inferior para trazer os joelhos em sua direção, mantendo o ângulo de 75 graus. Continue até levantar os quadris do chão, rolando a pélvis para trás. Expire durante essa fase. Dica: No final, os joelhos ficarão sobre o peito.
Contraia o abdômen no topo por um segundo e retorne lentamente à posição inicial, inspirando. Dica: Mantenha o movimento controlado.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de quadril com joelhos flexionados'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Hip_Raise')::uuid, 'Elevação de quadril no smith', 'Abdômen', 'Máquina', 'MAQUINA', 'Posicione um banco no rack e carregue a barra com o peso adequado. Deite-se no banco, apoiando a sola dos pés na barra. Desengate a barra e estenda as pernas. Use as mãos para ajudar, se necessário. Para mais estabilidade, segure as laterais do Smith Machine. Esta é a posição inicial.
Inicie o movimento girando a pelve e flexionando a coluna para elevar os quadris do banco. Mantenha os joelhos levemente flexionados.
Após uma pausa breve, retorne os quadris ao banco.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao de quadril no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Scaption')::uuid, 'Elevação em plano escapular com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Este exercício corretivo fortalece os músculos que estabilizam a escápula. Segure um peso leve em cada mão, com os braços estendidos ao lado do corpo e os polegares apontando para cima.
Levante os braços à frente do corpo, formando um ângulo de aproximadamente 30 graus em relação à linha central, mantendo-os totalmente estendidos.
Continue até que os braços fiquem paralelos ao chão e, em seguida, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao em plano escapular com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Dumbbell_Raise')::uuid, 'Elevação frontal alternada com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter em cada mão, fique em pé com o tronco reto e os halteres na frente das coxas, braços estendidos, palmas voltadas para as coxas. Esta é a posição inicial.
Mantendo o tronco imóvel, levante o halter esquerdo para a frente com o cotovelo levemente flexionado e palmas para baixo, até o braço ficar ligeiramente acima do paralelo. Expire e pause no topo.
Abaixe o halter esquerdo lentamente enquanto levanta o direito, alternando os movimentos.
Continue alternando até completar as repetições recomendadas para cada braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal alternada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Plate_Raise')::uuid, 'Elevação frontal com anilha', 'Ombros', null, 'OUTRO', 'Em pé, segure uma anilha com as mãos nas posições de 3 e 9 horas, palmas voltadas uma para a outra. Braços estendidos e ligeiramente flexionados nos cotovelos, com a anilha próxima à cintura. Esta é a posição inicial.
Levante a anilha lentamente enquanto expira, até ficar um pouco acima da altura dos ombros. Segure a contração por um segundo. Dica: Evite balançar o peso ou dobrar os cotovelos; mantenha o torso imóvel.
Abaixe a anilha lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal com anilha'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Front_Barbell_Raise_Over_Head')::uuid, 'Elevação frontal completa com barra', 'Ombros', 'Barra', 'LIVRE', 'Fique em pé segurando uma barra com as palmas voltadas para baixo e as mãos mais próximas que a largura dos ombros.
Mantenha os pés na largura dos ombros e os cotovelos levemente flexionados. Esta é a posição inicial.
Eleve a barra até acima da cabeça enquanto expira, mantendo os cotovelos levemente flexionados.
Ao sentir a contração, abaixe a barra de volta à posição inicial enquanto inspira.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal completa com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head')::uuid, 'Elevação frontal completa com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Segure os halteres na frente das coxas, com as palmas voltadas para as coxas.
Mantenha os braços retos com uma leve flexão nos cotovelos, travados. Esta é a posição inicial.
Levante os halteres em um movimento semicircular até a altura dos braços acima da cabeça, expirando.
Retorne lentamente à posição inicial pelo mesmo caminho, inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal completa com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Raise_And_Pullover')::uuid, 'Elevação frontal e pullover', 'Peito', 'Barra', 'LIVRE', 'Deite-se em um banco reto, segurando uma barra com as palmas para baixo e as mãos afastadas cerca de 40 cm.
Apoie a barra nas coxas, com os braços estendidos e cotovelos ligeiramente flexionados. Esta é a posição inicial.
Levante a barra em um movimento semicircular, mantendo os braços retos, enquanto inspira. Continue até a barra ficar acima da cabeça, com os braços paralelos ao chão e palmas para cima.
Retorne a barra à posição inicial revertendo o movimento enquanto expira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal e pullover'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Incline_Dumbbell_Raise')::uuid, 'Elevação frontal inclinada com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado entre 30 e 60 graus, segurando um halter em cada mão. Dica: Varie o ângulo para trabalhar o músculo de forma diferente.
Estenda os braços à frente, com as palmas voltadas para baixo e os halteres cerca de 2,5 cm acima das coxas. Esta é a posição inicial.
Levante os halteres lentamente até ficarem ligeiramente acima dos ombros, mantendo os cotovelos travados. Contraia no topo por um segundo e expire durante o movimento. Dica: Mantenha a cabeça apoiada no banco e os pés no chão.
Abaixe os braços de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal inclinada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Cable_Raise')::uuid, 'Elevação frontal na polia', 'Ombros', 'Polia', 'MAQUINA', 'Selecione o peso em uma máquina de pulley baixo e segure a alça com uma mão.
Fique de costas para o pulley, com o braço estendido para baixo e a alça na frente das coxas, palmas voltadas para as coxas. Esta é a posição inicial.
Mantendo o tronco imóvel, levante o braço para a frente com o cotovelo levemente flexionado e palmas para baixo, até o braço ficar ligeiramente acima do paralelo. Expire e pause no topo.
Inspire, abaixando o braço lentamente à posição inicial.
Após as repetições, troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Straight_Raises_on_Incline_Bench')::uuid, 'Elevação frontal no banco inclinado', 'Ombros', 'Barra', 'LIVRE', 'Coloque uma barra no chão atrás da cabeça de um banco inclinado.
Deite-se de bruços no banco. Com pegada pronada, levante a barra do chão, mantendo os braços estendidos. Deixe a barra pendurada. Esta é a posição inicial.
Eleve a barra à frente da cabeça, mantendo os braços estendidos.
Retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal no banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Two-Dumbbell_Raise')::uuid, 'Elevação frontal simultânea com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Segure dois halteres e fique em pé com o torso reto, os halteres na frente das coxas com os braços estendidos e palmas voltadas para as coxas. Esta é a posição inicial.
Mantendo o torso imóvel, levante os halteres para frente com os cotovelos ligeiramente flexionados e palmas para baixo, até os braços ficarem ligeiramente acima da paralela com o chão. Expire no movimento e pause no topo.
Abaixe os halteres lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao frontal simultanea com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Lateral_Raise_-_With_Bands')::uuid, 'Elevação lateral com elástico', 'Ombros', 'Elástico', 'ELASTICO', 'Para começar, fique em cima de uma banda elástica para que a tensão comece com os braços estendidos. Segure as alças com uma pegada pronada (palmas voltadas para as coxas) ligeiramente mais estreita que a largura dos ombros. As alças devem estar apoiadas nas laterais das suas coxas. Seus braços devem estar estendidos com uma ligeira flexão nos cotovelos e suas costas retas. Esta será sua posição inicial.
Use os ombros laterais para levantar as alças para os lados enquanto expira. Continue levantando até que as alças estejam ligeiramente acima da linha paralela. Dica: Ao levantar, incline levemente as mãos como se estivesse derramando água e mantenha os braços estendidos. Além disso, mantenha o tronco parado e faça uma pausa de um segundo no topo do movimento.
Abaixe as alças lentamente de volta à posição inicial. Inspire enquanto executa esta parte do movimento.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_One-Arm_Lateral_Raise')::uuid, 'Elevação lateral com halter deitado', 'Ombros', 'Halteres', 'LIVRE', 'Segurando um halter em uma mão, deite-se de bruços em um banco plano. Use a outra mão para segurar a perna do banco para estabilidade.
Posicione a palma da mão que segura o halter de forma neutra (voltada para o torso), com o braço estendido e o cotovelo ligeiramente flexionado. Esta será sua posição inicial.
Ao expirar, levante o braço com o halter para o lado até o cotovelo estar na altura do ombro e o braço aproximadamente paralelo ao chão. Dica: Mantenha o braço perpendicular ao torso e estendido; segure a contração no topo por um segundo.
Ao inspirar, abaixe lentamente o halter à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral com halter deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Raise')::uuid, 'Elevação lateral com halteres pronada', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e fique em pé com os braços estendidos ao lado do corpo, cotovelos levemente flexionados e costas retas. Os halteres devem ficar próximos às coxas, com as palmas das mãos voltadas para trás.
Expire e use os ombros para levantar os halteres para os lados, até eles ficarem próximos ao queixo, com os cotovelos conduzindo o movimento. Pause por um segundo no topo.
Inspire e abaixe os halteres lentamente até a posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral com halteres pronada'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Side_Laterals')::uuid, 'Elevação lateral com uma mão', 'Ombros', 'Halteres', 'LIVRE', 'Pegue um halter com uma mão. Use a outra mão para segurar algo estável, como um banco inclinado. Incline-se em direção ao braço que está levantando para manter o equilíbrio.
Fique com o tronco reto e o halter ao lado do corpo, com o braço estendido e a palma da mão voltada para você. Esta é sua posição inicial.
Mantendo o tronco parado (sem balançar), levante o halter para o lado com uma leve flexão no cotovelo e a mão levemente inclinada para frente, como se estivesse despejando água. Continue até o braço ficar paralelo ao chão. Expire ao executar o movimento e pause por um segundo no topo.
Abaixe o halter lentamente de volta à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral com uma mao'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Leg_Raises')::uuid, 'Elevação lateral de perna', 'Adutores', 'Peso corporal', 'PESO_CORPORAL', 'Fique ao lado de uma cadeira, que pode ser usada como apoio. Fique em uma perna. Esta é a posição inicial.
Mantendo a perna estendida, levante-a o máximo possível para o lado e balance-a de volta para baixo, cruzando-a levemente com a perna oposta.
Repita esse movimento de balanço 5 a 10 vezes, aumentando a amplitude conforme avança.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral de perna'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Incline_Lateral_Raise')::uuid, 'Elevação lateral inclinada unilateral', 'Ombros', 'Halteres', 'LIVRE', 'Deite-se de lado em um banco inclinado com um halter na mão superior. O ombro deve estar apoiado no banco e o braço estendido à frente, paralelo ao chão, com a palma voltada para o umbigo.
Segure o halter com o braço estendido à frente, paralelo ao chão. Esta é a posição inicial.
Realize uma elevação lateral, mantendo o halter paralelo ao chão, até o braço apontar para o teto. Expire ao levantar e segure a contração por um segundo.
Inspire ao abaixar o halter de volta à posição inicial.
Repita pelo número de repetições desejado.
Troque de braço e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral inclinada unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Low-Pulley_Deltoid_Raise')::uuid, 'Elevação lateral na polia baixa', 'Ombros', 'Polia', 'MAQUINA', 'Fique ao lado direito da polia baixa, segure a alça com a mão esquerda em pegada pronada e apoie-se com a mão direita.
Mantenha as costas retas e os pés na largura dos ombros. Esta é a posição inicial.
Eleve a alça com a mão esquerda até a altura do ombro enquanto expira.
Sinta a contração no topo e abaixe lentamente à posição inicial enquanto inspira.
Repita para o número recomendado de repetições e troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral na polia baixa'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Laterals_to_Front_Raise')::uuid, 'Elevação lateral para frontal', 'Ombros', 'Halteres', 'LIVRE', 'Em pé, segure um par de halteres ao lado do corpo. Esta é a posição inicial.
Mantendo os cotovelos levemente flexionados, levante os pesos diretamente à frente até a altura dos ombros, evitando balanços ou trapaças.
No topo do movimento, mova os pesos para a frente, mantendo os braços estendidos.
Abaixe os pesos com controle.
Na próxima repetição, levante os pesos à frente até a altura dos ombros antes de movê-los lateralmente para os lados.
Abaixe os pesos à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral para frontal'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Side_Lateral_Raise')::uuid, 'Elevação lateral sentada com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Pegue dois halteres e sente-se na ponta de um banco plano com os pés firmes no chão. Segure os halteres com as palmas viradas para dentro e os braços estendidos ao lado do corpo. Esta será a posição inicial.
Mantendo o tronco imóvel (sem balançar), levante os halteres para os lados com uma leve flexão nos cotovelos e as mãos ligeiramente inclinadas para frente, como se estivesse derramando água em um copo. Continue até os braços ficarem paralelos ao chão. Expire ao executar o movimento e pause por um segundo no topo.
Abaixe os halteres lentamente de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral sentada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Seated_Lateral_Raise')::uuid, 'Elevação lateral sentado na polia', 'Ombros', 'Polia', 'MAQUINA', 'Posicione-se entre duas polias baixas opostas, com um banco plano atrás de você (perpendicular). Selecione o peso em cada polia.
Sente-se na borda do banco, com os pés à frente dos joelhos.
Incline-se para frente mantendo as costas retas e apoie o torso nas coxas.
Peça para alguém entregar as alças. Segure a polia esquerda com a mão direita e a direita com a esquerda. Os cabos devem passar sob os joelhos, com os braços estendidos, palmas viradas uma para a outra e cotovelos levemente flexionados. Esta é a posição inicial.
Eleve os braços para os lados até ficarem paralelos ao chão e na altura dos ombros, mantendo os braços estacionários. Expire e segure a contração por um segundo.
Abaixe os braços lentamente à posição inicial, inspirando.
Repita pelo número recomendado de repetições. Dica: Mantenha a parte superior dos braços perpendicular ao torso e os cotovelos fixos (ângulo de 10 a 30 graus).', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao lateral sentado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Cable_Lift')::uuid, 'Elevação na polia em pé', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça padrão em uma torre e ajuste o cabo para a posição mais baixa.
De lado para o cabo, segure a alça com uma mão e afaste-se da torre. Fique a cerca de um braço de distância, com a tensão do peso no cabo. O braço estendido deve estar alinhado com o cabo.
Com os pés na largura dos ombros, agache e segure a alça com as duas mãos. Os braços devem permanecer totalmente estendidos.
Em um movimento, puxe a alça para cima e através do corpo até que os braços estejam totalmente estendidos acima da cabeça.
Mantenha as costas retas e os braços próximos ao corpo, girando o pé traseiro e endireitando as pernas para obter amplitude total.
Retraia os braços e depois o corpo. Volte à posição neutra de forma lenta e controlada.
Repita até a falha.
Em seguida, reposicione e repita a mesma série de movimentos no lado oposto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao na polia em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Hip_Thrust')::uuid, 'Elevação pélvica com barra', 'Glúteos', 'Barra', 'LIVRE', 'Sente-se no chão com um banco atrás de você. Coloque uma barra carregada sobre as pernas. Use uma barra mais grossa ou um apoio para reduzir o desconforto.
Role a barra até que fique diretamente sobre os quadris e incline-se no banco, apoiando as escápulas na parte superior.
Comece o movimento empurrando com os pés, elevando os quadris verticalmente. O peso deve ser suportado pelas escápulas e pés. Estenda o máximo possível e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao pelvica com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Rear_Delt_Raise')::uuid, 'Elevação posterior deitado', 'Ombros', 'Halteres', 'LIVRE', 'Segurando um halter em cada mão, deite-se com o peito para baixo em um banco plano.
Posicione as palmas das mãos de forma neutra (palmas voltadas para o torso) com os braços estendidos e os cotovelos levemente flexionados. Esta será sua posição inicial.
Eleve os braços para os lados até que os cotovelos estejam na altura dos ombros e os braços aproximadamente paralelos ao chão, expirando. Dica: Mantenha os braços perpendiculares ao torso e estendidos durante o movimento, e contraia por um segundo no topo.
Abaixe os halteres lentamente até a posição inicial, inspirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacao posterior deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Partials')::uuid, 'Elevações laterais parciais', 'Ombros', 'Halteres', 'LIVRE', 'Fique em pé com o tronco ereto, segurando um halter em cada mão com os braços estendidos ao lado do corpo.
As palmas devem estar voltadas para o tronco e os pés na largura dos ombros. Esta é a posição inicial.
Mantendo os braços retos e o tronco imóvel, levante os halteres lateralmente até a altura dos ombros, expirando.
Sinta a contração por um segundo e abaixe os halteres controladamente à posição inicial, inspirando. Dica: mantenha as palmas para baixo, com o dedo mínimo levemente mais alto, para focar nos ombros.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'elevacoes laterais parciais'),
  (md5('catalogo-exercicio:fedb:' || 'Heavy_Bag_Thrust')::uuid, 'Empurrão no saco pesado', 'Peito', null, 'OUTRO', 'Use um saco pesado para este exercício. Fique em pé ao lado do saco, com os pés afastados e escalonados. Coloque a mão no saco na altura do peito. Esta será a posição inicial.
Gire o tronco na cintura, empurrando o saco para frente com força máxima. Execute o movimento rapidamente, afastando o saco do corpo.
Receba o saco de volta ao balançar, revertendo os passos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'empurrao no saco pesado'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Shrug')::uuid, 'Encolhimento com barra', 'Trapézio', 'Barra', 'LIVRE', 'Fique em pé com os pés na largura dos ombros, segurando uma barra com as duas mãos na frente do corpo, com pegada pronada (palmas voltadas para as coxas). Dica: As mãos devem estar um pouco mais largas que os ombros; use straps para melhor aderência. Esta é a posição inicial.
Eleve os ombros o máximo possível, expirando e segurando a contração por um segundo. Dica: Não use os bíceps para levantar a barra.
Retorne lentamente à posição inicial inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Shrug')::uuid, 'Encolhimento com halteres', 'Trapézio', 'Halteres', 'LIVRE', 'Fique em pé com um halter em cada mão (palmas voltadas para o corpo), braços estendidos ao lado do corpo.
Eleve os ombros o mais alto possível, expirando. Segure a contração no topo por um segundo. Dica: Mantenha os braços estendidos; não use os bíceps. Apenas os ombros devem se mover.
Abaixe os halteres de volta à posição original.
Repita para o número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Middle_Back_Shrug')::uuid, 'Encolhimento escapular', 'Costas', 'Halteres', 'LIVRE', 'Deite-se de bruços em um banco inclinado, segurando um halter em cada mão. Seus braços devem estar totalmente estendidos para baixo, apontando para o chão. As palmas das mãos devem estar voltadas uma para a outra. Esta será sua posição inicial.
Ao expirar, aperte as escápulas juntas e mantenha a contração por um segundo completo. Dica: Este movimento é como o inverso de um abraço, ou tentar fazer elevações laterais posteriores como se não tivesse braços.
Ao inspirar, volte à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento escapular'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Incline_Shoulder_Raise')::uuid, 'Encolhimento inclinado com barra', 'Ombros', 'Barra', 'LIVRE', 'Deite-se em um banco inclinado. Com uma pegada ligeiramente mais larga que os ombros, levante a barra do suporte e segure-a acima de você com os braços retos. Esta é a posição inicial.
Mantendo os braços retos, levante a barra protraindo as escápulas, elevando os ombros do banco enquanto expira.
Retorne à posição inicial inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento inclinado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Incline_Shoulder_Raise')::uuid, 'Encolhimento inclinado com halteres', 'Ombros', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado segurando um halter em cada mão sobre as coxas.
Levante as pernas para impulsionar os pesos até os ombros e incline-se para trás. Posicione os halteres acima dos ombros com os braços estendidos. Os braços devem estar perpendiculares ao chão, com as palmas voltadas para frente e os nós dos dedos apontando para o teto. Esta será a posição inicial.
Mantendo os braços retos e travados, levante os halteres elevando os ombros do banco enquanto expira.
Volte os halteres à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento inclinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Incline_Shoulder_Raise')::uuid, 'Encolhimento inclinado no smith', 'Ombros', 'Barra', 'LIVRE', 'Posicione um banco inclinado sob o Smith machine. Ajuste a barra a uma altura que você possa alcançar deitado, com os braços quase totalmente estendidos. Após selecionar o peso, deite-se no banco inclinado e alinhe os ombros sob a barra.
Com uma pegada pronada (palmas para a frente) na largura dos ombros, levante a barra do suporte e segure-a reta acima de você, com os cotovelos levemente flexionados. Esta é a posição inicial.
Ao expirar, levante a barra até que os braços estejam totalmente estendidos. A contração deve ser sentida nos ombros.
Após uma pausa de um segundo, retorne a barra à posição inicial enquanto inspira.
Repita o movimento pelo número de repetições prescrito.
Ao terminar, recoloque a barra no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento inclinado no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Shrug')::uuid, 'Encolhimento na máquina articulada', 'Trapézio', 'Máquina', 'MAQUINA', 'Carregue os pinos com um peso adequado. Posicione-se diretamente entre as alças.
Segure as alças superiores com uma pegada confortável e abaixe os quadris enquanto inspira. Olhe para frente com a cabeça erguida e mantenha o peito para cima.
Empurre o chão com os calcanhares, estendendo os quadris e joelhos até ficar em pé. Mantenha os braços retos durante o movimento, terminando com os ombros para trás. Esta será a posição inicial.
Levante o peso encolhendo os ombros em direção às orelhas, movendo-se reto para cima e para baixo.
Faça uma pausa no topo do movimento e retorne o peso à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Calf-Machine_Shoulder_Shrug')::uuid, 'Encolhimento na máquina de panturrilha', 'Trapézio', 'Máquina', 'MAQUINA', 'Posicione-se na máquina de panturrilha com as almofadas acima dos ombros. Torso reto e braços estendidos ao lado do corpo. Esta é a posição inicial.
Eleve os ombros em direção às orelhas enquanto expira e segure a contração por um segundo.
Retorne lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento na maquina de panturrilha'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Shrugs')::uuid, 'Encolhimento na polia', 'Trapézio', 'Polia', 'MAQUINA', 'Segure uma barra de cabo acoplada a uma polia baixa com uma pegada pronada (palmas para baixo) na largura dos ombros ou um pouco mais larga.
Fique em pé, ereto, perto da polia, com os braços estendidos à frente segurando a barra. Esta é a posição inicial.
Levante a barra elevando os ombros o mais alto possível enquanto expira. Mantenha a contração no topo por um segundo. Dica: Mantenha os braços estendidos; evite usar os bíceps. Apenas os ombros devem se mover.
Abaixe a barra de volta à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_Shrug')::uuid, 'Encolhimento para clean', 'Trapézio', 'Barra', 'LIVRE', 'Segure a barra na altura das coxas com pegada na largura dos ombros. Costas retas e levemente inclinadas para frente.
Encolha os ombros em direção às orelhas. Evite sobrecarregar para não reduzir a velocidade do movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento para clean'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch_Shrug')::uuid, 'Encolhimento pegada snatch', 'Trapézio', 'Barra', 'LIVRE', 'Comece com a barra na altura das coxas, segurando com pegada larga (pode ser hook ou sobreposta). Mantenha as costas retas e levemente inclinadas para frente.
Encolha os ombros em direção às orelhas. Evite sobrecarregar com peso excessivo que atrase a execução.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento pegada snatch'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Shrug_Behind_The_Back')::uuid, 'Encolhimento por trás com barra', 'Trapézio', 'Barra', 'LIVRE', 'Fique em pé, com os pés na largura dos ombros, segurando uma barra com ambas as mãos atrás das costas, usando uma pegada pronada (palmas voltadas para trás). Dica: As mãos devem estar um pouco mais afastadas que a largura dos ombros. Você pode usar straps para melhor aderência. Esta será a posição inicial.
Levante os ombros o mais alto possível enquanto expira e mantenha a contração por um segundo. Dica: Evite levantar a barra usando os bíceps. Os braços devem permanecer estendidos o tempo todo.
Retorne lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento por tras com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Behind_the_Back_Shrug')::uuid, 'Encolhimento por trás no smith', 'Trapézio', 'Máquina', 'MAQUINA', 'Com a barra na altura das coxas, carregue um peso adequado.
Fique em pé com a barra atrás de você, segurando-a com uma pegada pronada na largura dos ombros e solte o peso. Mantenha-se ereto, com a cabeça e o peito erguidos e os braços estendidos. Esta é a posição inicial.
Inicie o movimento encolhendo os ombros diretamente para cima. Não flexione os braços ou pulsos durante o movimento.
Após uma breve pausa, retorne o peso à posição inicial.
Repita pelo número desejado de repetições antes de engatar os ganchos para recolocar o peso.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'encolhimento por tras no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Rack_Delivery')::uuid, 'Entrega no suporte', 'Ombros', 'Barra', 'LIVRE', 'Este exercício ensina a entrega da barra para a posição de suporte nos ombros. Comece segurando uma barra na posição de espantalho, com os braços superiores paralelos ao chão e os antebraços pendurados. Use uma pegada de gancho, com os dedos envoltos sobre os polegares.
Comece girando os cotovelos ao redor da barra, entregando a barra aos ombros. Conforme os cotovelos vão para frente, relaxe a pegada. Os ombros devem estar protraídos, fornecendo uma prateleira para a barra, que deve tocar levemente a garganta.
É importante que a barra permaneça próxima ao corpo o tempo todo, pois com uma carga maior, qualquer distância resultará em uma colisão indesejada. Conforme o movimento se torna mais suave, a velocidade e a carga podem ser aumentadas antes de progredir.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'entrega no suporte'),
  (md5('catalogo-exercicio:fedb:' || 'Stairmaster')::uuid, 'Escada ergométrica', 'Cardio', 'Máquina', 'CARDIO', 'Para começar, suba na escada ergométrica e selecione a opção desejada no menu. Você pode escolher um modo manual ou um programa. Normalmente, é possível inserir idade e peso para estimar as calorias queimadas.
Bombeie as pernas para cima e para baixo em um ritmo constante, pressionando os pedais mas não até o chão. É recomendável segurar as alças para não cair. As alças podem monitorar a frequência cardíaca para ajudar a manter a intensidade adequada.
A escada ergométrica oferece conveniência, benefícios cardiovasculares e geralmente tem menos impacto do que correr ao ar livre. É tipicamente mais intensa que outros equipamentos cardiovasculares. Uma pessoa de 68 kg queima cerca de 300 calorias em 30 minutos, comparado a aproximadamente 175 calorias caminhando.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'escada ergometrica'),
  (md5('catalogo-exercicio:fedb:' || 'Rope_Climb')::uuid, 'Escalada de corda', 'Costas', null, 'OUTRO', 'Segure a corda com as duas mãos acima da cabeça. Puxe a corda para baixo enquanto dá um pequeno salto.
Enrole a corda em uma perna, usando os pés para prender a corda. Alcance o mais alto possível com os braços, segurando firmemente.
Solte a corda dos pés enquanto puxa o corpo para cima com os braços, trazendo os joelhos em direção ao peito.
Reposicione os pés na corda e fique em pé para segurar mais alto. Continue até o topo.
Para descer, afrouxe o aperto dos pés e deslize para baixo com as mãos alternadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'escalada de corda'),
  (md5('catalogo-exercicio:fedb:' || 'Chain_Handle_Extension')::uuid, 'Extensão com alças e correntes', 'Tríceps', null, 'OUTRO', 'Você precisará de duas alças de cabo, um banco reto e correntes para este exercício. Prenda o meio das correntes às alças e posicione-se no banco reto. Os cotovelos devem estar apontando para cima.
Comece estendendo os cotovelos, mantendo a parte superior dos braços imóvel e os punhos pronados.
Pause na extensão completa e inverta o movimento para retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'extensao com alcas e correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Face_Up_Plate_Neck_Resistance')::uuid, 'Extensão de pescoço com anilha deitado', 'Pescoço', null, 'OUTRO', 'Deite-se de costas com o corpo reto em um banco plano, segurando uma anilha em cima da testa. Dica: Posicione-se para que os ombros fiquem ligeiramente acima da extremidade do banco, de modo que os trapézios, pescoço e cabeça fiquem fora do banco. Esta será sua posição inicial.
Mantendo a anilha segura na testa, abaixe lentamente a cabeça para trás em um movimento semicircular enquanto inspira.
Levante a cabeça de volta à posição inicial em um movimento semicircular enquanto expira. Mantenha a contração por um segundo.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'extensao de pescoco com anilha deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Hip_Extension_with_Bands')::uuid, 'Extensão de quadril com elástico', 'Glúteos', 'Elástico', 'ELASTICO', 'Prenda uma extremidade da banda em um poste baixo e a outra no tornozelo.
Fique de frente para o ponto de fixação da banda e segure o poste para se estabilizar.
Com a cabeça e o peito erguidos, mova a perna resistida para trás o máximo possível, mantendo o joelho estendido.
Retorne a perna à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'extensao de quadril com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Towel_Triceps_Extension')::uuid, 'Extensão de tríceps com toalha em pé', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com os braços totalmente estendidos acima da cabeça, segurando uma extremidade de uma toalha com as duas mãos. Os cotovelos devem estar próximos à cabeça e os braços perpendiculares ao chão, com as palmas voltadas uma para a outra. Os pés devem estar afastados na largura dos ombros. Esta é a posição inicial.
Comunique-se com seu parceiro para que ele segure a outra extremidade da toalha e aplique resistência. Mantenha os braços superiores próximos à cabeça e perpendiculares ao chão, abaixe a resistência em um movimento semicircular atrás da cabeça até os antebraços tocarem os bíceps. Dica: Apenas os antebraços devem se mover. Inspire ao executar este passo.
Volte à posição inicial usando o tríceps para levantar a toalha. Expire ao executar este passo.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'extensao de triceps com toalha em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Sled_Overhead_Triceps_Extension')::uuid, 'Extensão de tríceps por cima com trenó', 'Tríceps', null, 'OUTRO', 'Acople duas alças a um trenó usando uma corrente ou corda. Carregue o trenó com um peso adequado.
Fique de costas para o trenó e afaste-se até sentir tensão na corda. Levante as mãos acima da cabeça, mantendo-as juntas e as palmas voltadas uma para a outra. Os cotovelos devem estar apontados para cima e flexionados. Esta é a posição inicial.
Estenda os cotovelos para endireitar os braços. Certifique-se de que a parte superior dos braços permaneça fixa para isolar o tríceps.
Após a extensão completa, dê um passo à frente para eliminar a folga na corda. Você pode manter os pés escalonados para maior estabilidade.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'extensao de triceps por cima com treno'),
  (md5('catalogo-exercicio:fedb:' || 'Suspended_Fallout')::uuid, 'Fallout suspenso', 'Abdômen', null, 'OUTRO', 'Ajuste as alças das tiras para uma altura adequada, abaixo da cintura.
Fique em pé e segure as alças. Incline-se nas tiras, assumindo uma posição de flexão inclinada. Esta é a posição inicial.
Mantendo os braços retos, incline-se mais nas tiras, aproximando o corpo do chão, permitindo que os ombros se estendam e os braços subam acima da cabeça.
Mantenha a coluna neutra e o corpo reto, movendo apenas os ombros.
Faça uma pausa no pico da contração e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'fallout suspenso'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Figure_8')::uuid, 'Figura 8 com kettlebell', 'Abdômen', 'Kettlebell', 'LIVRE', 'Coloque um kettlebell entre as pernas com uma postura mais larga que os ombros. Incline-se para frente, empinando o bumbum e mantendo as costas retas.
Pegue o kettlebell e passe-o para a outra mão entre as pernas, com a mão receptora vindo por trás das pernas. Repita o movimento de vai e vem por várias repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'figura 8 com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Push-Up_Wide')::uuid, 'Flexão com apoio ampla', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Com as mãos bem afastadas, apoie o corpo na ponta dos pés e nas mãos em posição de prancha. Mantenha os cotovelos estendidos e o corpo reto, sem deixar os quadris caírem. Esta é a posição inicial.
Inspire e flexione os cotovelos, abaixando o peito em direção ao chão.
Use os músculos peitorais para empurrar o corpo de volta à posição inicial, estendendo os cotovelos. Expire durante esse movimento.
Após uma pausa na posição contraída, repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao com apoio ampla'),
  (md5('catalogo-exercicio:fedb:' || 'Push-Ups_-_Close_Triceps_Position')::uuid, 'Flexão com apoio fechada para tríceps', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão e posicione as mãos mais próximas que a largura dos ombros. Mantenha o torso elevado com os braços estendidos.
Inspire e abaixe-se até o peito quase tocar o chão.
Use os tríceps e parte dos peitorais para empurrar o corpo de volta à posição inicial, contraindo o peito. Expire ao fazer isso.
Após uma pausa de um segundo na posição contraída, repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao com apoio fechada para triceps'),
  (md5('catalogo-exercicio:fedb:' || 'Push-Ups_With_Feet_Elevated')::uuid, 'Flexão com pés elevados', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão com as mãos afastadas cerca de 90 cm e o torso sustentado pelos braços estendidos.
Apoie a ponta dos pés em um banco plano para elevar o corpo. Observação: quanto mais alto o banco, maior a resistência.
Inspire e abaixe-se até o peito quase tocar o chão.
Use os músculos peitorais para empurrar o corpo de volta à posição inicial, contraindo o peito. Expire durante o movimento.
Após uma pausa na posição contraída, repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao com pes elevados'),
  (md5('catalogo-exercicio:fedb:' || 'Push-Ups_With_Feet_On_An_Exercise_Ball')::uuid, 'Flexão com pés em bola de exercício', 'Peito', 'Bola suíça', 'OUTRO', 'Deite-se de bruços no chão com as mãos afastadas cerca de 90 cm e o torso sustentado pelos braços estendidos.
Apoie a ponta dos pés em uma bola de exercício para elevar o corpo.
Inspire e abaixe-se até o peito quase tocar o chão.
Use os músculos peitorais para empurrar o corpo de volta à posição inicial, contraindo o peito. Expire durante o movimento.
Após uma pausa na posição contraída, repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao com pes em bola de exercicio'),
  (md5('catalogo-exercicio:fedb:' || 'Drop_Push')::uuid, 'Flexão com queda', 'Peito', null, 'OUTRO', 'Posicione caixas baixas ou plataformas a cerca de 60-90 cm de distância.
Coloque-se em posição de flexão entre elas, com as mãos apoiadas nas caixas.
Com postura correta, empurre para cima e solte das plataformas, movendo as mãos para a largura dos ombros e amortecendo a queda com os braços.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao com queda'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Push-Up')::uuid, 'Flexão de braço declinada', 'Peito', null, 'OUTRO', 'Deite-se de bruços no chão, com as mãos afastadas a cerca de 90 cm e o torso apoiado nos braços. Coloque os pés em uma caixa ou banco. Esta é a posição inicial.
Abaixe o corpo até o peito quase tocar o chão, inspirando.
Expire e empurre o torso de volta à posição inicial, contraindo o peitoral.
Após uma pausa breve no topo, abaixe novamente para as repetições necessárias.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco declinada'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_Push-Up_off_of_a_Dumbbell')::uuid, 'Flexão de braço fechada no halter', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão e coloque as mãos em um halter na vertical. Apoie o peso na ponta dos pés e nas mãos, mantendo o torso rígido e os cotovelos para dentro, com os braços retos. Esta será sua posição inicial.
Abaixe o corpo, flexionando os cotovelos enquanto inspira. Mantenha o corpo reto, sem deixar os quadris subirem ou caírem.
Empurre-se de volta à posição inicial estendendo os cotovelos. Expire ao executar esta etapa.
Após uma pausa na posição contraída, repita o movimento pelo número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco fechada no halter'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up')::uuid, 'Flexão de braço inclinada no banco', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para um banco ou plataforma elevada. Coloque as mãos na borda, ligeiramente mais afastadas que a largura dos ombros.
Posicione os pés afastados do banco, com braços e corpo retos. Os braços devem estar perpendiculares ao corpo. Mantenha o corpo reto e abaixe o peito até a borda dobrando os braços.
Empurre o corpo para cima até estender os braços. Repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco inclinada no banco'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up_Close-Grip')::uuid, 'Flexão de braço inclinada pegada fechada', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para a barra de um Smith machine ou plataforma elevada na altura adequada.
Coloque as mãos próximas uma da outra na barra.
Posicione os pés afastados da barra, com braços e corpo retos. Esta é a posição inicial.
Mantendo o corpo reto, abaixe o peito até a barra dobrando os braços.
Volte à posição inicial estendendo os cotovelos, empurrando-se para cima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco inclinada pegada fechada'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up_Medium')::uuid, 'Flexão de braço inclinada pegada média', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para a barra de um Smith machine ou plataforma elevada na altura adequada.
Coloque as mãos na barra com afastamento igual à largura dos ombros.
Posicione os pés afastados da barra, com braços e corpo retos. Esta é a posição inicial.
Mantendo o corpo reto, abaixe o peito até a barra dobrando os braços.
Volte à posição inicial estendendo os cotovelos, empurrando-se para cima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco inclinada pegada media'),
  (md5('catalogo-exercicio:fedb:' || 'Suspended_Push-Up')::uuid, 'Flexão de braço no TRX', 'Peito', null, 'OUTRO', 'Prenda as tiras de suspensão firmemente no topo de um rack ou outro objeto.
Incline-se nas tiras, segure cada alça e entre na posição de prancha para flexão. Fique o mais próximo possível do paralelo ao chão, com os braços totalmente estendidos e postura correta.
Mantendo o torso reto e rígido, desça lentamente flexionando os cotovelos.
Continue até os cotovelos ultrapassarem 90 graus, faça uma pausa e estenda para voltar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco no trx'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Arm_Push-Up')::uuid, 'Flexão de braço unilateral', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços e apoie-se na ponta dos pés e em um braço, com a mão alinhada ao ombro e braço estendido. Afaste os pés para maior estabilidade.
Mantenha a postura correta e coloque a outra mão nas costas. Esta é a posição inicial.
Abaixe-se flexionando o cotovelo até tocar o chão.
Volte à posição inicial estendendo o braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de braco unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Prone_Manual_Hamstring')::uuid, 'Flexão de pernas com resistência manual', 'Posterior', null, 'OUTRO', 'Necessita de um parceiro. Deite-se de bruços com as pernas estendidas. O parceiro colocará a mão no seu calcanhar.
Flexione o joelho para curvar a perna para cima. O parceiro aplica resistência, começando leve e aumentando. Comunique-se para ajustar a resistência.
Pause no topo e retorne à posição inicial com resistência na descida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de pernas com resistencia manual'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Band_Hamstring_Curl')::uuid, 'Flexão de pernas sentado com elástico', 'Posterior', null, 'OUTRO', 'Prenda uma banda elástica perto do chão e coloque um banco a alguns passos de distância.
Sente-se no banco e fixe a banda atrás dos tornozelos, com as pernas estendidas. Esta é a posição inicial.
Flexione os joelhos, trazendo os pés em direção ao banco. Incline o tronco levemente para trás, se necessário, para evitar que os pés toquem o chão.
Segure no final do movimento e retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de pernas sentado com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Face_Down_Plate_Neck_Resistance')::uuid, 'Flexão de pescoço com anilha deitado', 'Pescoço', null, 'OUTRO', 'Deite-se de bruços com o corpo reto em um banco plano, segurando uma anilha atrás da cabeça. Dica: Posicione-se para que os ombros fiquem ligeiramente acima da extremidade do banco, de modo que o peito superior, pescoço e rosto fiquem fora do banco. Esta será sua posição inicial.
Mantendo a anilha segura atrás da cabeça, abaixe lentamente a cabeça (como em um movimento de ''sim'') enquanto inspira.
Levante a cabeça de volta à posição inicial em um movimento semicircular enquanto expira. Mantenha a contração por um segundo.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de pescoco com anilha deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Hip_Flexion_with_Band')::uuid, 'Flexão de quadril com elástico', 'Quadríceps', 'Elástico', 'ELASTICO', 'Prenda uma extremidade da banda em um poste baixo e a outra no tornozelo.
Fique de costas para o ponto de fixação da banda.
Com a cabeça e o peito erguidos, levante o joelho até 90 graus e pause.
Retorne a perna à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao de quadril com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Clock_Push-Up')::uuid, 'Flexão em relógio', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão, apoiado nas mãos e pontas dos pés. Braços estendidos, mãos na largura dos ombros. Corpo reto. Posição inicial.
Flexione os cotovelos para baixar o peito em direção ao chão.
No fundo, empurre para cima rapidamente até "pular" 30-45 cm para um lado.
Ao saltar, afaste o pé externo e gire o corpo cerca de 30 graus.
Volte à posição inicial e repita, girando gradualmente até completar um círculo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao em relogio'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up_Reverse_Grip')::uuid, 'Flexão inclinada com pegada invertida', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para a barra de um Smith machine ou uma plataforma elevada firme na altura adequada.
Coloque as mãos na barra com as palmas para cima, afastadas na largura dos ombros.
Posicione os pés atrás da barra, com os braços e o corpo retos. Esta será a posição inicial.
Mantendo o corpo reto, abaixe o peito em direção à barra flexionando os braços.
Retorne à posição inicial estendendo os cotovelos, empurrando o corpo para cima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao inclinada com pegada invertida'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up_Wide')::uuid, 'Flexão inclinada com pegada larga', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para a barra de um Smith machine ou uma plataforma elevada firme na altura adequada.
Coloque as mãos na barra, mais afastadas que a largura dos ombros.
Posicione os pés atrás da barra, com os braços e o corpo retos. Os braços devem estar perpendiculares ao corpo. Esta será a posição inicial.
Mantendo o corpo reto, abaixe o peito em direção à barra flexionando os braços.
Retorne à posição inicial estendendo os cotovelos, empurrando o corpo para cima.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao inclinada com pegada larga'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Side_Bend')::uuid, 'Flexão lateral de tronco com barra', 'Abdômen', 'Barra', 'LIVRE', 'Fique em pé, segurando uma barra apoiada nas costas dos ombros (ligeiramente abaixo do pescoço). Os pés devem estar na largura dos ombros. Esta será a posição inicial.
Mantendo as costas retas e a cabeça erguida, incline apenas a cintura para a direita o máximo possível. Inspire enquanto se inclina para o lado. Segure por um segundo e retorne à posição inicial enquanto expira. Dica: Mantenha o resto do corpo imóvel.
Agora repita o movimento, mas inclinando para a esquerda. Segure por um segundo e retorne à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao lateral de tronco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Side_Bend')::uuid, 'Flexão lateral de tronco com halteres', 'Abdômen', 'Halteres', 'LIVRE', 'Fique em pé segurando um halter na mão esquerda (palma voltada para o corpo) e a mão direita na cintura, com os pés na largura dos ombros. Esta é sua posição inicial.
Mantendo as costas retas e a cabeça erguida, incline-se apenas na cintura para a direita o máximo possível, inspirando. Segure por um segundo e retorne à posição inicial expirando. Dica: Mantenha o resto do corpo imóvel.
Repita o movimento inclinando-se para a esquerda. Segure e retorne.
Repita para o número de repetições recomendado e depois troque de mãos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao lateral de tronco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_High-Pulley_Cable_Side_Bends')::uuid, 'Flexão lateral na polia alta unilateral', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça à torre de cabo na posição mais alta da polia.
Fique de lado para o cabo. Segure a alça com uma mão em pegada pronada.
Puxe o cabo para baixo até o cotovelo tocar o lado e a alça ficar próximo ao ombro.
Posicione os pés na largura do quadril. Coloque a mão livre no quadril para referência.
Mantenha o braço estático. Contraia o oblíquo para flexionar o tronco lateralmente, levando o peso para baixo.
Ao atingir a contração máxima, retorne lentamente à posição inicial. Mantenha tensão constante.
Repita até a falha.
Troque de lado e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao lateral na polia alta unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Handstand_Push-Ups')::uuid, 'Flexão na parada de mão (HSPU)', 'Ombros', 'Peso corporal', 'PESO_CORPORAL', 'De costas para a parede, incline-se na cintura e coloque as duas mãos no chão na largura dos ombros.
Dê um impulso com as pernas para ficar de cabeça para baixo contra a parede, com os braços e pernas totalmente estendidos. Mantenha o corpo o mais reto possível. Dica: Se for a primeira vez, peça ajuda a um parceiro. Olhe para a parede, não para baixo.
Inspirando, abaixe-se lentamente até a cabeça quase tocar o chão. Dica: Desça devagar para evitar lesões na cabeça.
Expirando, empurre-se de volta até os cotovelos quase travarem.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao na parada de mao (hspu)'),
  (md5('catalogo-exercicio:fedb:' || 'Push_Up_to_Side_Plank')::uuid, 'Flexão para prancha lateral', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Posicione-se em flexão de braço, com as mãos levemente além da largura dos ombros e apoiado na ponta dos pés.
Faça uma flexão, flexionando os cotovelos e mantendo o corpo reto ao descer.
Ao subir, transfira o peso para o lado esquerdo, gire o corpo e eleve o braço direito em direção ao teto, formando uma prancha lateral.
Volte o braço ao chão para outra flexão e repita para o outro lado.
Alternando os lados, repita a série por 10 ou mais repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao para prancha lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Plyo_Push-up')::uuid, 'Flexão plyométrica', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Posicione-se de bruços no chão, apoiando o peso nas mãos e nas pontas dos pés.
Os braços devem estar totalmente estendidos, com as mãos na largura dos ombros. Mantenha o corpo reto. Esta é a posição inicial.
Abaixe-se flexionando os cotovelos, aproximando o peito do chão.
No ponto mais baixo, inverta o movimento empurrando-se para cima com extensão rápida dos cotovelos, tentando levantar as mãos do chão.
Volte à posição inicial e repita o exercício.
Para maior dificuldade, adicione palmas no ar durante a fase de impulso.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexao plyometrica'),
  (md5('catalogo-exercicio:fedb:' || 'Pushups_Close_and_Wide_Hand_Positions')::uuid, 'Flexões (posições de mãos fechada e ampla)', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão com o corpo reto, pés no chão e mãos mais afastadas que os ombros (posição ampla) ou mais próximas (posição fechada). Mantenha o torso elevado com os braços estendidos.
Inspire e abaixe-se até o peito quase tocar o chão.
Use os músculos peitorais para empurrar o corpo de volta à posição inicial, contraindo o peito. Expire ao fazer isso.
Após uma pausa na posição contraída, repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexoes (posicoes de maos fechada e ampla)'),
  (md5('catalogo-exercicio:fedb:' || 'Plyo_Kettlebell_Pushups')::uuid, 'Flexões plyométricas com kettlebell', 'Peito', 'Kettlebell', 'LIVRE', 'Coloque um kettlebell no chão. Posicione-se em uma flexão de braço, apoiado nas pontas dos pés, com uma mão no chão e a outra segurando o kettlebell, com os cotovelos estendidos. Esta é a posição inicial.
Comece abaixando o corpo o máximo possível, mantendo as costas retas.
Rápida e forcefulmente, inverta a direção, empurrando-se para cima e para o outro lado do kettlebell, trocando as mãos no processo. Continue o movimento descendo e repetindo de um lado para o outro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexoes plyometricas com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Ball_Leg_Curl')::uuid, 'Flexora na bola suíça', 'Posterior', 'Bola suíça', 'OUTRO', 'Deite-se de costas no chão com os pés apoiados em cima de uma bola.
Posicione a bola para que, com as pernas estendidas, os tornozelos fiquem sobre ela. Esta é a posição inicial.
Levante os quadris do chão, mantendo o peso nos ombros e nos pés.
Flexione os joelhos, puxando a bola para perto de você, contraindo os isquiotibiais.
Após uma pausa breve, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'flexora na bola suica'),
  (md5('catalogo-exercicio:fedb:' || 'Extended_Range_One-Arm_Kettlebell_Floor_Press')::uuid, 'Floor press unilateral com kettlebell', 'Peito', 'Kettlebell', 'LIVRE', 'Deite-se no chão e posicione um kettlebell para pressionar com um braço. Segure o kettlebell pela alça. A perna do mesmo lado do braço que está pressionando deve estar flexionada, com o joelho cruzando a linha média do corpo.
Pressione o kettlebell estendendo o cotovelo e aduzindo o braço, elevando-o acima do corpo. Retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'floor press unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Plate_Twist')::uuid, 'Giro com peso', 'Abdômen', null, 'OUTRO', 'Deite-se no chão ou em um colchonete com as pernas estendidas e o tronco ereto. Segure o peso pelas laterais com as duas mãos à frente do abdômen, com os braços levemente flexionados.
Cruze as pernas lentamente pelos tornozelos e levante-as do chão. Os joelhos devem ficar levemente flexionados. Dica: incline o tronco levemente para trás para manter o equilíbrio durante o exercício. Esta é a posição inicial.
Mova o peso para o lado esquerdo e toque o chão com ele. Expire ao realizar esse movimento.
Volte à posição inicial inspirando e repita o movimento, desta vez para o lado direito do corpo. Dica: use um movimento lento e controlado sempre. Movimentos bruscos podem lesionar as costas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'giro com peso'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Judo_Flip')::uuid, 'Giro de judô na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Prenda uma corda na polia na posição mais baixa. Fique de lado para a polia com postura ampla e segure a corda com as duas mãos.
Gire o corpo para longe da polia, levando a corda sobre o ombro como em um golpe de judô.
Transfira o peso entre os pés enquanto gira e flexiona o tronco, puxando o cabo para baixo.
Retorne à posição inicial e repita até a falha.
Reposicione e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'giro de judo na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Glute_Kickback')::uuid, 'Glute kickback', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Ajoelhe-se no chão ou em um colchonete e incline o tronco para a frente, com os braços estendidos à sua frente (perpendiculares ao torso), para ficar em uma posição de flexão de braços ajoelhada, mas com os braços na largura dos ombros. Mantenha a cabeça olhando para a frente e os joelhos dobrados em um ângulo de 90 graus entre os isquiotibiais e as panturrilhas. Esta será sua posição inicial.
Ao expirar, levante a perna direita até que os isquiotibiais fiquem alinhados com as costas, mantendo o ângulo de 90 graus. Contraia os glúteos durante o movimento e segure a contração no topo por um segundo. Dica: No final do movimento, a coxa deve ficar paralela ao chão e a panturrilha perpendicular a ele.
Volte à posição inicial enquanto inspira e repita com a perna esquerda.
Continue alternando as pernas até completar as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'glute kickback'),
  (md5('catalogo-exercicio:fedb:' || 'Glute_Ham_Raise')::uuid, 'Glute-ham raise', 'Posterior', 'Máquina', 'MAQUINA', 'Ajuste o equipamento ao seu corpo. Deite-se de bruços com os pés apoiados na plataforma entre os rolos, joelhos logo atrás da almofada.
Comece da parte inferior, mantendo as costas arqueadas. Flexione os joelhos, empurrando os dedos contra a plataforma, até o corpo ficar ereto.
Retorne à posição inicial com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'glute-ham raise'),
  (md5('catalogo-exercicio:fedb:' || 'Floor_Glute-Ham_Raise')::uuid, 'Glute-ham raise no chão', 'Posterior', null, 'OUTRO', 'Ajoelhe-se no chão com o tronco ereto. Peça a um parceiro para segurar seus pés ou encaixe-os sob algo estável. Esta é a posição inicial.
Estenda os joelhos para baixar o corpo, sem flexionar os quadris, até as mãos tocarem o chão.
Use as mãos para ajudar a voltar à posição inicial, se necessário.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'glute-ham raise no chao');

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, instrucoes, fonte, nome_busca) values
  (md5('catalogo-exercicio:fedb:' || 'One-Legged_Cable_Kickback')::uuid, 'Glúteo na polia unilateral', 'Glúteos', 'Polia', 'MAQUINA', 'Prenda uma tornozeira de couro a uma polia baixa e fixe-a ao seu tornozelo.
Fique de frente para a pilha de pesos, a cerca de 60 cm de distância, segurando a estrutura de aço para apoio.
Mantendo os joelhos e quadris levemente flexionados e o abdômen contraído, contraia os glúteos para "chutar" a perna ativa para trás em um arco semicircular, o mais alto possível, enquanto expira. Dica: Na extensão total, contraia os glúteos por um segundo para uma contração máxima.
Traga a perna ativa lentamente para frente, resistindo à tração do cabo até voltar à posição inicial.
Repita pelo número recomendado de repetições.
Troque de perna e repita o movimento para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'gluteo na polia unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Sledgehammer_Swings')::uuid, 'Golpes de marreta', 'Abdômen', null, 'OUTRO', 'Você precisará de um pneu e uma marreta para este exercício. Fique em frente ao pneu, a cerca de 60 cm de distância, com uma postura escalonada. Segure a marreta.
Se você é destro, a mão esquerda deve ficar na base do cabo e a mão direita mais próxima da cabeça da marreta.
Ao levantar a marreta, a mão direita desliza em direção à cabeça; ao golpear para baixo, a mão direita desliza para se juntar à esquerda. Bata com força no pneu. Controle o ricochete da marreta no pneu.
Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'golpes de marreta'),
  (md5('catalogo-exercicio:fedb:' || 'Good_Morning')::uuid, 'Good morning com barra', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra em um rack na altura dos ombros. Posicione a barra atrás dos ombros, como em um agachamento powerlift, não em cima dos ombros. Mantenha as costas firmes, as escápulas aproximadas e os joelhos levemente flexionados. Afaste-se do rack.
Inicie flexionando os quadris, movendo-os para trás enquanto se inclina até quase o paralelo. Mantenha as costas arqueadas e a coluna cervical alinhada.
Inverta o movimento estendendo os quadris com os glúteos e isquiotibiais. Continue até retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'good morning com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Stiff_Leg_Barbell_Good_Morning')::uuid, 'Good morning com pernas estendidas', 'Costas', 'Barra', 'LIVRE', 'Posicione a barra em um rack de agachamento na altura adequada. Coloque a barra nas costas, logo abaixo do pescoço, e segure-a com as duas mãos.
Levante a barra do rack, empurrando com as pernas e endireitando o tronco. Afaste-se do rack com as pernas na largura dos ombros, cabeça erguida e costas retas. Esta é a posição inicial.
Mantendo as pernas fixas, incline o tronco para a frente flexionando os quadris, inspirando, até ficar paralelo ao chão.
Retorne o tronco à posição inicial, expirando, elevando a barra.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'good morning com pernas estendidas'),
  (md5('catalogo-exercicio:fedb:' || 'Good_Morning_off_Pins')::uuid, 'Good morning nos pinos', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra em um rack na altura do estômago. Incline-se sob a barra e posicione-a atrás dos ombros, como em um agachamento powerlift. Na altura correta, você deve ficar quase paralelo ao chão quando inclinado. Mantenha as costas firmes, as escápulas aproximadas e os joelhos levemente flexionados. Mantenha as costas arqueadas e a coluna cervical alinhada.
Inicie o movimento estendendo os quadris com os glúteos e isquiotibiais, ficando em pé com o peso. Lentamente, abaixe o peso de volta aos pinos, retornando à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'good morning nos pinos'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Good_Mornings')::uuid, 'Good morning sentado com barra', 'Costas', 'Barra', 'LIVRE', 'Posicione uma caixa em um power rack, com os pinos na altura adequada. Comece passando por baixo da barra e apoiando-a nas costas dos ombros, não sobre os trapézios. Aproxime as escápulas e gire os cotovelos para frente, tentando dobrar a barra sobre os ombros.
Retire a barra do rack, mantendo uma leve arqueada na lombar. Mantenha a cabeça erguida. Com as costas, ombros e core tensionados, empurre os joelhos e o quadril para fora e inicie a descida. Sente-se para trás com os quadris até ficar sentado na caixa. Esta será a posição inicial.
Mantendo a barra firme, incline-se para frente a partir dos quadris o máximo possível. Se os pinos estiverem na altura do paralelo, isso serve como segurança e indica quando parar.
Pause logo acima dos pinos e reverta o movimento até o torso ficar ereto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'good morning sentado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Groiners')::uuid, 'Groiners', 'Adutores', 'Peso corporal', 'PESO_CORPORAL', 'Comece em uma posição de flexão de braços no chão. Esta será sua posição inicial.
Usando ambas as pernas, pule para a frente, aterrissando com os pés próximos às mãos. Mantenha a cabeça erguida ao fazer isso.
Volte à posição inicial e repita imediatamente o movimento, continuando por 10 a 20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'groiners'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Hack_Squat')::uuid, 'Hack com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Fique em pé segurando uma barra atrás de você com os braços estendidos e os pés na largura dos ombros. Dica: Segure a barra com as palmas voltadas para trás e use straps de pulso para melhor aderência. Esta é a posição inicial.
Mantendo a cabeça erguida, olhos para frente e costas retas, agache até as coxas ficarem paralelas ao chão. Inspire enquanto desce lentamente.
Empurre principalmente com os calcanhares e contraia as coxas para retornar à posição inicial, expirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hack com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Hang_Clean_-_Below_the_Knees')::uuid, 'Hang clean abaixo dos joelhos', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com a barra logo abaixo dos joelhos, segurando com pegada pronada ou de gancho na largura dos ombros. As costas devem estar retas e levemente inclinadas para frente.
Estenda agressivamente os quadris, joelhos e tornozelos, elevando a barra. Ao atingir a extensão total, encolha os ombros e flexione os braços com os cotovelos altos e para fora.
No pico da extensão, puxe-se para baixo rapidamente, girando os cotovelos sob a barra. Receba a barra na posição de agachamento frontal, com a barra apoiada nos ombros e levemente tocando o pescoço. Desça até o agachamento completo para ajudar na recuperação.
Recupere a posição empurrando pelos calcanhares, mantendo o tronco ereto e os cotovelos altos. Continue até ficar em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang clean abaixo dos joelhos'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Kettlebell_Alternating_Hang_Clean')::uuid, 'Hang clean alternado com kettlebells', 'Posterior', 'Kettlebell', 'LIVRE', 'Posicione duas kettlebells entre os pés. Para iniciar, empine o bumbum e olhe para frente.
Faça um clean com uma kettlebell até o ombro, segurando a outra kettlebell.
Com um movimento fluido, abaixe a kettlebell superior enquanto eleva a inferior.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang clean alternado com kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Bottoms-Up_Clean_From_The_Hang_Position')::uuid, 'Hang clean bottoms-up com kettlebell', 'Antebraço', 'Kettlebell', 'LIVRE', 'Inicie em pé, segurando um kettlebell com a base para cima em uma mão.
Balance o kettlebell para trás com força e reverta o movimento, levantando-o até o ombro enquanto aperta o cabo com força.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang clean bottoms-up com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Hang_Clean')::uuid, 'Hang clean com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com a barra na altura das coxas, segurando com pegada pronada ou de gancho na largura dos ombros. As costas devem estar retas e levemente inclinadas para frente.
Estenda agressivamente os quadris, joelhos e tornozelos, elevando a barra. Ao fazer isso, encolha os ombros em direção às orelhas.
Imediatamente, recupere a posição empurrando pelos calcanhares, mantendo o tronco ereto e os cotovelos altos. Continue até ficar em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang clean com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Hang_Snatch_-_Below_Knees')::uuid, 'Hang snatch abaixo dos joelhos', 'Posterior', 'Barra', 'LIVRE', 'Segure a barra com pegada larga, pronada ou de gancho. Os pés devem estar abaixo dos quadris, levemente voltados para fora. Joelhos levemente flexionados, tronco inclinado para frente, coluna estendida e cabeça erguida. A barra deve estar logo abaixo dos joelhos. Esta é a posição inicial.
Estenda agressivamente as pernas e quadris. No pico, encolha os ombros e flexione os cotovelos para os lados.
Ao mover os pés para a posição de recepção, puxe-se para baixo com força enquanto eleva a barra acima da cabeça. Receba a barra com o corpo o mais baixo possível e os braços totalmente estendidos.
Volte à posição em pé com a barra sobre a cabeça e, em seguida, baixe a barra com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang snatch abaixo dos joelhos'),
  (md5('catalogo-exercicio:fedb:' || 'Hang_Snatch')::uuid, 'Hang snatch com barra', 'Posterior', 'Barra', 'LIVRE', 'Segure a barra com pegada larga, pronada ou de gancho. Os pés devem estar abaixo dos quadris, levemente voltados para fora. Joelhos levemente flexionados, tronco inclinado para frente, coluna estendida e cabeça erguida. A barra deve estar na altura dos quadris. Esta é a posição inicial.
Estenda agressivamente as pernas e quadris. No pico, encolha os ombros e flexione os cotovelos para os lados.
Ao mover os pés para a posição de recepção, puxe-se para baixo com força enquanto eleva a barra acima da cabeça. Receba a barra com o corpo o mais baixo possível e os braços totalmente estendidos.
Volte à posição em pé com a barra sobre a cabeça e, em seguida, baixe a barra com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hang snatch com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Ball_Hyperextension')::uuid, 'Hiperextensão com bola e peso', 'Costas', 'Bola suíça', 'OUTRO', 'Deite-se sobre uma bola de exercícios com o torso pressionado contra ela e paralelo ao chão. Apoie a ponta dos pés no chão para equilíbrio. Segure um peso sob o queixo ou atrás do pescoço.
Levante o torso lentamente, dobrando a cintura e a região lombar. Expire durante o movimento.
Segure a contração por um segundo e abaixe o torso à posição inicial, inspirando.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hiperextensao com bola e peso'),
  (md5('catalogo-exercicio:fedb:' || 'Hyperextensions_Back_Extensions')::uuid, 'Hiperextensões (extensões lombares)', 'Costas', null, 'OUTRO', 'Deite-se de bruços em um banco de hiperextensão, prendendo os tornozelos firmemente sob as almofadas dos pés.
Ajuste a almofada superior, se possível, para que as coxas superiores fiquem planas sobre a almofada larga, deixando espaço suficiente para dobrar na cintura sem restrições.
Com o corpo reto, cruze os braços na frente do peito (minha preferência) ou atrás da cabeça. Esta será a posição inicial. Dica: Você também pode segurar um peso extra na frente, sob os braços cruzados, para mais resistência.
Comece a inclinar-se lentamente para frente na cintura o máximo possível, mantendo as costas retas. Inspire ao realizar este movimento. Continue até sentir um alongamento nos isquiotibiais e não consiga ir mais sem arredondar as costas. Dica: Nunca arredonde as costas durante o exercício. Vá até onde seu corpo permitir sem arredondar.
Levante lentamente o tronco de volta à posição inicial enquanto expira. Dica: Evite arquear as costas além da linha reta e não balance o tronco para proteger a coluna.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hiperextensoes (extensoes lombares)'),
  (md5('catalogo-exercicio:fedb:' || 'Hyperextensions_With_No_Hyperextension_Bench')::uuid, 'Hiperextensões sem banco de hiperextensão', 'Costas', 'Peso corporal', 'PESO_CORPORAL', 'Com alguém segurando suas pernas, deslize-se para a borda de um banco plano até que os quadris fiquem suspensos no final do banco. Dica: Todo o tronco deve estar pendurado em direção ao chão. O movimento será mais curto devido à altura do banco.
Com o corpo reto, cruze os braços na frente do peito ou atrás da cabeça. Esta será a posição inicial. Dica: Você pode segurar um peso extra para mais resistência.
Incline-se lentamente para frente na cintura o máximo possível, mantendo as costas retas. Inspire ao fazer isso. Continue até quase tocar o chão ou sentir um alongamento nos isquiotibiais. Dica: Nunca arredonde as costas.
Levante lentamente o tronco de volta à posição inicial enquanto expira. Dica: Evite arquear as costas além da linha reta e não balance o tronco.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'hiperextensoes sem banco de hiperextensao'),
  (md5('catalogo-exercicio:fedb:' || 'Single_Leg_Push-off')::uuid, 'Impulso unilateral', 'Quadríceps', null, 'OUTRO', 'Fique em pé no chão com um pé apoiado em um caixote, calcanhar próximo à borda.
Empurre com o pé em cima do caixote, tentando ganhar a maior altura possível estendendo o quadril e o joelho.
Aterrisse com o mesmo pé em cima do caixote, retornando o outro pé à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'impulso unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Ball_Side_Bend')::uuid, 'Inclinação lateral com bola e peso', 'Abdômen', 'Bola suíça', 'OUTRO', 'Deite-se sobre uma bola de exercícios com o lado esquerdo do torso pressionado contra ela. Cruze as pernas e apoie os pés no chão.
Segure um peso com a mão direita ao lado da cabeça. Coloque o braço esquerdo sobre o torso com a mão nos oblíquos.
Levante o lado do torso flexionando lateralmente a cintura, expirando.
Segure por um segundo e abaixe lentamente, inspirando.
Repita para o número de repetições prescrito e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'inclinacao lateral com bola e peso'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Pelvic_Tilt')::uuid, 'Inclinação pélvica em pé', 'Costas', null, 'OUTRO', 'Fique em pé com os pés afastados na largura dos quadris.
Dobre levemente os joelhos para mantê-los flexíveis.
Você pode mover a pélvis para frente e para trás algumas vezes antes de segurar o cóccix para frente neste alongamento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'inclinacao pelvica em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Pelvic_Tilt_Into_Bridge')::uuid, 'Inclinação pélvica para ponte', 'Costas', null, 'OUTRO', 'Deite-se com os pés no chão, calcanhares sob os joelhos.
Levante apenas o cóccix para alongar a lombar, contraindo o abdômen.
Para fazer a ponte, levante toda a coluna, exceto o pescoço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'inclinacao pelvica para ponte'),
  (md5('catalogo-exercicio:fedb:' || 'Dead_Bug')::uuid, 'Inseto morto', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas com as mãos estendidas para cima em direção ao teto.
Levante os pés, joelhos e quadris até formar um ângulo de 90 graus.
Exale com força para baixar a caixa torácica e apoiar as costas no chão, girando a pélvis para cima e contraindo os glúteos. Mantenha essa posição durante o exercício. Esta é a posição inicial.
Estenda uma perna, endireitando o joelho e o quadril até a perna ficar logo acima do chão.
Mantenha a posição lombar e pélvica, evitando arquear as costas.
Mantenha-se firme e retorne a perna à posição inicial.
Repita do outro lado, alternando até completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'inseto morto'),
  (md5('catalogo-exercicio:fedb:' || 'Iron_Cross')::uuid, 'Iron cross', 'Ombros', 'Halteres', 'LIVRE', null, 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'iron cross'),
  (md5('catalogo-exercicio:fedb:' || 'Iron_Crosses_stretch')::uuid, 'Iron crosses (alongamento)', 'Quadríceps', null, 'OUTRO', 'Deite-se de bruços no chão, com os braços estendidos para os lados e as palmas das mãos pressionadas no chão. Esta será a posição inicial.
Para começar, flexione um joelho e traga essa perna por trás do corpo, tentando tocá-la no chão perto da mão oposta.
Retorne rapidamente a perna à posição inicial e repita com a outra perna. Continue alternando por 10-20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'iron crosses (alongamento)'),
  (md5('catalogo-exercicio:fedb:' || 'Isometric_Neck_Exercise_-_Front_And_Back')::uuid, 'Isométrico de pescoço - frente e costas', 'Pescoço', 'Peso corporal', 'PESO_CORPORAL', 'Com a cabeça e o pescoço em posição neutra (cabeça ereta voltada para frente), coloque as duas mãos na parte frontal da cabeça.
Empurre suavemente para frente enquanto contrai os músculos do pescoço, mas resistindo a qualquer movimento da cabeça. Comece com tensão lenta e aumente gradualmente. Respire normalmente durante a contração.
Mantenha a posição pelo número recomendado de segundos.
Libere a tensão lentamente.
Descanse pelo tempo recomendado e repita com as mãos na parte de trás da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'isometrico de pescoco - frente e costas'),
  (md5('catalogo-exercicio:fedb:' || 'Isometric_Neck_Exercise_-_Sides')::uuid, 'Isométrico de pescoço - laterais', 'Pescoço', 'Peso corporal', 'PESO_CORPORAL', 'Com a cabeça e o pescoço em posição neutra (cabeça ereta voltada para frente), coloque a mão esquerda no lado esquerdo da cabeça.
Empurre suavemente para a esquerda enquanto contrai os músculos do lado esquerdo do pescoço, mas resistindo a qualquer movimento da cabeça. Comece com tensão lenta e aumente gradualmente. Respire normalmente durante a contração.
Mantenha a posição pelo número recomendado de segundos.
Libere a tensão lentamente.
Descanse pelo tempo recomendado e repita com a mão direita no lado direito da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'isometrico de pescoco - laterais'),
  (md5('catalogo-exercicio:fedb:' || 'Isometric_Wipers')::uuid, 'Isométrico limpador de para-brisa', 'Peito', 'Peso corporal', 'PESO_CORPORAL', 'Fique na posição de flexão, apoiando o peso nas mãos e nos dedos dos pés, com o corpo reto. As mãos devem estar ligeiramente além da largura dos ombros. Esta é a posição inicial.
Desloque o peso do corpo o máximo possível para um lado, flexionando o cotovelo desse lado ao abaixar o corpo.
Inverta o movimento estendendo o braço flexionado, empurrando para cima e depois descendo para o outro lado.
Repita pelo número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'isometrico limpador de para-brisa'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Jerk')::uuid, 'Jerk com divisão', 'Quadríceps', 'Barra', 'LIVRE', 'Em pé com o peso apoiado na frente dos ombros, comece com o mergulho. Com os pés diretamente sob os quadris, flexione os joelhos sem mover os quadris para trás.
Desça apenas ligeiramente e inverta a direção com força máxima. Empurre pelos calcanhares para criar velocidade e força, e afaste a cabeça quando a barra sair dos ombros. Nesse momento, coloque os pés na posição de recepção o mais rápido possível.
No breve instante em que os pés não estão empurrando, o esforço para levantar a barra fará com que você desça. Os pés devem ficar em postura dividida, um à frente e outro atrás, com os joelhos parcialmente flexionados. Receba a barra com os braços travados acima da cabeça.
Volte à posição em pé, juntando os pés.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk com divisao'),
  (md5('catalogo-exercicio:fedb:' || 'Two-Arm_Kettlebell_Jerk')::uuid, 'Jerk com dois kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Faça um clean com dois kettlebells até os ombros, girando os pulsos para que as palmas fiquem voltadas para frente.
Agache levemente e, em um movimento rápido, empurre os kettlebells acima da cabeça. Após o impulso, agache novamente para se posicionar sob os pesos.
Com os kettlebells travados, levante-se para completar o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk com dois kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Kettlebell_Jerk')::uuid, 'Jerk com duas kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure uma kettlebell em cada mão pelo cabo.
Faça um clean das kettlebells até os ombros, estendendo pernas e quadris e girando os pulsos para as palmas ficarem voltadas para frente. Esta é a posição inicial.
Flexione os joelhos em um agachamento curto, mantendo o tronco ereto.
Reverta rapidamente o movimento, impulsionando-se com os calcanhares como em um salto.
Use o impulso para pressionar as kettlebells sobre a cabeça até a extensão total dos braços.
Aterrisse com os pés em posição de afundo (um à frente e outro atrás).
Mantendo os pesos sobre a cabeça, retorne à posição em pé, juntando os pés. Abaixe as kettlebells para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk com duas kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Split_Jerk')::uuid, 'Jerk em afundo com kettlebell de um braço', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure o kettlebell pela alça e leve-o ao ombro com um movimento de arranco, estendendo as pernas e quadris enquanto puxa o peso em direção ao ombro. Gire o pulso para que a palma da mão fique virada para frente. Esta é a posição inicial.
Flexione os joelhos para abaixar o corpo, mantendo o tronco ereto.
Imediatamente inverta o movimento, empurrando pelos calcanhares como em um salto para gerar impulso. Ao fazer isso, pressione o kettlebell acima da cabeça até estender os braços.
Receba o peso acima da cabeça descendo para uma posição de afundo, com uma perna à frente e a outra atrás.
Mantendo o peso acima da cabeça, retorne à posição em pé e junte os pés. Abaixe o peso para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk em afundo com kettlebell de um braco'),
  (md5('catalogo-exercicio:fedb:' || 'Squat_Jerk')::uuid, 'Jerk em agachamento', 'Quadríceps', 'Barra', 'LIVRE', 'Com o peso apoiado na frente dos ombros, inicie com um mergulho. Com os pés diretamente sob os quadris, flexione os joelhos sem mover os quadris para trás. Desça levemente e inverta a direção com força máxima. Empurre pelos calcanhares para gerar velocidade e força, e afaste a cabeça conforme a barra sai dos ombros.
Nesse momento, ao levantar os pés do chão, coloque-os rapidamente na posição de recepção. Receba a barra com o corpo em um agachamento completo e os braços totalmente estendidos acima da cabeça.
Mantendo a barra alinhada sobre os calcanhares, com a cabeça e o peito erguidos, empurre pelos calcanhares para levantar-se. Retorne o peso ao chão com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk em agachamento'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Jerk')::uuid, 'Jerk unilateral com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure um kettlebell pela alça e faça o clean até o ombro, com a palma para frente. Esta é a posição inicial.
Flexione os joelhos rapidamente, mantendo o tronco ereto.
Inverta o movimento, impulsionando-se com os calcanhares para pressionar o kettlebell sobre a cabeça até a extensão total, recebendo o peso agachando-se ligeiramente. Retorne à posição em pé com o peso alto.
Abaixe o peso para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jerk unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'JM_Press')::uuid, 'JM press com barra', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se em um banco plano segurando uma barra com os braços totalmente estendidos e os cotovelos para dentro. A barra deve estar alinhada acima do peito. Esta é a posição inicial.
Abaixe a barra como em uma extensão de tríceps, inspirando. Na metade do movimento, mova os braços superiores em direção às pernas até ficarem perpendiculares ao torso, fazendo a barra rolar cerca de 2,5 cm para trás. Mantenha a flexão dos cotovelo constante.
Expire e pressione a barra de volta usando os tríceps, como em um supino fechado.
Volte à posição inicial e repita.
Execute o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'jm press com barra'),
  (md5('catalogo-exercicio:fedb:' || 'One_Knee_To_Chest')::uuid, 'Joelho ao peito unilateral', 'Glúteos', null, 'OUTRO', 'Deite-se de costas no chão.
Estenda uma perna e puxe o outro joelho em direção ao peito, segurando abaixo da articulação para proteger o joelho.
Puxe suavemente o joelho em direção ao nariz.
Troque de lado. Isso alonga os glúteos e a lombar da perna dobrada e o flexor do quadril da perna estendida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'joelho ao peito unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Knee_Across_The_Body')::uuid, 'Joelho cruzado no corpo', 'Glúteos', null, 'OUTRO', 'Deite no chão com a perna direita estendida. Dobre a perna esquerda e cruze sobre o corpo, segurando o joelho com a mão direita para alongar.
Relaxe e sinta o alongamento na lombar, depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'joelho cruzado no corpo'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Open_Palm_Kettlebell_Clean')::uuid, 'Kettlebell clean com uma mão e palma aberta', 'Posterior', 'Kettlebell', 'LIVRE', 'Posicione um kettlebell entre seus pés.
Segure a alça com uma mão e levante o kettlebell rapidamente, deixando-o girar para que a bola do kettlebell aterrisse na palma da sua mão.
Arremesse o kettlebell para frente e segure a alça com uma mão.
Leve o kettlebell de volta ao chão e repita. Certifique-se de trabalhar ambos os braços.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'kettlebell clean com uma mao e palma aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Spell_Caster')::uuid, 'Lançador de feitiço', 'Abdômen', 'Halteres', 'LIVRE', 'Segure um halter em cada mão com uma pegada pronada. Os pés devem estar afastados, com quadris e joelhos estendidos. Esta será a posição inicial.
Inicie o movimento puxando ambos os halteres para um lado, próximo ao quadril, girando o tronco.
Mantendo os braços retos e os halteres paralelos ao chão, gire o tronco para balançar os pesos para o lado oposto.
Continue alternando, girando de um lado para o outro até completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'lancador de feitico'),
  (md5('catalogo-exercicio:fedb:' || 'Landmine_180s')::uuid, 'Landmine 180''s', 'Abdômen', 'Barra', 'LIVRE', 'Posicione uma barra em um landmine ou ancore-a com segurança em um canto. Carregue a barra com um peso apropriado.
Levante a barra do chão, levando-a até a altura dos ombros com as duas mãos e os braços estendidos à sua frente. Adote uma postura ampla. Esta será sua posição inicial.
Execute o movimento girando o tronco e os quadris enquanto balança o peso totalmente para um lado. Mantenha os braços estendidos durante todo o exercício.
Inverta o movimento para balançar o peso totalmente para o lado oposto.
Continue alternando o movimento até completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'landmine 180''s'),
  (md5('catalogo-exercicio:fedb:' || 'Landmine_Linear_Jammer')::uuid, 'Landmine linear jammer', 'Ombros', 'Barra', 'LIVRE', 'Posicione uma barra em um landmine ou, na falta dele, ancore-a com segurança em um canto. Carregue a barra com um peso apropriado e coloque o acessório de pegada na barra.
Levante a barra do chão, levando as alças até os ombros. Esta será sua posição inicial.
Em uma postura atlética, agache flexionando os quadris e recuando os glúteos, mantendo os braços flexionados.
Inverta o movimento estendendo poderosamente os quadris, joelhos e tornozelos, enquanto também estende os cotovelos para endireitar os braços. Este movimento deve ser feito de forma explosiva, saindo do agachamento para a extensão total o mais forte possível.
Retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'landmine linear jammer'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Leg_Press')::uuid, 'Leg press no smith', 'Quadríceps', 'Máquina', 'MAQUINA', 'Posicione a barra do Smith Machine a alguns centímetros do chão, apoiada nas travas. Após carregar o peso adequado, deite-se sob a barra. Coloque a parte média dos pés na barra, com os joelhos próximos ao peito. Esta é a posição inicial.
Inicie o movimento empurrando com os pés para levantar a barra, estendendo quadris e joelhos. Não trave os joelhos.
No topo do movimento, faça uma pausa breve antes de retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'leg press no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Narrow_Stance_Leg_Press')::uuid, 'Leg press pés juntos', 'Quadríceps', 'Máquina', 'MAQUINA', 'Sente-se na máquina de leg press e coloque as pernas na plataforma com uma postura mais fechada que a largura dos ombros, dedos dos pés ligeiramente apontados para fora. Os pés devem estar cerca de 7 cm ou menos de distância. Dica: Mantenha a cabeça erguida e as costas apoiadas no encosto.
Abaixe as travas de segurança e empurre a plataforma até que as pernas estejam totalmente estendidas à sua frente. Dica: Não trave os joelhos. O torso e as pernas devem formar um ângulo de 90 graus. Esta será a posição inicial.
Inspire e abaixe lentamente a plataforma até que as coxas e as panturrilhas formem um ângulo de 90 graus.
Empurre principalmente com os calcanhares, usando os quadríceps, para voltar à posição inicial enquanto expira.
Repita para o número recomendado de repetições e trave as travas de segurança ao terminar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'leg press pes juntos'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Arm_Linear_Jammer')::uuid, 'Levantamento com barra em landmine unilateral', 'Ombros', 'Barra', 'LIVRE', 'Posicione uma barra em um landmine ou canto seguro e adicione peso.
Levante a barra do chão até os ombros com uma ou duas mãos e adote uma postura ampla. Esta é a posição inicial.
Estenda o cotovelo explosivamente para empurrar o peso para cima, usando os quadris e joelhos para gerar força máxima.
Volte à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento com barra em landmine unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Deadlift')::uuid, 'Levantamento terra com barra', 'Costas', 'Barra', 'LIVRE', 'Fique em frente a uma barra carregada.
Mantendo as costas o mais retas possível, dobre os joelhos, incline-se para frente e segure a barra com uma pegada média (largura dos ombros) com as palmas para baixo. Esta será sua posição inicial.
Segurando a barra, inicie o levantamento empurrando com as pernas e erguendo o tronco até a posição vertical enquanto expira. Na posição vertical, estufe o peito e contraia as costas, trazendo as escápulas para trás.
Volte à posição inicial dobrando os joelhos e inclinando o tronco para frente, mantendo as costas retas. Quando os pesos tocarem o chão, você estará pronto para outra repetição.
Execute o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Trap_Bar_Deadlift')::uuid, 'Levantamento terra com barra hexagonal', 'Quadríceps', null, 'OUTRO', 'Carregue uma barra hexagonal com o peso adequado no chão. Fique no centro do aparelho e segure as duas alças.
Abaixe os quadris, olhe para frente com a cabeça erguida e mantenha o peito para cima.
Inicie o movimento empurrando com os calcanhares e estenda os quadris e joelhos. Evite arredondar as costas durante todo o exercício.
Ao final do movimento, abaixe o peso de volta ao chão com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com barra hexagonal'),
  (md5('catalogo-exercicio:fedb:' || 'Deadlift_with_Chains')::uuid, 'Levantamento terra com correntes', 'Costas', 'Barra', 'LIVRE', 'Prenda as correntes nas extremidades da barra ou simplesmente pendure-as no meio para aumentar o peso progressivamente.
Posicione-se com a barra centralizada sobre os pés, que devem estar na largura dos quadris. Incline-se para a frente para segurar a barra na largura dos ombros, com as escápulas afastadas. Use uma pegada pronada ou mista para cargas pesadas. Inspire, abaixe os quadris e flexione os joelhos até as canelas tocarem a barra.
Olhe para frente, mantenha o peito erguido e as costas arqueadas, e empurre com os calcanhares para levantar o peso. Após a barra passar os joelhos, puxe a barra para trás com força, juntando as escápulas enquanto empurra os quadris para frente.
Abaixe a barra flexionando os quadris e guiando-a até o chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Deficit_Deadlift')::uuid, 'Levantamento terra com déficit', 'Costas', 'Barra', 'LIVRE', 'Fique em cima de uma plataforma ou anilhas de 2,5 a 7,5 cm de altura. Posicione os pés na largura do quadril, com a barra centralizada. Incline-se no quadril para agarrar a barra na largura dos ombros, com as escápulas protraídas. Use pegada pronada ou mista para cargas pesadas.
Com os pés e pegada firmes, inspire, abaixe os quadris e dobre os joelhos até as canelas tocarem a barra. Mantenha o peito para cima, costas arqueadas e olhe para frente. Empurre com os calcanhares para levantar o peso; após passar os joelhos, puxe a barra para trás, juntando as escápulas e levando os quadris para frente.
Abaixe a barra flexionando os quadris e guiando-a ao chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com deficit'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Band_Deadlift')::uuid, 'Levantamento terra com elástico reversa', 'Costas', 'Barra', 'LIVRE', 'Ajuste a barra em um rack de potência. Prenda as bandas na parte superior do rack, usando pinos ou a estrutura. Conecte a outra extremidade à barra.
Posicione-se com a barra centralizada sobre os pés, que devem estar na largura dos quadris. Incline-se nos quadris para segurar a barra na largura dos ombros, com as escápulas afastadas. Use pegada pronada ou mista para cargas mais pesadas.
Com os pés e a pegada firmes, inspire e abaixe os quadris, dobrando os joelhos até as canelas tocarem a barra. Olhe para frente, peito para cima e costas arqueadas. Empurre pelos calcanhares para levantar o peso.
Após a barra passar os joelhos, puxe-a para trás com força, juntando as escápulas e empurrando os quadris para frente.
Abaixe a barra flexionando os quadris e controlando a descida até o chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com elastico reversa'),
  (md5('catalogo-exercicio:fedb:' || 'Deadlift_with_Bands')::uuid, 'Levantamento terra com elásticos', 'Costas', 'Barra', 'LIVRE', 'Para usar elásticos curtos, passe-os pela barra antes de começar e pise neles para se posicionar. Para elásticos longos, fixe-os em uma base segura, como halteres pesados ou um rack.
Com os pés e a pegada definidos, inspire profundamente, abaixe os quadris e flexione os joelhos até as canelas tocarem a barra. Olhe para frente, mantenha o peito erguido e as costas arqueadas, e empurre com os calcanhares para levantar o peso. Após a barra passar os joelhos, puxe a barra para trás com força, juntando as escápulas enquanto empurra os quadris para frente.
Abaixe a barra flexionando os quadris e guiando-a até o chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Side_Deadlift')::uuid, 'Levantamento terra lateral com uma mão', 'Quadríceps', 'Barra', 'LIVRE', 'Fique ao lado de uma barra, próximo ao centro. Dobre os joelhos e abaixe o corpo até conseguir alcançar a barra.
Segure a barra como se estivesse pegando uma pasta (palmas voltadas para você, pois a barra está de lado). Use uma munhequeira se necessário. Esta é sua posição inicial.
Use as pernas para ajudar a levantar a barra enquanto expira. Os braços devem estender completamente até você ficar em pé.
Abaixe a barra lentamente enquanto inspira. Dica: Dobre os joelhos ao abaixar o peso para evitar lesões.
Repita pelo número recomendado de repetições.
Troque de braço e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra lateral com uma mao'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Deadlift')::uuid, 'Levantamento terra na máquina articulada', 'Quadríceps', 'Máquina', 'MAQUINA', 'Posicione-se entre as alças, segure-as com uma pegada confortável e abaixe os quadris, mantendo o peito erguido e olhando para frente. Esta é a posição inicial.
Estenda os quadris e joelhos para levantar o peso, mantendo as costas retas.
Volte o peso à posição inicial com controle.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Deadlifts')::uuid, 'Levantamento terra na polia', 'Quadríceps', 'Polia', 'MAQUINA', 'Ajuste os cabos para a parte baixa das torres e selecione o peso. Fique entre as torres.
Agache-se flexionando quadris e joelhos até alcançar as alças.
Segure as alças e levante-se, estendendo quadris e joelhos, mantendo os braços estendidos e o peito erguido.
Ao ficar em pé, retorne à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_Deadlift')::uuid, 'Levantamento terra para clean', 'Posterior', 'Barra', 'LIVRE', 'Fique em pé com a barra perto das canelas. Pés sob os quadris, ligeiramente voltados para fora. Segure a barra com pegada dupla pronada ou hook, na largura dos ombros. Agache até a barra, com costas retas e ombros à frente da barra.
Empurre o chão pelos calcanhares, mantendo o ângulo das costas. Afaste os joelhos para os lados para não interferir na barra.
Após a barra passar os joelhos, estenda os quadris e joelhos completamente para terminar o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra para clean'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch_Deadlift')::uuid, 'Levantamento terra pegada snatch', 'Posterior', 'Barra', 'LIVRE', 'O deadlift de arranco fortalece a primeira fase do movimento. Comece com uma pegada larga de arranco, a barra no chão. Os pés devem estar sob os quadris, com os dedos levemente para fora. Agache-se até a barra, mantendo as costas retas e a cabeça erguida.
Inicie o movimento empurrando com os calcanhares e elevando os quadris. Mantenha o ângulo das costas igual até a barra passar os joelhos.
Em seguida, empurre os quadris para frente enquanto inclina o tronco para trás. Retorne a barra ao chão invertendo o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra pegada snatch'),
  (md5('catalogo-exercicio:fedb:' || 'Romanian_Deadlift')::uuid, 'Levantamento terra romeno com barra', 'Posterior', 'Barra', 'LIVRE', 'Segure uma barra com as palmas voltadas para baixo e as mãos um pouco além da largura dos ombros.
Flexione levemente os joelhos, mantenha as canelas verticais, os quadris para trás e as costas retas. Esta é a posição inicial.
Mantendo as costas e braços retos, use os quadris para levantar a barra ao expirar, em um movimento controlado.
Ao ficar em pé completamente, abaixe a barra empurrando os quadris para trás, flexionando os joelhos minimamente.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra romeno com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Romanian_Deadlift_from_Deficit')::uuid, 'Levantamento terra romeno com déficit', 'Posterior', 'Barra', 'LIVRE', 'Fique em pé segurando uma barra com os braços estendidos. Você pode usar uma plataforma elevada para aumentar a amplitude.
Flexione levemente os joelhos e depois os quadris, movendo o glúteo para trás o máximo possível e abaixando o tronco conforme a flexibilidade permitir. Mantenha as costas retas e a barra próxima às pernas.
Inverta o movimento para retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra romeno com deficit'),
  (md5('catalogo-exercicio:fedb:' || 'Sumo_Deadlift')::uuid, 'Levantamento terra sumô com barra', 'Posterior', 'Barra', 'LIVRE', 'Posicione-se com a barra no chão, no meio dos pés, que devem estar bem afastados. Incline-se para segurar a barra com os braços abaixo dos ombros, dentro das pernas, usando pegada pronada, mista ou de gancho. Relaxe os ombros.
Respire, abaixe os quadris, mantenha o peito erguido e a cabeça para a frente. Empurre o chão, com o peso nos calcanhares, estendendo quadris e joelhos.
Quando a barra passar pelos joelhos, incline-se para trás e encaixe os quadris na barra, juntando as escápulas.
Retorne o peso ao chão flexionando os quadris e controlando a descida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra sumo com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Sumo_Deadlift_with_Chains')::uuid, 'Levantamento terra sumô com correntes', 'Posterior', 'Barra', 'LIVRE', 'Você pode prender as correntes nas extremidades da barra ou simplesmente pendurar o meio sobre a barra para aumentar o peso progressivamente ao levantar. Tente manter as pontas das correntes afastadas dos discos para não bater neles ao abaixar o peso.
Comece com a barra no chão. Posicione-se de modo que a barra fique no meio dos pés, que devem estar bem abertos, próximos às garras. Incline-se nos quadris para segurar a barra, com os braços diretamente abaixo dos ombros, dentro das pernas, usando pegada pronada, mista ou de gancho. Relaxe os ombros para alongar os braços.
Respire fundo, abaixe os quadris, mantenha a cabeça erguida e o peito para cima. Empurre o chão, afastando os pés, com o peso nos calcanhares. Estenda os quadris e joelhos.
Quando a barra passar pelos joelhos, incline-se para trás e empurre os quadris contra a barra, juntando as escápulas.
Retorne o peso ao chão flexionando os quadris e controlando a descida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra sumo com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Band_Sumo_Deadlift')::uuid, 'Levantamento terra sumô com elástico reversa', 'Posterior', 'Barra', 'LIVRE', 'Coloque a barra no chão dentro de um rack de potência. Prenda as bandas na parte superior do rack, usando pinos ou a estrutura. Conecte a outra extremidade à barra.
Posicione-se com a barra no meio dos pés, que devem estar bem afastados, perto das anilhas. Incline-se nos quadris para segurar a barra. Os braços devem ficar abaixo dos ombros, dentro das pernas, com pegada pronada, mista ou de gancho. Relaxe os ombros para alongar os braços.
Inspire, abaixe os quadris, olhe para frente com o peito erguido. Empurre o chão, afastando os pés, com o peso na parte posterior dos pés. Estenda os quadris e joelhos.
Quando a barra passar os joelhos, incline-se para trás e empurre os quadris contra a barra, juntando as escápulas.
Retorne o peso ao chão flexionando os quadris e controlando a descida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra sumo com elastico reversa'),
  (md5('catalogo-exercicio:fedb:' || 'Sumo_Deadlift_with_Bands')::uuid, 'Levantamento terra sumô com elásticos', 'Posterior', 'Barra', 'LIVRE', 'Passe os elásticos curtos pela barra e posicione-os sob a parte posterior dos pés, onde você empurra o chão.
Posicione-se com a barra no chão, no meio dos pés, bem afastados. Incline-se para segurar a barra com os braços abaixo dos ombros, dentro das pernas, usando pegada pronada, mista ou de gancho.
Respire, abaixe os quadris, mantenha o peito erguido e a cabeça para a frente. Empurre o chão, com o peso nos calcanhares, estendendo quadris e joelhos.
Quando a barra passar pelos joelhos, incline-se para trás e encaixe os quadris na barra, juntando as escápulas.
Retorne o peso ao chão flexionando os quadris e controlando a descida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'levantamento terra sumo com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'Latissimus_Dorsi-SMR')::uuid, 'Liberação do grande dorsal com rolo', 'Costas', 'Rolo de liberação', 'OUTRO', 'Deitado no chão, coloque um rolo de espuma sob suas costas e para um lado, logo atrás da axila. Esta será sua posição inicial.
Mantenha o braço do lado que está sendo alongado atrás e ao lado de você enquanto desloca seu peso para os latíssimos, mantendo a parte superior do corpo fora do chão. Segure por 10 a 30 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao do grande dorsal com rolo'),
  (md5('catalogo-exercicio:fedb:' || 'Iliotibial_Tract-SMR')::uuid, 'Liberação do trato iliotibial com rolo', 'Abdutores', 'Rolo de liberação', 'OUTRO', 'Deite-se de lado, com a perna de baixo apoiada em um rolo de espuma entre o quadril e o joelho. A outra perna pode ser cruzada na frente.
Coloque tanto peso quanto tolerável na perna de baixo; não é necessário mantê-la no chão. Relaxe os músculos da perna que está alongando.
Role a perna sobre o rolo do quadril ao joelho, pausando por 10-30 segundos nos pontos de tensão. Repita com a perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao do trato iliotibial com rolo'),
  (md5('catalogo-exercicio:fedb:' || 'Brachialis-SMR')::uuid, 'Liberação miofascial do braquial', 'Bíceps', 'Rolo de liberação', 'OUTRO', 'Deite-se de lado, com a parte superior do braço apoiada no rolo de espuma. O braço superior deve estar mais ou menos alinhado com o corpo, com a parte externa do bíceps pressionada contra o rolo.
Levante os quadris do chão, apoiando o peso no braço e nos pés. Mantenha por 10 a 30 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do braquial'),
  (md5('catalogo-exercicio:fedb:' || 'Foot-SMR')::uuid, 'Liberação miofascial do pé', 'Panturrilha', null, 'OUTRO', 'Sente-se com os sapatos removidos e use um rolo ou objeto similar sob o arco do pé. Esta é a posição inicial.
Pressione firmemente e role pelo arco do pé por 10 a 30 segundos.
Troque de pé e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do pe'),
  (md5('catalogo-exercicio:fedb:' || 'Neck-SMR')::uuid, 'Liberação miofascial do pescoço', 'Pescoço', null, 'OUTRO', 'Use um rolo muscular ou um rolo de massagem. Coloque o rolo atrás da cabeça, pressionando os músculos ao lado da coluna, não diretamente sobre ela. Esta será a posição inicial.
Começando pelo topo do pescoço, role lentamente para baixo, pausando em pontos de tensão por 10 a 30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do pescoco'),
  (md5('catalogo-exercicio:fedb:' || 'Piriformis-SMR')::uuid, 'Liberação miofascial do piriforme', 'Glúteos', 'Rolo de liberação', 'OUTRO', 'Sente-se em um rolo de espuma, com os joelhos dobrados e um tornozelo sobre o joelho oposto.
Incline o peso para o lado da perna cruzada, rolando sobre o glúteo até sentir tensão. Puxe o joelho em direção ao peito para alongar. Segure por 10-30 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do piriforme'),
  (md5('catalogo-exercicio:fedb:' || 'Quadriceps-SMR')::uuid, 'Liberação miofascial do quadríceps', 'Quadríceps', 'Rolo de liberação', 'OUTRO', 'Deite-se de bruços no chão com o peso apoiado nas mãos ou antebraços. Coloque um rolo de espuma sob uma perna no quadríceps e mantenha o pé fora do chão. Relaxe a perna o máximo possível. Esta será sua posição inicial.
Deslocando o máximo de peso para a perna a ser alongada de forma tolerável, role sobre o rolo de espuma de acima do joelho até abaixo do quadril, segurando pontos de tensão por 10-30 segundos. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do quadriceps'),
  (md5('catalogo-exercicio:fedb:' || 'Anterior_Tibialis-SMR')::uuid, 'Liberação miofascial do tibial anterior', 'Panturrilha', null, 'OUTRO', 'Sente-se no chão com as pernas dobradas e os pés apoiados.
Use um rolo de espuma ou um rolo de massagem para aplicar pressão nos músculos da parte externa da canela. Trabalhe desde logo abaixo do joelho até acima do tornozelo, parando nos pontos de tensão por 10-30 segundos. Repita na outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial do tibial anterior'),
  (md5('catalogo-exercicio:fedb:' || 'Peroneals-SMR')::uuid, 'Liberação miofascial dos fibulares', 'Panturrilha', 'Rolo de liberação', 'OUTRO', 'Deite-se de lado, apoiado no antebraço e em um rolo de espuma na parte externa da perna inferior.
Levante os quadris e role o rolo do joelho ao tornozelo, parando em pontos de tensão por 10-30 segundos. Repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial dos fibulares'),
  (md5('catalogo-exercicio:fedb:' || 'Rhomboids-SMR')::uuid, 'Liberação miofascial para romboides', 'Costas', 'Rolo de liberação', 'OUTRO', 'Deite-se de costas no chão. Coloque um rolo de espuma sob a parte superior das costas e cruze os braços à frente, protraindo os ombros. Esta é a posição inicial.
Levante os quadris do chão, transferindo o peso para o rolo. Desloque o peso para um lado de cada vez, rolando sobre a região média e superior das costas. Faça pausas nos pontos de tensão por 10 a 30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'liberacao miofascial para romboides'),
  (md5('catalogo-exercicio:fedb:' || 'Ab_Crunch_Machine')::uuid, 'Máquina de abdominal', 'Abdômen', 'Máquina', 'MAQUINA', 'Selecione uma resistência leve e sente-se na máquina, colocando os pés sob as almofadas e segurando as alças superiores. Os braços devem estar flexionados a 90 graus, com os tríceps apoiados nas almofadas. Esta é a posição inicial.
Ao mesmo tempo, comece a levantar as pernas enquanto faz um crunch com o tronco superior. Expire ao realizar este movimento. Dica: Use um movimento lento e controlado, concentrando-se nos abdominais.
Após uma pausa de um segundo, retorne lentamente à posição inicial enquanto inspira.
Repita o movimento para a quantidade prescrita de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'maquina de abdominal'),
  (md5('catalogo-exercicio:fedb:' || 'One_Half_Locust')::uuid, 'Meia-locusta unilateral', 'Quadríceps', null, 'OUTRO', 'Deite-se de bruços no chão.
Coloque a mão esquerda sob o osso do quadril esquerdo para amortecer a região.
Dobre o joelho direito e segure o pé com a mão direita.
Levante o pé e os ombros do chão ao mesmo tempo, alongando o flexor do quadril, peito e ombros. Troque de lado. Se não incomodar as costas, pode tentar com ambos os braços e pernas ao mesmo tempo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'meia-locusta unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Dip_Machine')::uuid, 'Mergulho na máquina', 'Tríceps', 'Máquina', 'MAQUINA', 'Sente-se firmemente na máquina de mergulho, selecione o peso e segure as alças.
Mantenha os cotovelos junto ao corpo para focar no tríceps, com ângulo de 90 graus.
Contraia o tríceps e estenda os braços para baixo expirando. Dica: No final, mantenha leve flexão para não aliviar a tensão.
Deixe os braços voltarem lentamente à posição inicial inspirando.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho na maquina'),
  (md5('catalogo-exercicio:fedb:' || 'Ring_Dips')::uuid, 'Mergulho nas argolas', 'Tríceps', null, 'OUTRO', 'Segure uma argola em cada mão e dê um pequeno pulo para entrar na posição inicial com os braços estendidos.
Comece flexionando os cotovelos, abaixando o corpo até os braços formarem um ângulo menor que 90 graus. Evite balançar e mantenha uma boa postura durante a descida.
Inverta o movimento estendendo os cotovelos, empurrando-se de volta à posição inicial.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho nas argolas'),
  (md5('catalogo-exercicio:fedb:' || 'Parallel_Bar_Dip')::uuid, 'Mergulho nas barras paralelas', 'Tríceps', null, 'OUTRO', 'Posicione-se entre as barras paralelas, com as mãos em cada barra e braços estendidos.
Dobre os cotovelos para baixar o corpo até os braços formarem um ângulo de 90 graus, sem balançar.
Estenda os cotovelos para voltar à posição inicial.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho nas barras paralelas'),
  (md5('catalogo-exercicio:fedb:' || 'Dips_-_Chest_Version')::uuid, 'Mergulho nas paralelas para peito', 'Peito', null, 'OUTRO', 'Segure-se nas barras paralelas com os braços estendidos (quase travados).
Inspire e abaixe-se lentamente, inclinando o torso cerca de 30 graus para frente e afastando os cotovelos até sentir um alongamento no peitoral.
Use o peitoral para retornar à posição inicial expirando. Dica: Contraia o peitoral no topo por um segundo.
Repita para as repetições prescritas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho nas paralelas para peito'),
  (md5('catalogo-exercicio:fedb:' || 'Dips_-_Triceps_Version')::uuid, 'Mergulho nas paralelas para tríceps', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Segure-se nas barras paralelas com os braços quase estendidos.
Inspire e abaixe-se lentamente, mantendo o torso ereto e cotovelos próximos ao corpo para focar no tríceps, até formar 90 graus no cotovelo.
Expire e empurre o torso para cima usando o tríceps para voltar à posição inicial.
Repita para as repetições prescritas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho nas paralelas para triceps'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Dips')::uuid, 'Mergulho no banco', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Para este exercício, posicione um banco atrás de suas costas. Com o banco perpendicular ao seu corpo e de costas para ele, segure a borda do banco com as mãos totalmente estendidas, afastadas na largura dos ombros. Estenda as pernas para a frente, dobradas na cintura e perpendiculares ao tronco. Esta será a posição inicial.
Abaixe o corpo lentamente, inspirando, ao dobrar os cotovelos até que o ângulo entre o braço e o antebraço seja ligeiramente menor que 90 graus. Dica: Mantenha os cotovelos o mais próximo possível durante o movimento. Os antebraços devem sempre apontar para baixo.
Use os tríceps para levantar o tronco de volta à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho no banco'),
  (md5('catalogo-exercicio:fedb:' || 'Weighted_Bench_Dip')::uuid, 'Mergulho no banco com sobrecarga', 'Tríceps', null, 'OUTRO', 'Posicione um banco atrás das costas e outro na frente. Segure a borda do banco traseiro com as mãos na largura dos ombros, braços estendidos.
Estenda as pernas sobre o banco da frente, paralelas ao chão. Peça a um parceiro para colocar um peso no colo.
Abaixe o corpo dobrando os cotovelos até formar um ângulo menor que 90 graus, inspirando.
Use os tríceps para levantar o corpo à posição inicial, expirando.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mergulho no banco com sobrecarga'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Leg_Curl')::uuid, 'Mesa flexora em pé', 'Posterior', 'Máquina', 'MAQUINA', 'Ajuste a máquina à sua altura, incline o tronco para a frente e posicione a perna direita no aparelho, com o apoio atrás da panturrilha.
Segure as alças, mantenha a perna estendida e os dedos retos. Esta é a posição inicial.
Flexione a perna para cima o máximo possível enquanto expira, sem levantar a coxa.
Segure a contração por um segundo e retorne à posição inicial enquanto inspira.
Repita para o número recomendado de repetições e faça com a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mesa flexora em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Car_Drivers')::uuid, 'Motoristas de carro', 'Ombros', 'Barra', 'LIVRE', 'Em pé, segure um peso de chapa de halter com as duas mãos nas posições de 3 e 9 horas. As palmas devem estar voltadas uma para a outra, com os braços estendidos retos à sua frente. Esta será a posição inicial.
Inicie o movimento girando a chapa o máximo possível para um lado, como se estivesse virando um volante de carro.
Inverta o movimento, girando-a completamente para o lado oposto.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'motoristas de carro'),
  (md5('catalogo-exercicio:fedb:' || 'Mountain_Climbers')::uuid, 'Mountain climber', 'Quadríceps', null, 'OUTRO', 'Comece na posição de flexão, com o peso apoiado nas mãos e nos dedos dos pés. Flexionando o joelho e o quadril, traga uma perna até que o joelho fique aproximadamente sob o quadril. Esta será sua posição inicial.
Reverta explosivamente as posições das pernas, estendendo a perna flexionada até que fique reta e apoiada no dedo do pé, e trazendo o outro pé para cima com o quadril e joelho flexionados. Repita de forma alternada por 20 a 30 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'mountain climber'),
  (md5('catalogo-exercicio:fedb:' || 'Muscle_Snatch')::uuid, 'Muscle snatch com barra', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra carregada segura na altura da coxa com uma pegada larga. Os pés devem estar diretamente abaixo dos quadris, com os pés virados para fora conforme necessário. Abaixe os quadris, com o peito para cima e a cabeça olhando para frente. Os ombros devem estar ligeiramente à frente da barra. Esta será a posição inicial.
Inicie a puxada empurrando com a parte frontal dos calcanhares, elevando a barra. Transicione para a segunda puxada estendendo os quadris, joelhos e tornozelos, levantando a barra o mais rápido possível. A barra deve ficar próxima ao corpo.
Continue elevando a barra até a posição acima da cabeça, sem flexionar os joelhos novamente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'muscle snatch com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Kipping_Muscle_Up')::uuid, 'Muscle-up com kipping', 'Costas', null, 'OUTRO', 'Segure as argolas com uma pegada falsa, palmas sobre as argolas.
Balance as pernas para trás e depois para frente, puxando o corpo para cima e levando as argolas às axilas.
Estenda os cotovelos para completar o movimento e desça com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'muscle-up com kipping'),
  (md5('catalogo-exercicio:fedb:' || 'Muscle_Up')::uuid, 'Muscle-up na barra fixa', 'Costas', null, 'OUTRO', 'Segure as argolas com uma pegada falsa, com a base das palmas das mãos sobre as argolas. Inicie uma puxada puxando os cotovelos para baixo em direção ao corpo, flexionando os cotovelos.
Ao alcançar o topo da puxada, puxe as argolas para as axilas enquanto rola os ombros para frente, permitindo que os cotovelos se movam para trás. Isso coloca você na posição correta para continuar na parte de mergulho do movimento.
Mantendo controle e estabilidade, estenda os cotovelos para completar o movimento.
Tenha cuidado ao descer ao chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'muscle-up na barra fixa'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Pirate_Ships')::uuid, 'Navios piratas com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Com uma postura larga, segure um kettlebell com as duas mãos, deixando-o pendurado na altura da cintura com os braços estendidos. Esta é a posição inicial.
Inicie o movimento girando para um lado, balançando o kettlebell até a altura da cabeça. Faça uma pausa breve no topo.
Deixe o kettlebell descer enquanto gira para o lado oposto, elevando-o novamente até a altura da cabeça.
Repita pelo número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'navios piratas com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Looking_At_Ceiling')::uuid, 'Olhando para o teto', 'Quadríceps', null, 'OUTRO', 'Ajoelhe-se no chão, segurando os calcanhares com as duas mãos.
Levante os glúteos para cima e para frente enquanto leva a cabeça para trás para olhar para o teto, arqueando as costas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'olhando para o teto'),
  (md5('catalogo-exercicio:fedb:' || 'Otis-Up')::uuid, 'Otis-up', 'Abdômen', null, 'OUTRO', 'Prenda os pés e deite-se de costas no chão, com os joelhos flexionados. Segure um peso com as duas mãos no peito. Esta é a posição inicial.
Flexione os quadris e a coluna para levantar o tronco do chão.
Ao subir, empurre o peso acima da cabeça.
Retorne o peso ao peito enquanto reverte o movimento, sem tocar o chão completamente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'otis-up'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Squat')::uuid, 'Overhead squat com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com uma barra no chão à sua frente. Seus pés devem estar mais afastados que a largura dos ombros.
Dobre os joelhos e use uma pegada pronada (palmas voltadas para você) para segurar a barra. As mãos devem estar mais afastadas que a largura dos ombros. Levante a barra até apoiá-la no peito.
Mova a barra para trás e ligeiramente acima da cabeça, mantendo os braços totalmente estendidos. Mantenha a cabeça erguida, as costas retas e retraia as escápulas. Esta é sua posição inicial.
Abaixe lentamente o peso dobrando os joelhos até as coxas ficarem paralelas ao chão, inspirando. Mantenha as costas retas e os braços estendidos acima da cabeça.
Use os pés e as pernas para retornar à posição inicial, expirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'overhead squat com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Pallof_Press_With_Rotation')::uuid, 'Pallof press com rotação na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça padrão a uma torre de cabo e posicione o cabo na altura dos ombros.
De lado para o cabo, segure a alça com uma mão e afaste-se da torre. Fique a cerca de um braço de distância, com o braço estendido alinhado ao cabo.
Com os pés na largura do quadril, puxe o cabo para o peito e segure a alça com a outra mão. Ambas as mãos devem estar na alça.
Virado para frente, pressione o cabo para longe do peito. Mantenha o core contraído e ativo.
Mantendo os quadris retos, gire o torso para longe da polia até obter um quarto de rotação completa.
Mantenha a postura rígida e os braços retos. Retorne à posição neutra de forma lenta e controlada, com os braços estendidos à frente.
Com a tensão lateral ainda ativando o core, traga as mãos ao peito e imediatamente pressione para fora até a extensão completa. Isso constitui uma repetição.
Repita até a falha.
Em seguida, reposicione e repita a série do lado oposto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pallof press com rotacao na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Pallof_Press')::uuid, 'Pallof press na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça padrão a uma torre de cabo e, se possível, posicione o cabo na altura dos ombros. Caso contrário, use uma polia baixa.
De lado para o cabo, segure a alça com as duas mãos e afaste-se da torre. Fique a cerca de um braço de distância, com a tensão do peso no cabo.
Com os pés na largura do quadril e joelhos levemente flexionados, segure o cabo no meio do peito. Esta é sua posição inicial.
Pressione o cabo para longe do peito, estendendo totalmente os braços. Mantenha o core contraído e ativo.
Segure a posição por alguns segundos antes de retornar à posição inicial.
Ao final da série, repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pallof press na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Donkey_Calf_Raises')::uuid, 'Panturrilha burrinho', 'Panturrilha', null, 'OUTRO', 'Posicione a região lombar e os quadris sob a alavanca acolchoada do aparelho, com o cóccix em contato com o apoio.
Coloque as mãos nas alças laterais e apoie a ponta dos pés no bloco, com os calcanhares para fora. Alinhe os dedos para frente, para dentro ou para fora, dependendo da área a ser trabalhada, e estenda os joelhos sem travá-los. Esta é a posição inicial.
Eleve os calcanhares expirando, estendendo os tornozelos o máximo possível e contraindo a panturrilha. Mantenha os joelhos fixos, sem flexionar. Segure a contração por um segundo.
Volte lentamente à posição inicial inspirando, abaixando os calcanhares até alongar a panturrilha.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha burrinho'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Raises_-_With_Bands')::uuid, 'Panturrilha com elástico', 'Panturrilha', 'Elástico', 'ELASTICO', 'Pise na banda elástica com os pés, garantindo que o comprimento seja igual em ambos os lados.
Segure as alças da banda e levante os braços para os lados da cabeça, como em um desenvolvimento de ombros, com cotovelos flexionados. Isso cria tensão na banda. Esta é a posição inicial.
Mantendo as mãos próximas aos ombros, fique na ponta dos pés enquanto expira e contrai as panturrilhas no topo.
Após um segundo de contração, retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Raise_On_A_Dumbbell')::uuid, 'Panturrilha com halter', 'Panturrilha', 'Halteres', 'LIVRE', 'Segure-se em um objeto firme para equilíbrio e fique em cima do cabo de um halter, de preferência com placas redondas para aumentar a instabilidade.
Role o pé levemente para frente para alongar a panturrilha. Esta é a posição inicial.
Eleve a panturrilha rolando o pé sobre o cabo, estendendo-a completamente enquanto expira. Contraia a panturrilha no topo e segure por um segundo. Dica: Ao subir, role o halter levemente para trás.
Ao descer, inspire e role o halter para frente para um melhor alongamento.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Calf_Raises')::uuid, 'Panturrilha em pé', 'Panturrilha', 'Máquina', 'MAQUINA', 'Ajuste a alavanca acolchoada da máquina de panturrilha para sua altura.
Posicione os ombros sob as almofadas, com as pontas dos pés para frente (ou em outras posições, se preferir). As pontas dos pés devem ficar no bloco, com os calcanhares para fora. Empurre a alavanca para cima, estendendo quadris e joelhos até ficar ereto, mantendo os joelhos levemente flexionados.
Eleve os calcanhares ao expirar, estendendo os tornozelos o máximo possível e contraindo a panturrilha. Mantenha os joelhos fixos, sem dobrar. Segure a contração por um segundo.
Volte lentamente à posição inicial ao inspirar, abaixando os calcanhares até alongar as panturrilhas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Barbell_Calf_Raise')::uuid, 'Panturrilha em pé com barra', 'Panturrilha', 'Barra', 'LIVRE', 'Este exercício é melhor realizado dentro de um rack de agachamento por segurança. Comece ajustando a barra em uma altura adequada. Com a barra carregada, posicione-se sob ela e apoie-a na parte de trás dos ombros (logo abaixo do pescoço).
Segure a barra com as duas mãos e levante-a do rack, empurrando com as pernas e endireitando o tronco.
Afaste-se do rack e posicione as pernas com uma postura na largura dos ombros, dedos ligeiramente para fora. Mantenha a cabeça erguida e as costas retas. Os joelhos devem ficar levemente flexionados, nunca travados. Esta é a posição inicial. Dica: Para maior amplitude, você pode colocar a ponta dos pés em um bloco, mas tome cuidado, pois isso exige mais equilíbrio.
Eleve os calcanhares, expirando, estendendo os tornozelos o máximo possível e contraindo a panturrilha. Mantenha os joelhos fixos, sem dobrá-los. Segure a contração por um segundo antes de descer.
Volte lentamente à posição inicial, inspirando, abaixando os calcanhares até alongar as panturrilhas.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha em pe com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Calf_Raise')::uuid, 'Panturrilha em pé com halteres', 'Panturrilha', 'Halteres', 'LIVRE', 'Fique em pé, segurando dois halteres ao lado do corpo. Coloque as pontas dos pés em uma plataforma estável (cerca de 5-7 cm de altura), com os calcanhares para fora tocando o chão. Esta é a posição inicial.
Com os dedos apontando para frente (para trabalhar uniformemente), para dentro (ênfase na parte externa) ou para fora (ênfase na parte interna), eleve os calcanhares ao expirar, contraindo as panturrilhas. Segure a contração por um segundo.
Ao inspirar, retorne à posição inicial, abaixando os calcanhares lentamente.
Repita pelo número recomendado de vezes.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha em pe com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Press')::uuid, 'Panturrilha no leg press', 'Panturrilha', 'Máquina', 'MAQUINA', 'Ajuste o assento para que as pernas fiquem levemente flexionadas na posição inicial. As pontas dos pés devem estar firmes na plataforma.
Selecione um peso adequado e segure as alças. Esta é a posição inicial.
Estenda os joelhos para levantar o peso, mantendo os tornozelos flexionados (dedos para cima). Pressione para baixo com as pontas dos pés o máximo possível.
Após uma breve pausa, retorne ao início e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha no leg press'),
  (md5('catalogo-exercicio:fedb:' || 'Calf_Press_On_The_Leg_Press_Machine')::uuid, 'Panturrilha no leg press máquina', 'Panturrilha', 'Máquina', 'MAQUINA', 'Sente-se na máquina de leg press e coloque os pés na plataforma com uma postura média (largura dos ombros).
Libere as travas de segurança e empurre a plataforma até as pernas ficarem quase estendidas, sem travar os joelhos. Posicione as pontas dos pés na parte inferior da plataforma, com os calcanhares para fora. Esta é a posição inicial.
Eleve os calcanhares enquanto expira, estendendo os tornozelos ao máximo e contraindo a panturrilha. Mantenha os joelhos imóveis. Segure a contração por um segundo.
Abaixe os calcanhares lentamente enquanto inspira, alongando as panturrilhas.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha no leg press maquina'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Calf_Raise')::uuid, 'Panturrilha no smith', 'Panturrilha', 'Máquina', 'MAQUINA', 'Coloque um bloco ou anilha abaixo da barra no Smith Machine. Ajuste a barra para uma altura que combine com sua estatura. Com a altura correta escolhida e a barra carregada, suba nas anilhas com a ponta dos pés e posicione a barra atrás dos ombros.
Segure a barra com as duas mãos voltadas para frente. Gire a barra para desengatá-la. Esta será sua posição inicial.
Eleve os calcanhares o mais alto possível, empurrando com a ponta dos pés e contraindo a panturrilha no topo do movimento. Mantenha os joelhos estendidos. Segure a posição contraída por um segundo antes de voltar.
Retorne lentamente à posição inicial enquanto inspira, abaixando os calcanhares.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Seated_Calf_Raise')::uuid, 'Panturrilha sentado com barra', 'Panturrilha', 'Barra', 'LIVRE', 'Coloque um bloco de cerca de 30 cm de altura na frente de um banco plano.
Sente-se no banco e apoie a ponta dos pés no bloco.
Peça para alguém colocar uma barra sobre suas coxas, cerca de 8 cm acima dos joelhos, e segure-a. Esta é a posição inicial.
Eleve os calcanhares o máximo possível, contraindo as panturrilhas e expirando.
Após uma contração de um segundo, retorne lentamente. Dica: Alongue as panturrilhas ao máximo para melhor benefício.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha sentado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Calf_Raise')::uuid, 'Panturrilha sentado na máquina', 'Panturrilha', 'Máquina', 'MAQUINA', 'Sente-se na máquina e coloque a ponta dos pés na plataforma, com os calcanhares para fora. Escolha a posição dos pés (para frente, para dentro ou para fora).
Apoie as coxas sob a almofada da alavanca e ajuste-a conforme a altura. Segure a almofada para evitar que escorregue.
Levante a alavanca empurrando os calcanhares para cima e solte a trava de segurança. Esta é a posição inicial.
Abaixe os calcanhares flexionando os tornozelos até alongar totalmente as panturrilhas. Inspire.
Eleve os calcanhares estendendo os tornozelos o máximo possível, contraindo as panturrilhas. Expire e segure a contração por um segundo.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha sentado na maquina'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Seated_One-Leg_Calf_Raise')::uuid, 'Panturrilha sentado unilateral com halter', 'Panturrilha', 'Halteres', 'LIVRE', 'Coloque um bloco no chão a cerca de 30 cm de um banco plano.
Sente-se no banco e apoie um halter na parte superior da coxa esquerda, cerca de 8 cm acima do joelho.
Posicione a ponta do pé esquerdo no bloco. Esta será sua posição inicial.
Eleve os dedos do pé o mais alto possível, expirando e contraindo a panturrilha. Mantenha a contração por um segundo.
Retorne lentamente à posição inicial, alongando a panturrilha ao máximo.
Repita para o número de repetições prescrito e depois faça com a perna direita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'panturrilha sentado unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Walking_Lunge')::uuid, 'Passada com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Comece em pé, com os pés na largura dos ombros e uma barra apoiada na parte superior das costas.
Dê um passo à frente com uma perna, flexionando os joelhos para abaixar os quadris. Desça até o joelho de trás quase tocar o chão. Mantenha a postura ereta e o joelho da frente acima do pé da frente.
Empurre com o calcanhar do pé da frente e estenda ambos os joelhos para levantar-se novamente.
Dê um passo à frente com o pé de trás, repetindo o afundo com a perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'passada com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Bodyweight_Walking_Lunge')::uuid, 'Passada com peso corporal', 'Quadríceps', null, 'OUTRO', 'Comece em pé com os pés na largura dos ombros e mãos nos quadris.
Dê um passo à frente com uma perna, flexionando os joelhos para baixar os quadris até o joelho traseiro quase tocar o chão. Mantenha a postura ereta e o joelho dianteiro acima do pé.
Empurre com o calcanhar do pé da frente e estenda os joelhos para levantar-se.
Avance com o pé de trás, repetindo o afundo na perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'passada com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Pass_Between_The_Legs')::uuid, 'Passe com kettlebell entre as pernas', 'Abdômen', 'Kettlebell', 'LIVRE', 'Coloque um kettlebell entre as pernas com uma postura confortável. Incline-se para frente, empinando o bumbum e mantendo as costas retas.
Pegue o kettlebell e passe-o para a outra mão entre as pernas, em forma de "W". Repita o movimento de vai e vem por várias repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'passe com kettlebell entre as pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Carioca_Quick_Step')::uuid, 'Passo rápido carioca', 'Adutores', null, 'OUTRO', 'Comece com os pés afastados alguns centímetros e o braço esquerdo levantado em uma posição atlética relaxada.
Com o pé direito, dê um passo rápido para trás e puxe o joelho para cima.
Mova os braços rapidamente ao puxar o joelho direito, garantindo que o joelho suba e desça reto. Evite virar os pés durante o movimento e mantenha o olhar para a frente enquanto se desloca lateralmente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'passo rapido carioca'),
  (md5('catalogo-exercicio:fedb:' || 'Skating')::uuid, 'Patinação', 'Cardio', null, 'CARDIO', 'A patinação é uma atividade divertida que pode melhorar a aptidão cardiorrespiratória e a resistência muscular. Requer equilíbrio e coordenação relativamente bons. É necessário aprender o básico, incluindo curvas e frenagens, e usar equipamento de proteção para evitar lesões.
Você pode patinar em um ritmo confortável por 30 minutos seguidos. Para um desafio cardio, faça patinação intervalada — patine rápido por dois minutos a cada cinco minutos, usando os três minutos restantes para recuperação. Uma pessoa de 68 kg geralmente queima cerca de 175 calorias em 30 minutos de patinação em ritmo confortável, similar a uma caminhada rápida.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'patinacao'),
  (md5('catalogo-exercicio:fedb:' || 'Hanging_Pike')::uuid, 'Pike suspenso', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Pendure-se em uma barra de pull-up com pernas e pés juntos, usando pegada pronada ligeiramente mais larga que os ombros. Dica: Use munhequeiras para facilitar a pegada.
Flexione os joelhos a 90 graus e traga as coxas para frente, mantendo-as paralelas ao chão e as panturrilhas perpendiculares. Esta é a posição inicial.
Puxe as pernas para cima expirando, até quase tocar as canelas na barra. Dica: Tente estender as pernas o máximo possível no topo.
Abaixe as pernas lentamente até a posição inicial. Dica: Evite balançar e usar momentum.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pike suspenso'),
  (md5('catalogo-exercicio:fedb:' || 'Plate_Pinch')::uuid, 'Pinça com anilhas', 'Antebraço', null, 'OUTRO', 'Pegue duas anilhas de borda larga e junte-as com os lados lisos para fora.
Segure as anilhas com os dedos de um lado e o polegar do outro, mantendo-as unidas.
Aperte as anilhas com força e segure pelo tempo possível.
Repita para as séries recomendadas.
Troque de braço e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pinca com anilhas'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Pistol_Squat')::uuid, 'Pistol squat com kettlebell', 'Quadríceps', 'Kettlebell', 'LIVRE', 'Segure um kettlebell com as duas mãos pelas alças. Levante uma perna do chão e agache na outra.
Agache flexionando o joelho e sentando com os quadris, mantendo o kettlebell elevado à sua frente.
Segure a posição inferior por um segundo e inverta o movimento, empurrando pelo calcanhar e mantendo a cabeça e o peito erguidos.
Abaixe-se novamente e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pistol squat com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Fast_Skipping')::uuid, 'Polichinelo rápido', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece em uma posição relaxada, com uma perna ligeiramente à frente. Esta será sua posição inicial.
Execute um padrão de passo-pulo: direita-direita-passo para esquerda-esquerda-passo, alternando continuamente.
Mantenha-se próximo ao chão para reduzir o tempo no ar e mova-se o mais rápido possível.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'polichinelo rapido'),
  (md5('catalogo-exercicio:fedb:' || 'Butt_Lift_Bridge')::uuid, 'Ponte de glúteo', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão, com as mãos ao lado do corpo e os joelhos dobrados. Os pés devem estar posicionados aproximadamente na largura dos ombros. Esta é a posição inicial.
Empurrando principalmente com os calcanhares, levante os quadris do chão mantendo as costas retas. Expire ao realizar esta parte do movimento e segure no topo por um segundo.
Volte lentamente à posição inicial enquanto inspira.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ponte de gluteo'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Glute_Bridge')::uuid, 'Ponte de glúteo com barra', 'Glúteos', 'Barra', 'LIVRE', 'Sente-se no chão com uma barra carregada sobre as pernas. Use uma barra acolchoada para maior conforto. Role a barra até que fique diretamente acima dos quadris e deite-se de costas no chão.
Inicie o movimento empurrando com os calcanhares, elevando os quadris verticalmente através da barra. O peso deve ser suportado pela parte superior das costas e pelos calcanhares.
Estenda o máximo possível, depois reverta o movimento para retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ponte de gluteo com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Bottoms_Up')::uuid, 'Ponte de glúteo com perna elevada', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão, com as pernas estendidas e braços ao lado do corpo. Esta é a posição inicial.
Dobre os joelhos em direção ao peito, flexionando quadris e joelhos, e estenda as pernas perpendicularmente ao chão. Eleve o quadril para levantar os glúteos do chão.
Após uma pausa breve, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ponte de gluteo com perna elevada'),
  (md5('catalogo-exercicio:fedb:' || 'Single_Leg_Glute_Bridge')::uuid, 'Ponte de glúteo unilateral', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão com os pés apoiados e joelhos flexionados.
Eleve uma perna do chão, puxando o joelho em direção ao peito. Esta é a posição inicial.
Execute o movimento empurrando com o calcanhar, estendendo o quadril para cima e elevando os glúteos do chão.
Estenda o máximo possível, faça uma pausa e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ponte de gluteo unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Physioball_Hip_Bridge')::uuid, 'Ponte de quadril com bola suíça', 'Glúteos', 'Bola suíça', 'OUTRO', 'Deite-se com a parte superior das costas na bola, quadris livres e pés no chão.
Estenda os quadris usando glúteos e isquiotibiais, elevando os quadris.
Pause no topo e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'ponte de quadril com bola suica'),
  (md5('catalogo-exercicio:fedb:' || 'London_Bridges')::uuid, 'Pontes de londres', 'Costas', null, 'OUTRO', 'Prenda uma corda de escalada em uma viga alta ou travessa. Abaixo dela, certifique-se de que a barra do Smith machine esteja travada com as travas e não possa se mover. Alternativamente, uma caixa segura também pode ser usada.
Fique em pé na barra, usando a corda para se equilibrar. Esta será a posição inicial.
Mantendo o corpo reto, incline-se para trás e abaixe o corpo passando a mão sobre a mão na corda lentamente. Continue até ficar perpendicular ao chão.
Mantendo o corpo reto, reverta o movimento, passando a mão sobre a mão de volta à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pontes de londres'),
  (md5('catalogo-exercicio:fedb:' || 'Childs_Pose')::uuid, 'Postura da criança', 'Costas', null, 'OUTRO', 'Fique de quatro e caminhe com as mãos para a frente.
Sente-se sobre os calcanhares, arrastando os braços pelo chão para alongar a coluna.
Traga as mãos próximas aos pés, relaxe e respire profundamente, apoiando a testa no chão. Evite se tiver problemas no joelho.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'postura da crianca'),
  (md5('catalogo-exercicio:fedb:' || 'Downward_Facing_Balance')::uuid, 'Postura do cachorro olhando para baixo', 'Glúteos', 'Bola suíça', 'OUTRO', 'Deite-se de bruços sobre uma bola de exercícios.
Com o estômago apoiado na bola, caminhe com as mãos para frente no chão e levante as pernas, estendendo cotovelos e joelhos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'postura do cachorro olhando para baixo'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Clean_from_Blocks')::uuid, 'Power clean a partir de blocos', 'Posterior', 'Barra', 'LIVRE', 'Com a barra sobre blocos na altura desejada, segure-a com as mãos além das pernas. Agache com o peso nos calcanhares, costas retas, peito para cima e ombros à frente da barra. Esta é a posição inicial.
Inicie a primeira puxada estendendo os joelhos, mantendo o ângulo das costas e braços retos.
Ao aproximar a barra da coxa, estenda os quadris em um movimento de salto, acelerando a barra para cima.
Na extensão total, encolha os ombros e flexione os braços para puxar-se sob a barra, apoiando-a nos ombros.
Recupere-se empurrando com os calcanhares até ficar em pé e retorne a barra aos blocos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power clean a partir de blocos'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Hang_Power_Clean')::uuid, 'Power clean a partir do joelho no smith', 'Posterior', 'Máquina', 'MAQUINA', 'Posicione a barra na altura dos joelhos e carregue com o peso adequado.
Pegue a barra com uma pegada pronada além da largura dos ombros e desengate-a. Os braços devem estar totalmente estendidos, com a cabeça e o peito erguidos. Cotovelos para fora, ombros para trás e para baixo. Quadris para trás, tensionando os isquiotibiais. Esta é a posição inicial.
Inicie o movimento estendendo com força os quadris e joelhos, acelerando a barra. Mantenha os braços retos nesta fase.
Na extensão total, flexione novamente os quadris e joelhos para baixar até a posição de recepção.
Flexione os braços, girando os cotovelos ao redor da barra para recebê-la nos ombros.
Estenda os quadris e joelhos para ficar em pé com a barra apoiada nos ombros, completando o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power clean a partir do joelho no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Clean')::uuid, 'Power clean com barra', 'Posterior', 'Barra', 'LIVRE', 'Fique em pé com os pés ligeiramente mais afastados que a largura dos ombros e os dedos apontando para fora.
Agache e segure a barra com pegada pronada. As mãos devem estar um pouco além da largura dos ombros, fora dos joelhos, com cotovelos estendidos.
Posicione a barra a cerca de 2,5 cm à frente das canelas e sobre a ponta dos pés.
Mantenha as costas retas ou levemente arqueadas, o peito para cima e as escápulas retraídas.
Mantenha a cabeça neutra, com os olhos para a frente. Inspire nesta fase.
Levante a barra do chão estendendo os quadris e joelhos com força, expirando. Dica: o tronco deve manter o mesmo ângulo; não dobre a cintura prematuramente.
Mantenha os cotovelos estendidos, a cabeça neutra e os ombros sobre a barra.
Ao passar os joelhos, projete os quadris para frente e flexione levemente os joelhos.
Inspire e estenda os quadris e joelhos rapidamente, ficando na ponta dos pés.
Na extensão total, encolha os ombros para cima rapidamente, sem flexionar os cotovelos ainda, expirando.
Flexione os cotovelos para puxar o corpo sob a barra, girando os braços para posicioná-la sobre os ombros, em um agachamento parcial.
Receba a barra com os braços travados, tronco ereto e pés firmes, expirando.
Levante-se estendendo quadris e joelhos.
Abaixe a barra controladamente até as coxas, inspirando, e agache para devolvê-la ao chão.
Repita desde o início pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power clean com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Jerk')::uuid, 'Power jerk com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Com a barra apoiada na frente dos ombros, faça um pequeno agachamento (dip) flexionando os joelhos, sem mover os quadris para trás.
Inverta o movimento com força, empurrando com os calcanhares e movendo a cabeça para o lado para liberar a barra.
Enquanto os pés saem do chão, posicione-os rapidamente em uma base mais larga, com joelhos flexionados.
Receba a barra com os braços travados acima da cabeça.
Retorne à posição em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power jerk com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Snatch_from_Blocks')::uuid, 'Power snatch a partir de blocos', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com uma barra carregada em blocos ou suportes na altura desejada, com pegada larga. Pés abaixo dos quadris, virados para fora. Agache com peito erguido, ombros à frente da barra e cotovelos apontados para fora. Esta é a posição inicial.
Inicie o primeiro puxão empurrando pelos calcanhares, levantando a barra dos blocos.
Transição para o segundo puxão estendendo quadris, joelhos e tornozelos, elevando a barra rapidamente e próxima ao corpo. No pico, encolha os ombros e flexione os cotovelos para os lados.
Puxe-se vigorosamente sob a barra, movendo os pés para fora dos quadris e recebendo a barra acima de um agachamento completo, com braços totalmente estendidos.
Mantenha a barra alinhada com os calcanhares, peito erguido, e empurre pelos calcanhares para ficar em pé. Retorne o peso aos blocos com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power snatch a partir de blocos'),
  (md5('catalogo-exercicio:fedb:' || 'Power_Snatch')::uuid, 'Power snatch com barra', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra carregada no chão, próxima às canelas, com pegada larga. Pés abaixo dos quadris, virados para fora se necessário. Agache com o peito erguido e olhando para frente, ombros ligeiramente à frente da barra. Esta é a posição inicial.
Inicie o primeiro puxão empurrando pelos calcanhares, levantando a barra do chão. Mantenha o ângulo das costas até a barra passar os joelhos.
Transição para o segundo puxão estendendo quadris, joelhos e tornozelos, elevando a barra rapidamente e próxima ao corpo. No pico, encolha os ombros e flexione os cotovelos para os lados.
Ao mover os pés para uma posição mais larga, puxe-se sob a barra, recebendo-a em um agachamento parcial com os braços estendidos acima da cabeça.
Retorne à posição em pé com o peso sobre a cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'power snatch com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Balance_Board')::uuid, 'Prancha de equilíbrio', 'Panturrilha', null, 'OUTRO', 'Coloque uma prancha de equilíbrio no chão.
Fique em pé sobre ela e tente manter o equilíbrio.
Segure a posição pelo tempo desejado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'prancha de equilibrio'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Bridge')::uuid, 'Prancha lateral', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', null, 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'prancha lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Pyramid')::uuid, 'Prancha pirâmide', 'Costas', 'Bola suíça', 'OUTRO', 'Role o torso para frente sobre a bola, apoiando os quadris no topo da bola, que se torna o ponto mais alto do corpo.
Apoie as mãos e os pés no chão, com braços e pernas levemente flexionados ou estendidos, dependendo do tamanho da bola e da sua flexibilidade. Isso ajuda a desenvolver força de estabilização no torso e ombros.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'prancha piramide'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Seesaw_Press')::uuid, 'Press alternado com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Leve dois kettlebells aos ombros com um clean.
Pressione um kettlebell acima da cabeça.
Abaixe o kettlebell e imediatamente pressione o outro kettlebell. Faça o mesmo número de repetições em ambos os lados.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'press alternado com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'See-Saw_Press_Alternating_Side_Press')::uuid, 'Press alternado em gangorra', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e fique em pé ereto.
Levante os halteres até a altura do peito/ombros e gire os pulsos para que as palmas fiquem viradas para você, como se fosse fazer um Press Arnold. Esta será a posição inicial.
Comece a estender o braço esquerdo acima da cabeça, girando o pulso para que a palma da mão fique virada para frente ao subir. Os cotovelos devem sair para fora ao levantar o peso. Simultaneamente, incline-se do quadril para o lado oposto. Dica: Se executado corretamente, deve parecer que você está tentando alcançar algo acima no lado direito do corpo, mas com o braço esquerdo. Expire ao executar este movimento.
Ao chegar ao topo, inspire. Então, com o peso totalmente estendido acima da cabeça e você inclinado para o lado direito, inicie o movimento para o lado esquerdo.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'press alternado em gangorra'),
  (md5('catalogo-exercicio:fedb:' || 'Pin_Presses')::uuid, 'Press com pinos', 'Tríceps', 'Barra', 'LIVRE', 'O press com pinos desenvolve força inicial e permite treinar uma amplitude específica.
Ajuste os pinos em uma power rack para a altura desejada e prepare a barra.
Deite-se no banco, com a barra acima do ponto de contato. Arqueie as costas, retraia as escápulas e mantenha a posição firme.
Segure a barra com pegada padrão ou para tríceps, alinhando barra, punho e cotovelo.
Empurre a barra para cima com força, mantendo os cotovelos próximos até a extensão completa.
Devolva a barra aos pinos, pausando antes da próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'press com pinos'),
  (md5('catalogo-exercicio:fedb:' || 'Shoulder_Press_-_With_Bands')::uuid, 'Press de ombros com elásticos', 'Ombros', 'Elástico', 'ELASTICO', 'Para começar, fique em cima de uma faixa elástica para que a tensão comece com os braços estendidos. Segure as alças e levante-as até que as mãos fiquem na altura dos ombros de cada lado.
Gire os pulsos para que as palmas das mãos fiquem viradas para frente. Os cotovelos devem estar flexionados, com os braços superiores e antebraços alinhados ao tronco. Esta é a posição inicial.
Ao expirar, levante as alças até que os braços estejam totalmente estendidos acima da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'press de ombros com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'Neck_Press')::uuid, 'Press no pescoço', 'Peito', 'Barra', 'LIVRE', 'Deite-se de costas em um banco plano. Segure a barra com uma pegada média (que forme um ângulo de 90 graus no meio do movimento) e levante-a do suporte, mantendo-a reta sobre o pescoço com os braços travados. Esta será a posição inicial.
Inspire e desça a barra lentamente até sentir-la no pescoço.
Após uma pausa de um segundo, retorne à posição inicial expirando e empurrando a barra com os músculos do peito. Trave os braços e contraia o peito na posição contraída, segure por um segundo e depois desça lentamente. Dica: A descida deve durar pelo menos o dobro do tempo da subida.
Repita para o número recomendado de repetições.
Ao terminar, recoloque a barra no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'press no pescoco'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Leg_Hop_Progression')::uuid, 'Progressão de salto unilateral', 'Quadríceps', null, 'OUTRO', 'Organize uma linha de cones à sua frente. Fique em pé equilibrado em uma perna, com o joelho da outra perna elevado. Esta é a posição inicial.
Salte para frente sobre o cone, aterrissando na mesma perna.
Use um movimento de contração para pular de cone em cone.
No final, vire e repita com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'progressao de salto unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Lying_Pronation')::uuid, 'Pronação com halter deitado', 'Antebraço', 'Halteres', 'LIVRE', 'Deite-se de bruços em um banco plano, segurando um halter com um braço e apoiando a cabeça na outra mão sobre o banco.
Flexione o cotovelo do braço que segura o halter em um ângulo de 90 graus entre o braço e o antebraço.
Eleve o braço para que o antebraço fique perpendicular ao chão e o braço perpendicular ao torso, paralelo ao chão. Esta é a posição inicial.
Expire e gire o antebraço externamente, levantando o halter até o antebraço ficar paralelo ao chão, mantendo o ângulo de 90 graus. Segure a contração por um segundo.
Inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pronacao com halter deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Rope_Jumping')::uuid, 'Pular corda', 'Cardio', null, 'CARDIO', 'Segure uma ponta da corda em cada mão. Posicione a corda atrás de você no chão.
Levante os braços e gire a corda sobre a cabeça, trazendo-a para a frente. Quando tocar o chão, pule sobre ela.
Mantenha um ritmo constante. Varie a velocidade e técnicas para diversificar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pular corda'),
  (md5('catalogo-exercicio:fedb:' || 'Pull_Through')::uuid, 'Pull-through na polia', 'Glúteos', 'Polia', 'MAQUINA', 'Fique de costas para uma polia baixa, com um cabo ou alça entre as pernas e pés bem afastados.
Inicie o movimento alcançando entre as pernas o máximo possível, flexionando os quadris. Joelhos levemente dobrados.
Com braços retos, estenda os quadris para ficar em pé. O movimento deve vir dos quadris, não dos ombros.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pull-through na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Straight-Arm_Pulldown')::uuid, 'Pulldown na polia com braços retos', 'Costas', 'Polia', 'MAQUINA', 'Segure a barra larga na polia alta de uma máquina de pulldown com pegada pronada (palmas para baixo) mais larga que os ombros. Dê dois passos para trás.
Incline o tronco para a frente cerca de 30 graus, com os braços totalmente estendidos e cotovelos levemente flexionados. Contraia os dorsais para iniciar.
Mantendo os braços retos, puxe a barra para baixo contraindo os dorsais até as mãos ficarem próximas às coxas, expirando.
Retorne à posição inicial mantendo os braços retos, inspirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pulldown na polia com bracos retos'),
  (md5('catalogo-exercicio:fedb:' || 'Rope_Straight-Arm_Pulldown')::uuid, 'Pulldown na polia com corda', 'Costas', 'Polia', 'MAQUINA', 'Prenda uma corda a uma polia alta e selecione o peso. Fique a alguns passos de distância, com os pés escalonados, e segure a corda com as duas mãos.
Incline-se para frente a partir do quadril, mantendo as costas retas e os braços estendidos à frente. Esta é a posição inicial.
Mantendo os braços retos, puxe a corda para baixo até as coxas, estendendo os ombros.
Segure na parte inferior, contraindo as costas.
Retorne à posição inicial sem deixar o peso repousar completamente.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pulldown na polia com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Bent-Arm_Barbell_Pullover')::uuid, 'Pullover com barra e braços flexionados', 'Costas', 'Barra', 'LIVRE', 'Deite-se em um banco plano segurando uma barra com uma pegada na largura dos ombros.
Segure a barra reta sobre o peito com os braços flexionados. Esta será a posição inicial.
Mantendo os braços flexionados, abaixe o peso lentamente em um arco atrás da cabeça, inspirando, até sentir um alongamento no peito.
Traga a barra de volta à posição inicial pelo mesmo arco, expirando durante o movimento.
Segure o peso na posição inicial por um segundo e repita para o número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pullover com barra e bracos flexionados'),
  (md5('catalogo-exercicio:fedb:' || 'Bent-Arm_Dumbbell_Pullover')::uuid, 'Pullover com halter e braços flexionados', 'Peito', 'Halteres', 'LIVRE', 'Coloque um halter em pé em um banco plano.
Certifique-se de que o halter esteja seguro, deite-se perpendicular ao banco, com apenas os ombros apoiados. Os quadris devem ficar abaixo do banco, pernas flexionadas e pés firmes no chão. A cabeça ficará fora do banco.
Segure o halter com as duas mãos, mantendo-o reto sobre o peito com os braços flexionados. Ambas as palmas devem pressionar a parte inferior do halter. Esta será a posição inicial. Cuidado: Use sempre um halter seguro para evitar acidentes.
Mantendo os braços flexionados, abaixe o peso lentamente em um arco atrás da cabeça, inspirando, até sentir um alongamento no peito.
Traga o halter de volta à posição inicial pelo mesmo arco, expirando durante o movimento.
Segure o peso na posição inicial por um segundo e repita para o número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pullover com halter e bracos flexionados'),
  (md5('catalogo-exercicio:fedb:' || 'Straight-Arm_Dumbbell_Pullover')::uuid, 'Pullover com halteres', 'Peito', 'Halteres', 'LIVRE', 'Coloque um haltere em pé em um banco plano.
Deite-se perpendicular ao banco, com os ombros apoiados, quadris abaixo do banco e pés no chão. A cabeça ficará fora do banco.
Segure o haltere com as duas mãos, braços estendidos acima do peito, com as palmas pressionando a parte inferior do haltere. Esta é a posição inicial. Cuidado: use um haltere seguro para evitar acidentes.
Mantendo os braços retos, abaixe o peso em um arco atrás da cabeça, inspirando, até sentir um alongamento no peito.
Retorne o haltere à posição inicial pelo mesmo arco, expirando.
Segure brevemente e repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pullover com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Decline_Barbell_Pullover')::uuid, 'Pullover declinado com barra pegada aberta', 'Peito', 'Barra', 'LIVRE', 'Deite-se em um banco declinado com as pernas travadas. Segure a barra atrás da cabeça com uma pegada pronada e mais larga que os ombros, levantando-a até que os braços fiquem estendidos e perpendiculares ao chão. Esta é a posição inicial.
Movimente a barra para trás em um arco semicircular, mantendo os braços estendidos, até que fiquem paralelos ao chão. Inspire durante esse movimento.
Traga a barra de volta à posição inicial, expirando e mantendo o controle total.
Repita para o número de repetições prescrito.
Ao terminar, abaixe a barra lentamente até a altura da cabeça e solte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pullover declinado com barra pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Star_Jump')::uuid, 'Pulo estrela', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece em uma postura relaxada com os pés afastados na largura dos ombros e os braços próximos ao corpo.
Para iniciar o movimento, agache até a metade e exploda para cima o mais alto possível. Estenda totalmente o corpo, afastando pernas e braços do corpo.
Ao aterrissar, traga os membros de volta e absorva o impacto com as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'pulo estrela'),
  (md5('catalogo-exercicio:fedb:' || 'Push_Press_-_Behind_the_Neck')::uuid, 'Push press atrás da nuca', 'Ombros', 'Barra', 'LIVRE', 'Em pé, com a barra apoiada atrás dos ombros, inicie com uma flexão rápida dos joelhos, mantendo os pés sob os quadris e sem mover os quadris para trás. Desça levemente e reverta o movimento com força, impulsionando pelos calcanhares para gerar velocidade e mover a barra verticalmente.
Use o momentum para finalizar o movimento, estendendo os braços e pressionando a barra acima da cabeça.
Volte à posição inicial, usando as pernas para amortecer o impacto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'push press atras da nuca'),
  (md5('catalogo-exercicio:fedb:' || 'Push_Press')::uuid, 'Push press com barra', 'Ombros', 'Barra', 'LIVRE', null, 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'push press com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Kettlebell_Push_Press')::uuid, 'Push press com duas kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Posicione duas kettlebells nos ombros, como em um clean.
Faça um agachamento curto e reverta o movimento rapidamente, usando o impulso das pernas para impulsionar as kettlebells sobre a cabeça.
Com os braços estendidos, abaixe as kettlebells de volta aos ombros e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'push press com duas kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Push_Press')::uuid, 'Push press unilateral com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure o kettlebell pela alça e leve-o ao ombro com um movimento de arranco, estendendo as pernas e quadris enquanto puxa o peso em direção ao ombro. Gire o pulso para que a palma da mão fique virada para frente. Esta é a posição inicial.
Flexione os joelhos para abaixar o corpo, mantendo o tronco ereto.
Imediatamente inverta o movimento, empurrando pelos calcanhares como em um salto para gerar impulso. Ao fazer isso, pressione o kettlebell acima da cabeça até estender os braços, usando o momento do corpo para mover o peso. Abaixe o peso para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'push press unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Lat_Pulldown')::uuid, 'Puxada aberta na polia', 'Costas', 'Polia', 'MAQUINA', 'Sente-se na máquina de pulldown com a barra larga presa à polia alta. Ajuste o apoio de joelhos para sua altura.
Segure a barra com as palmas voltadas para frente e as mãos mais afastadas que a largura dos ombros.
Com os braços estendidos, incline o tronco cerca de 30 graus para trás, arqueando a lombar e projetando o peito. Esta é a posição inicial.
Expire e puxe a barra para baixo até tocar a parte superior do peito, contraindo as costas. Mantenha o tronco imóvel e use apenas os braços.
Após um segundo na posição contraída, inspire e levante a barra lentamente até os braços estenderem completamente e os dorsais alongarem.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada aberta na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch_Pull')::uuid, 'Puxada alta pegada snatch', 'Posterior', 'Barra', 'LIVRE', 'Com a barra no chão próxima às canelas, segure-a com uma pegada larga de arranco. Agache-se com o peso nos calcanhares, costas retas, cabeça erguida, peito para cima e ombros levemente à frente da barra. Esta é a posição inicial.
Inicie a primeira puxada empurrando com os calcanhares e estendendo os joelhos. Mantenha o ângulo das costas e os braços retos. Mova a barra com controle até acima dos joelhos.
Na segunda puxada, acelere estendendo os quadris, joelhos e tornozelos em um movimento de salto. Use velocidade para elevar a barra.
Não puxe com os braços; ao final, o corpo deve estar totalmente estendido e levemente inclinado para trás. A extensão deve ser rápida e abrupta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada alta pegada snatch'),
  (md5('catalogo-exercicio:fedb:' || 'Leg_Pull-In')::uuid, 'Puxada de pernas', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se em um colchonete com as pernas estendidas e as mãos apoiadas ao lado do corpo ou sob os glúteos. Esta é a posição inicial.
Dobre os joelhos e puxe as coxas em direção ao abdômen enquanto expira, contraindo os abdominais. Mantenha os joelhos próximos ao peito por um segundo.
Volte à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada de pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Bench_Pull')::uuid, 'Puxada em banco inclinado', 'Costas', 'Barra', 'LIVRE', 'Pegue um halter em cada mão e deite-se de bruços em um banco inclinado a aproximadamente 30 graus.
Deixe os braços pendurados ao lado do corpo, totalmente estendidos em direção ao chão.
Gire os pulsos para uma pegada pronada (palmas para baixo).
Abra os cotovelos para os lados. Esta será a posição inicial.
Ao expirar, puxe os halteres para cima como em um supino reverso, dobrando os cotovelos e elevando os braços superiores até ficarem no nível das costas. Dica: Os cotovelos devem formar um "T" com o tronco. Segure a contração no topo por um segundo.
Volte lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada em banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'Full_Range-Of-Motion_Lat_Pulldown')::uuid, 'Puxada frontal com amplitude completa', 'Costas', 'Polia', 'MAQUINA', 'Em pé ou sentado em um banco alto, segure as alças dos cabos altos com as mãos cruzadas, palmas para frente.
Mantendo o peito para cima e uma leve arqueada na lombar, puxe as alças para baixo em um movimento de arco. Gire as mãos para que no final as palmas fiquem voltadas uma para a outra. Retorne lentamente e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada frontal com amplitude completa'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_Front_Lat_Pulldown')::uuid, 'Puxada frontal pegada fechada', 'Costas', 'Polia', 'MAQUINA', 'Sente-se em uma máquina de pulldown com uma barra larga presa à polia superior. Ajuste o apoio de joelhos para sua altura; ele evitará que seu corpo seja levantado pela resistência.
Segure a barra com as palmas voltadas para a frente, usando uma pegada fechada (mãos mais próximas que a largura dos ombros).
Com os braços estendidos à frente, incline o torso para trás cerca de 30 graus, curvando levemente a lombar e projetando o peito para fora. Esta é sua posição inicial.
Enquanto expira, puxe a barra para baixo até tocar a parte superior do peito, trazendo os ombros e a parte superior dos braços para baixo e para trás. Dica: Concentre-se em contrair os músculos das costas na posição contraída. O torso superior deve permanecer parado; apenas os braços se movem. Os antebraços só seguram a barra, não puxam.
Após um segundo na posição contraída, enquanto aperta as escápulas, levante lentamente a barra de volta à posição inicial, com os braços totalmente estendidos e os dorsais alongados. Inspire durante essa fase.
Repita o movimento pelo número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada frontal pegada fechada'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Wrist_Pull')::uuid, 'Puxada lateral de pulso', 'Ombros', null, 'OUTRO', 'Fique em pé e cruze o braço esquerdo sobre o corpo, segurando o pulso esquerdo com a mão direita na altura dos quadris, com o braço esquerdo flexionado.
Lentamente, estenda, puxe e levante o braço até a altura do ombro. Sinta o alongamento nas costas, não nos ombros, sem forçar a articulação. Troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada lateral de pulso'),
  (md5('catalogo-exercicio:fedb:' || 'Underhand_Cable_Pulldowns')::uuid, 'Puxada na polia com pegada supinada', 'Costas', 'Polia', 'MAQUINA', 'Sente-se no aparelho de pulldown com a barra larga. Ajuste o apoio de joelhos para sua altura.
Segure a barra com as palmas voltadas para você (pegada supinada), mãos mais próximas que a largura dos ombros.
Incline o tronco levemente para trás, arqueie as costas e estufe o peito.
Puxe a barra até o peito, contraindo as costas e mantendo os cotovelos próximos ao corpo.
Volte lentamente à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada na polia com pegada supinada'),
  (md5('catalogo-exercicio:fedb:' || 'V-Bar_Pulldown')::uuid, 'Puxada na polia com triângulo', 'Costas', 'Polia', 'MAQUINA', 'Sente-se na máquina de puxada com a barra V presa à polia superior.
Ajuste o apoio de joelhos para sua altura para evitar que o corpo seja levantado.
Segure a barra V com as palmas voltadas uma para a outra (pegada neutra). Estufe o peito e incline-se levemente para trás para ativar melhor os dorsais.
Puxe a barra para baixo usando os dorsais, contraindo as escápulas até o peito quase tocar a barra. Expire durante o movimento.
Segure por um segundo e retorne lentamente à posição inicial, inspirando.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada na polia com triangulo'),
  (md5('catalogo-exercicio:fedb:' || 'Rack_Pull_with_Bands')::uuid, 'Puxada no suporte com elásticos', 'Costas', 'Barra', 'LIVRE', 'Prepare-se em um power rack com a barra nos pinos. Os pinos devem estar ajustados no ponto desejado: logo abaixo dos joelhos, logo acima ou na posição média da coxa. Prenda faixas elásticas na base do rack ou fixe-as com halteres. Prenda a outra extremidade à barra. Você pode precisar encurtar as faixas para fornecer tensão.
Posicione-se contra a barra na posição correta de levantamento terra. Seus pés devem estar sob os quadris, a pegada na largura dos ombros, costas arqueadas e quadris para trás para engajar os isquiotibiais. Como o peso é tipicamente pesado, você pode usar uma pegada mista, uma pegada de gancho ou straps para ajudar a segurar o peso.
Com a cabeça olhando para frente, estenda os quadris e joelhos, puxando o peso para cima e para trás até a extensão completa. Certifique-se de puxar os ombros para trás ao completar o movimento. Retorne o peso aos pinos e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada no suporte com elasticos'),
  (md5('catalogo-exercicio:fedb:' || 'Clean_Pull')::uuid, 'Puxada para clean', 'Quadríceps', 'Barra', 'LIVRE', 'Com a barra no chão perto das canelas, segure com pegada pronada ou hook logo fora das perlas. Abaixe os quadris com peso nos calcanhares, costas retas, cabeça para frente, peito para cima e ombros à frente da barra. Posição inicial.
Inicie a primeira puxada empurrando pelos calcanhares e estendendo os joelhos. Mantenha o ângulo das costas e braços retos. Mova a barra com controle até acima dos joelhos.
Na segunda puxada, acelere estendendo os quadris em um movimento de salto. Use a velocidade para levantar a barra, sem puxar com os braços. Ao final, o corpo deve estar totalmente estendido, com movimento rápido e abrupto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada para clean'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Pulldown_Behind_The_Neck')::uuid, 'Puxada por trás na polia pegada aberta', 'Costas', 'Polia', 'MAQUINA', 'Sente-se na máquina de pulldown com a barra larga presa à polia alta. Ajuste o apoio de joelhos para sua altura.
Segure a barra com as palmas voltadas para frente e as mãos mais afastadas que a largura dos ombros.
Com os braços estendidos, incline o tronco e a cabeça para frente, alinhando a barra com a nuca. Esta é a posição inicial.
Expire e puxe a barra para baixo até tocar a nuca, contraindo as costas. Mantenha o tronco imóvel e use apenas os braços.
Após um segundo na posição contraída, inspire e levante a barra lentamente até os braços estenderem completamente e os dorsais alongarem.
Repita para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada por tras na polia pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Lat_Pulldown')::uuid, 'Puxada unilateral na polia', 'Costas', 'Polia', 'MAQUINA', 'Selecione um peso adequado e ajuste o apoio de joelhos para ajudar a mantê-lo firme. Segure a alavanca com uma pegada pronada (palmas para frente). Esta será a posição inicial.
Puxe a alavanca para baixo, aproximando o cotovelo do corpo enquanto flexiona o braço.
Faça uma pausa no ponto mais baixo do movimento e, em seguida, retorne lentamente a alavanca à posição inicial.
Para múltiplas repetições, evite retornar completamente o peso para manter a tensão nos músculos trabalhados.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'puxada unilateral na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Prone_Quadriceps')::uuid, 'Quadríceps deitado prono', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão com seu parceiro ajoelhado ao seu lado. Flexione um joelho e levante essa perna do chão, tentando tocar os glúteos com o pé. Seu parceiro deve segurar o joelho e o tornozelo. Esta será sua posição inicial.
Tente estender o joelho enquanto seu parceiro impede qualquer movimento real.
Após 10-20 segundos, relaxe os músculos enquanto seu parceiro empurra suavemente o pé em direção aos glúteos, alongando ainda mais o quadríceps e os flexores do quadril.
Após 10-20 segundos, troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'quadriceps deitado prono'),
  (md5('catalogo-exercicio:fedb:' || 'Rack_Pulls')::uuid, 'Rack pull com barra', 'Costas', 'Barra', 'LIVRE', 'Prepare-se em um power rack com a barra nos pinos. Os pinos devem estar ajustados no ponto desejado: logo abaixo dos joelhos, logo acima ou na posição média da coxa. Posicione-se contra a barra na posição correta de levantamento terra. Seus pés devem estar sob os quadris, a pegada na largura dos ombros, costas arqueadas e quadris para trás para engajar os isquiotibiais. Como o peso é tipicamente pesado, você pode usar uma pegada mista, uma pegada de gancho ou straps para ajudar a segurar o peso.
Com a cabeça olhando para frente, estenda os quadris e joelhos, puxando o peso para cima e para trás até a extensão completa. Certifique-se de puxar os ombros para trás ao completar o movimento.
Retorne o peso aos pinos e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rack pull com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Spider_Crawl')::uuid, 'Rastejamento de aranha', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Comece em posição prona no chão. Apoie o peso nas mãos e na ponta dos pés, com os pés juntos e o corpo reto. Os braços devem estar flexionados a 90 graus. Esta será a posição inicial.
Inicie o movimento levantando um pé do chão. Gire a perna externamente e traga o joelho em direção ao cotovelo, o mais para frente possível.
Retorne essa perna à posição inicial e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rastejamento de aranha'),
  (md5('catalogo-exercicio:fedb:' || 'Upright_Barbell_Row')::uuid, 'Remada alta com barra', 'Ombros', 'Barra', 'LIVRE', 'Segure uma barra com pegada pronada, mãos ligeiramente mais próximas que a largura dos ombros. Braços estendidos, barra sobre as coxas.
Eleve a barra puxando os cotovelos para cima e para os lados, mantendo-a próxima ao corpo até quase tocar o queixo.
Abaixe a barra lentamente e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Upright_Row_-_With_Bands')::uuid, 'Remada alta com elástico', 'Trapézio', 'Elástico', 'ELASTICO', 'Fique em cima de uma faixa elástica para criar tensão. Segure as alças com pegada pronada, mãos ligeiramente mais próximas que a largura dos ombros.
Eleve as alças puxando os cotovelos para cima, mantendo-as próximas ao corpo até quase tocar o queixo.
Abaixe as alças lentamente e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Upright_Row')::uuid, 'Remada alta com halteres em pé', 'Trapézio', 'Halteres', 'LIVRE', 'Segure um halter em cada mão com pegada pronada (palmas para frente) ligeiramente mais estreita que a largura dos ombros. Halteres repousando sobre as coxas. Braços estendidos com leve flexão nos cotovelos e costas retas. Esta é a posição inicial.
Use os ombros para levantar os halteres ao expirar. Mantenha os halteres próximos ao corpo, com os cotovelos conduzindo o movimento. Continue até quase tocar o queixo. Faça uma pausa no topo.
Abaixe os halteres lentamente à posição inicial, inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta com halteres em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_High_Row')::uuid, 'Remada alta na máquina articulada', 'Costas', 'Máquina', 'MAQUINA', 'Ajuste o peso e a altura do banco para alcançar as alças acima de você. Use o apoio de joelhos para estabilidade. Segure as alças com pegada pronada. Esta é a posição inicial.
Puxe as alças em direção ao torso, retraindo as escápulas e flexionando os cotovelos.
Pause brevemente e retorne lentamente às alças à posição inicial, mantendo a tensão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Upright_Cable_Row')::uuid, 'Remada alta na polia', 'Trapézio', 'Polia', 'MAQUINA', 'Segure uma barra reta no cabo com pegada pronada, mãos ligeiramente mais próximas que a largura dos ombros. Braços estendidos.
Eleve a barra puxando os cotovelos para cima, mantendo-a próxima ao corpo até quase tocar o queixo.
Abaixe a barra lentamente e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Upright_Row')::uuid, 'Remada alta no smith', 'Trapézio', 'Máquina', 'MAQUINA', 'Ajuste a barra na máquina Smith para a altura das coxas. Com a barra carregada, segure-a com as palmas para frente e as mãos na largura dos ombros. Use straps se necessário.
Levante a barra com os braços estendidos e costas retas. Mantenha os cotovelos levemente flexionados. Esta é a posição inicial.
Use os ombros laterais para levantar a barra enquanto expira, mantendo-a próxima ao corpo. Eleve até quase tocar o queixo. Dica: Os cotovelos devem conduzir o movimento, ficando acima dos antebraços. Mantenha o tronco imóvel e pause no topo.
Abaixe a barra lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Sumo_High_Pull')::uuid, 'Remada alta sumô com kettlebell', 'Trapézio', 'Kettlebell', 'LIVRE', 'Posicione um kettlebell no chão entre os pés, com os pés afastados em uma postura ampla. Segure o kettlebell com as duas mãos, jogue os quadris para trás e mantenha o peito e a cabeça erguidos.
Estenda os quadris e joelhos, puxando o kettlebell em direção aos ombros e elevando os cotovelos. Retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta sumo com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_One-Arm_Upright_Row')::uuid, 'Remada alta unilateral com halter', 'Ombros', 'Halteres', 'LIVRE', 'Segure um halter e fique em pé com o braço estendido à frente, cotovelo levemente flexionado e costas retas. O halter deve ficar próximo à coxa, com a palma da mão voltada para a coxa.
A outra mão pode ficar estendida ao lado, na cintura ou segurando uma superfície fixa. Esta é a posição inicial.
Expire e use os ombros para levantar o halter próximo ao corpo, até ele ficar próximo ao queixo, com os cotovelos conduzindo o movimento. Pause por um segundo no topo.
Inspire e abaixe o halter lentamente até a posição inicial.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_One-Arm_Upright_Row')::uuid, 'Remada alta unilateral no smith', 'Ombros', 'Máquina', 'MAQUINA', 'Com a barra na altura da coxa, carregue o peso adequado.
Pegue a barra com uma pegada larga e desengate o peso, removendo a outra mão da barra. O braço deve estar estendido, com você em pé, cabeça e peito erguidos. Esta é a posição inicial.
Inicie o movimento flexionando o cotovelo, elevando o braço com o cotovelo apontado para fora. Continue até o braço ficar paralelo ao chão.
Após uma pausa breve, retorne o peso à posição inicial.
Repita para o número desejado de repetições antes de engatar a barra no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alta unilateral no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Kettlebell_Row')::uuid, 'Remada alternada com kettlebell', 'Costas', 'Kettlebell', 'LIVRE', 'Coloque dois kettlebells na frente dos pés. Flexione levemente os joelhos e empurre o bumbum para trás o máximo possível. Incline-se para frente e segure as alças de ambos os kettlebells.
Puxe um kettlebell do chão enquanto segura o outro. Retraia a escápula do lado ativo, flexionando o cotovelo e puxando o kettlebell em direção ao estômago ou costelas.
Abaixe o kettlebell do braço ativo e repita com o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada alternada com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_One-arm_Cable_Pulley_Rows')::uuid, 'Remada baixa unilateral na polia', 'Costas', 'Polia', 'MAQUINA', 'Sente-se na máquina com os pés apoiados e joelhos levemente flexionados. Incline-se para frente e segure a alça única com a mão esquerda, palma para baixo.
Com o braço estendido, puxe até o tronco formar um ângulo de 90 graus com as pernas. Mantenha as costas levemente arqueadas e o peito para fora. Esta é a posição inicial.
Puxe a alça em direção ao tronco, mantendo o braço próximo e girando o punho para que a palma fique neutra ao lado do abdômen, expirando. Contraia as costas.
Segure a contração por um segundo e volte lentamente à posição inicial, inspirando e girando o punho novamente para baixo.
Repita as repetições recomendadas e faça com o braço direito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada baixa unilateral na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_T-Bar_Row')::uuid, 'Remada cavalinho apoiada', 'Costas', 'Máquina', 'MAQUINA', 'Carregue a máquina de Remada T-Bar com o peso desejado e ajuste a altura das pernas para que o peito superior fique no topo da almofada. Dica: Em algumas máquinas, basta pisar no degrau apropriado.
Deite-se de bruços na almofada e segure as alças. Use pegada pronada, supinada ou neutra, dependendo da parte das costas que deseja enfatizar.
Levante a barra do suporte e estenda os braços à sua frente. Esta será sua posição inicial.
Expirando, puxe o peso para cima lentamente e contraia as costas no topo do movimento. Dica: Mantenha os braços superiores próximos ao torso para melhor ativação muscular, não levante o corpo da almofada e evite usar os bíceps.
Após um segundo de contração no topo, inspirando, retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada cavalinho apoiada'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_Two-Arm_Long_Bar_Row')::uuid, 'Remada cavalinho com barra', 'Costas', 'Barra', 'LIVRE', 'Coloque peso em uma extremidade de uma barra olímpica e fixe a outra extremidade.
Incline-se para frente com o tronco paralelo ao chão e joelhos levemente flexionados.
Segure a barra com as duas mãos logo atrás das anilhas. Esta é a posição inicial.
Puxe a barra reto para cima, com os cotovelos próximos ao corpo, até as anilhas tocarem o peito. Contraia as costas no topo e segure por um segundo. Expire ao puxar. Dica: Use uma alça dupla de cabo se necessário.
Abaixe a barra lentamente, alongando os dorsais. Use anilhas pequenas para melhor amplitude.
Repita o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada cavalinho com barra'),
  (md5('catalogo-exercicio:fedb:' || 'T-Bar_Row_with_Handle')::uuid, 'Remada cavalinho com pegador', 'Costas', 'Barra', 'LIVRE', 'Posicione uma barra em um suporte de landmine ou canto para evitar que ela se mova. Coloque o peso adequado na extremidade.
Fique sobre a barra e coloque um pegador duplo em D ao redor da barra, próximo à rosca. Use os quadris e as pernas para levantar-se até ficar em pé.
Adote uma postura ampla, com os quadris para trás e o peito erguido. Os braços devem estar estendidos. Esta é a posição inicial.
Puxe o peso em direção ao abdômen superior, retraindo as escápulas e flexionando os cotovelos. Evite movimentos bruscos ou trapaça.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada cavalinho com pegador'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_One-Arm_Long_Bar_Row')::uuid, 'Remada cavalinho unilateral com barra', 'Costas', 'Barra', 'LIVRE', 'Coloque peso em uma extremidade de uma barra olímpica e fixe a outra extremidade em um canto ou com um objeto pesado.
Incline-se para frente com o tronco o mais paralelo ao chão possível e joelhos levemente flexionados.
Segure a barra com uma mão logo atrás das anilhas e apoie a outra mão no joelho. Esta é a posição inicial.
Puxe a barra reto para cima, com o cotovelo próximo ao corpo, até as anilhas tocarem o peito. Contraia as costas no topo e segure por um segundo. Expire ao puxar. Evite balançar o tronco.
Abaixe a barra lentamente, alongando os dorsais. Use anilhas pequenas para maior amplitude.
Repita o número recomendado de repetições e troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada cavalinho unilateral com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Cambered_Barbell_Row')::uuid, 'Remada com barra camberada deitado', 'Costas', 'Barra', 'LIVRE', 'Coloque uma barra camberada sob um banco de exercícios.
Deite-se de bruços no banco e segure a barra com uma pegada pronada (palmas para baixo) mais larga que os ombros. Esta será a posição inicial.
Ao expirar, puxe a barra para cima mantendo os cotovelos próximos ao corpo, em direção ao peito (para focar a parte superior das costas) ou ao estômago (para os dorsais).
Segure por um segundo no topo e retorne lentamente à posição inicial enquanto inspira.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada com barra camberada deitado'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Long_Bar_Row')::uuid, 'Remada com barra longa de um braço', 'Costas', 'Barra', 'LIVRE', 'Posicione uma barra em um landmine ou canto para impedir que ela se mova. Coloque um peso adequado na sua extremidade.
Fique ao lado da barra e segure-a com uma mão próxima à anilha. Use os quadris e pernas para levantar-se até ficar em pé.
Assuma uma postura com joelhos flexionados, quadril para trás e peito erguido. Seu braço deve estar estendido. Esta é a posição inicial.
Puxe o peso para o lado, retraindo o ombro e flexionando o cotovelo. Não dê impulso ou trapaceie durante o movimento.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada com barra longa de um braco'),
  (md5('catalogo-exercicio:fedb:' || 'Two-Arm_Kettlebell_Row')::uuid, 'Remada com dois kettlebells', 'Costas', 'Kettlebell', 'LIVRE', 'Coloque dois kettlebells à frente dos pés. Flexione levemente os joelhos e incline o tronco para frente, mantendo as costas retas.
Segure os kettlebells e puxe-os em direção ao estômago, retraindo as escápulas e flexionando os cotovelos.
Abaixe e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada com dois kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Grip_Bent-Over_Rows')::uuid, 'Remada curvada com barra pegada supinada', 'Costas', 'Barra', 'LIVRE', 'Fique em pé segurando uma barra com pegada supinada (palmas voltadas para cima).
Dobre levemente os joelhos e incline o tronco para frente, flexionando o quadril, mantendo as costas retas até ficar quase paralelo ao chão. Dica: Mantenha a cabeça erguida. A barra deve ficar pendurada à sua frente, com os braços perpendiculares ao chão e ao tronco. Esta é a posição inicial.
Mantendo o tronco imóvel, puxe a barra para cima enquanto expira, mantendo os cotovelos próximos ao corpo e sem forçar com os antebraços, apenas segurando o peso. Na posição contraída, contraia os músculos das costas e segure por um segundo.
Abaixe lentamente o peso de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada curvada com barra pegada supinada'),
  (md5('catalogo-exercicio:fedb:' || 'Straight_Bar_Bench_Mid_Rows')::uuid, 'Remada curvada com barra reta no banco', 'Costas', 'Barra', 'LIVRE', 'Coloque uma barra carregada na extremidade de um banco. Fique em pé no banco atrás da barra, com pegada média e pronada. Mantenha os quadris para trás, peito erguido e coluna neutra. Esta é a posição inicial.
Puxe a barra em direção ao tronco, retraindo as escápulas e flexionando os cotovelos, com movimento controlado.
Após uma pausa breve, retorne lentamente a barra à posição inicial, estendendo completamente os braços.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada curvada com barra reta no banco'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_Two-Dumbbell_Row')::uuid, 'Remada curvada com halteres', 'Costas', 'Halteres', 'LIVRE', 'Com um halter em cada mão (palmas voltadas para o torso), flexione levemente os joelhos e incline o tronco para frente, mantendo as costas retas até ficar quase paralelo ao chão. Os braços devem ficar perpendiculares ao solo. Esta é a posição inicial.
Com o tronco fixo, levante os halteres para os lados, mantendo os cotovelos próximos ao corpo. Expire ao levantar e contraia as costas no topo.
Abaixe os pesos lentamente à posição inicial enquanto inspira.
Repita o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada curvada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Bent_Over_Two-Dumbbell_Row_With_Palms_In')::uuid, 'Remada curvada com halteres pegada neutra', 'Costas', 'Halteres', 'LIVRE', 'Com um halter em cada mão (palmas voltadas uma para a outra), incline-se para frente com o tronco quase paralelo ao chão, mantendo as costas retas. Os braços ficam perpendiculares ao solo. Esta é a posição inicial.
Com o tronco fixo, levante os halteres para os lados, expirando e apertando as escápulas. Contraia as costas no topo.
Abaixe os pesos lentamente à posição inicial enquanto inspira.
Repita o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada curvada com halteres pegada neutra'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Bent_Over_Row')::uuid, 'Remada curvada no smith', 'Costas', 'Máquina', 'MAQUINA', 'Ajuste a barra do Smith machine a uma altura cerca de 5 cm abaixo dos joelhos.
Flexione levemente os joelhos e incline o tronco para a frente, dobrando-se na cintura, mantendo as costas retas até ficar quase paralelo ao chão. Dica: Mantenha a cabeça erguida.
Segure a barra com uma pegada pronada e solte-a do suporte. Deixe-a pendurar diretamente à sua frente, com os braços estendidos perpendicularmente ao chão e ao tronco. Esta é a posição inicial.
Mantendo o tronco imóvel, levante a barra ao expirar, mantendo os cotovelos próximos ao corpo sem usar a força dos antebraços, apenas segurando o peso. Na posição contraída, comprima os músculos das costas e segure por um segundo.
Abaixe o peso lentamente à posição inicial enquanto inspira.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada curvada no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Rope_Rear-Delt_Rows')::uuid, 'Remada deltoide posterior na polia com corda', 'Ombros', 'Polia', 'MAQUINA', 'Sente-se em uma estação de remada baixa, como para remada sentada.
Conecte uma corda à polia e segure-a com uma pegada pronada. Os braços devem estar estendidos e paralelos ao chão, com os cotovelos abertos.
Mantenha a lombar ereta e recue os quadris, flexionando levemente os joelhos. Esta é a posição inicial.
Puxe a corda em direção ao peito, abaixo do pescoço, mantendo os cotovelos altos e para os lados. Expire até os cotovelos passarem levemente atrás das costas. Dica: Mantenha a parte superior dos braços horizontal.
Retorne à posição inicial, com os braços estendidos e os ombros alongados para frente. Inspire durante essa fase.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada deltoide posterior na polia com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Incline_Row')::uuid, 'Remada inclinada com halteres', 'Costas', 'Halteres', 'LIVRE', 'Usando uma pegada neutra, incline-se em um banco inclinado.
Segure um halter em cada mão com pegada neutra, começando com os braços estendidos. Esta será a posição inicial.
Retraia as escápulas e flexione os cotovelos para puxar os halteres para o lado do corpo.
Faça uma pausa no topo do movimento e, em seguida, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada inclinada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Inverted_Row_with_Straps')::uuid, 'Remada invertida com alças', 'Costas', null, 'OUTRO', 'Pendure uma corda ou alças de suspensão em um rack ou objeto estável. Segure as pontas e posicione-se deitado de costas, pendurado nas cordas. O corpo deve estar reto, com os calcanhares no chão e os braços totalmente estendidos. Esta será a posição inicial.
Comece flexionando os cotovelos, puxando o peito em direção às mãos. Retraia as escápulas durante o movimento.
Faça uma pausa no topo do movimento e retorne à posição inicial.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada invertida com alcas'),
  (md5('catalogo-exercicio:fedb:' || 'Inverted_Row')::uuid, 'Remada invertida com peso corporal', 'Costas', null, 'OUTRO', 'Posicione uma barra em um rack na altura da cintura. Você também pode usar um Smith machine.
Segure a barra com uma pegada mais larga que os ombros e posicione-se pendurado sob a barra. O corpo deve estar reto, com os calcanhares no chão e os braços totalmente estendidos. Esta será a posição inicial.
Comece flexionando os cotovelos, puxando o peito em direção à barra. Retraia as escápulas durante o movimento.
Faça uma pausa no topo do movimento e retorne à posição inicial.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada invertida com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_High_Pulley_Row')::uuid, 'Remada na polia alta ajoelhado', 'Costas', 'Polia', 'MAQUINA', 'Selecione o peso adequado em uma polia acima da cabeça. Conecte uma corda ao cabo e ajoelhe-se a alguns pés de distância, segurando a corda à frente com os braços estendidos. Esta é a posição inicial.
Inicie o movimento flexionando os cotovelos e retraindo totalmente as omoplatas, puxando a corda em direção ao peito com os cotovelos abertos.
Após uma breve pausa, retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada na polia alta ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Low_Pulley_Row_To_Neck')::uuid, 'Remada na polia baixa para o pescoço', 'Ombros', 'Polia', 'MAQUINA', 'Sente-se em uma máquina de remada na polia baixa com uma corda.
Segure as extremidades da corda com uma pegada pronada (palmas para baixo) e sente-se com as costas retas e os joelhos levemente flexionados. Dica: Mantenha as costas quase verticais e os braços totalmente estendidos à frente. Esta será a posição inicial.
Mantendo o torso estacionário, levante os cotovelos e comece a flexioná-los enquanto puxa a corda em direção ao pescoço, expirando. Os braços superiores devem permanecer paralelos ao chão. Dica: Continue até as mãos ficarem quase próximas às orelhas (os antebraços não estarão paralelos ao chão, mas levemente angulados para cima) e os cotovelos afastados dos lados.
Após segurar por um segundo na posição contraída, retorne lentamente à posição inicial inspirando. Dica: O torso não deve se mover em nenhuma parte do movimento.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada na polia baixa para o pescoco'),
  (md5('catalogo-exercicio:fedb:' || 'Sled_Row')::uuid, 'Remada no sled', 'Costas', null, 'OUTRO', 'Acople duas alças a um trenó usando uma corda ou corrente. Carregue o trenó com um peso adequado. Fique de frente para o trenó e afaste-se até sentir tensão na corda.
Com uma alça em cada mão, flexione levemente os joelhos, mantenha a cabeça e o peito erguidos e comece com os braços estendidos.
Para iniciar o movimento, flexione os cotovelos enquanto retrai as escápulas, puxando o trenó em sua direção.
Dê um ou dois passos para trás para criar tensão na corda e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada no sled'),
  (md5('catalogo-exercicio:fedb:' || 'Suspended_Row')::uuid, 'Remada no TRX', 'Costas', null, 'OUTRO', 'Suspenda as tiras na altura do peito. Segure cada alça e incline-se para trás. Mantenha o corpo ereto, cabeça e peito altos, com os braços totalmente estendidos. Esta é a posição inicial.
Comece flexionando os cotovelos para puxar. Protraia as escápulas durante o movimento.
No final do movimento, faça uma pausa e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada no trx'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Rear_Delt_Row')::uuid, 'Remada para deltoide posterior com barra', 'Ombros', 'Barra', 'LIVRE', 'Fique em pé segurando uma barra com pegada larga (mais que a largura dos ombros) e pronada (palmas voltadas para o corpo).
Flexione levemente os joelhos e incline o tronco para frente, mantendo a curvatura natural das costas. Deixe os braços pendurados segurando a barra. Quando o tronco estiver paralelo ao chão, abra os cotovelos para os lados. Dica: O corpo deve formar um "T". Esta é a posição inicial.
Mantendo os braços superiores perpendiculares ao tronco, puxe a barra em direção ao peito superior, contraindo os deltóides posteriores e expirando. Dica: Foque nos deltóides; os braços devem agir como ganchos.
Retorne lentamente à posição inicial inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada para deltoide posterior com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Renegade_Row')::uuid, 'Remada renegada alternada', 'Costas', 'Kettlebell', 'LIVRE', 'Coloque dois kettlebells no chão com uma distância igual à largura dos ombros. Posicione-se na ponta dos pés e com as mãos, como em uma flexão, corpo reto e estendido. Use as alças dos kettlebells para apoiar a parte superior do corpo. Pode ser necessário afastar os pés para maior estabilidade.
Empurre um kettlebell no chão e faça a remada com o outro, retraindo a escápula do lado ativo ao flexionar o cotovelo, puxando-o para o lado do corpo.
Abaixe o kettlebell no chão e inicie a remada com a mão oposta. Repita por várias repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada renegada alternada'),
  (md5('catalogo-exercicio:fedb:' || 'Elevated_Cable_Rows')::uuid, 'Remada sentada na polia com assento elevado', 'Costas', 'Polia', 'MAQUINA', 'Use uma plataforma de 10 a 15 cm de altura e coloque-a no assento da máquina de remada sentada.
Sente-se na máquina e apoie os pés na plataforma frontal ou na barra, com os joelhos ligeiramente flexionados.
Incline o tronco para frente, mantendo a curvatura natural das costas, e segure a alça em V.
Com os braços estendidos, puxe até o tronco formar um ângulo de 90 graus com as pernas, costas ligeiramente arqueadas e peito para fora. Sinta o alongamento nas costas. Esta é a posição inicial.
Mantendo o tronco parado, puxe a alça em direção ao abdômen, mantendo os braços próximos ao corpo, até tocar a região abdominal. Expire durante o movimento e contraia as costas.
Segure a contração por um segundo e retorne lentamente à posição inicial, inspirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada sentada na polia com assento elevado'),
  (md5('catalogo-exercicio:fedb:' || 'Shotgun_Row')::uuid, 'Remada shotgun na polia', 'Costas', 'Polia', 'MAQUINA', 'Prenda uma alça única a uma polia baixa.
Após selecionar o peso correto, fique a alguns passos de distância com uma postura em afundo largo. O braço deve estar estendido e o ombro para frente. Esta será a posição inicial.
Execute o movimento retraindo o ombro e flexionando o cotovelo. Ao puxar, supine o pulso, girando a palma para cima.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada shotgun na polia');

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, instrucoes, fonte, nome_busca) values
  (md5('catalogo-exercicio:fedb:' || 'Bodyweight_Mid_Row')::uuid, 'Remada suspensa com peso corporal', 'Costas', null, 'OUTRO', 'Segure uma barra de pull-up com as mãos em uma pegada média a larga, palmas voltadas para fora. Da posição suspensa, dobre os joelhos em direção ao peito, incline-se para trás e passe as pernas sobre o lado do aparelho. Esta é a posição inicial.
Com os braços estendidos, flexione os cotovelos e retraia as escápulas para elevar o corpo até as pernas tocarem o aparelho.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada suspensa com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Row')::uuid, 'Remada unilateral com kettlebell', 'Costas', 'Kettlebell', 'LIVRE', 'Posicione um kettlebell na frente dos pés. Flexione levemente os joelhos e empurre o quadril para trás o máximo possível ao se inclinar para frente para assumir a posição inicial.
Segure o kettlebell e puxe-o em direção ao estômago, retraindo a escápula e flexionando o cotovelo. Mantenha as costas retas. Abaixe e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Iso_Row')::uuid, 'Remada unilateral na máquina articulada', 'Costas', 'Máquina', 'MAQUINA', 'Ajuste o peso e a altura do banco para que as alças fiquem na altura do peito. Segure-as com pegada neutra ou pronada. Esta é a posição inicial.
Puxe as alças em direção ao torso, retraindo as escápulas e flexionando os cotovelos.
Pause e retorne lentamente, evitando apoiar o peso completamente para manter a tensão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada unilateral na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Single-Arm_High_Pulley_Row')::uuid, 'Remada unilateral na polia alta ajoelhado', 'Costas', 'Polia', 'MAQUINA', 'Conecte uma alça única a uma polia alta e selecione o peso.
Ajoelhe-se em frente à torre, segurando o cabo com uma mão e o braço estendido. Esta é a posição inicial.
Com a palma inicialmente para frente, puxe o peso em direção ao torso flexionando o cotovelo e retraindo a escápula. Gire o pulso durante o movimento, terminando com a palma voltada para você.
Após uma breve pausa, retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remada unilateral na polia alta ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Rowing_Stationary')::uuid, 'Remo ergométrico', 'Cardio', 'Máquina', 'CARDIO', 'Sente-se no remo ergométrico. Apoie os calcanhares confortavelmente na base dos pedais e ajuste as alças. Selecione o programa desejado, se aplicável. Mantenha a coluna reta e incline o tronco para frente a partir dos quadris.
O movimento tem três fases: a primeira é quando você vai para frente, com os joelhos flexionados próximos ao peito e o tronco levemente inclinado, mantendo a postura. Em seguida, empurre os pedais com as pernas, estendendo-as, e traga as mãos em direção ao abdômen superior, puxando os ombros para trás. Use principalmente as pernas e quadris para evitar sobrecarregar as costas.
Na fase de recuperação, estique os braços, flexione os joelhos e retorne o corpo à posição inicial, reiniciando o ciclo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'remo ergometrico'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Head_Harness_Neck_Resistance')::uuid, 'Resistência de pescoço com cinta sentado', 'Pescoço', null, 'OUTRO', 'Sente-se em um banco com os pés mais afastados que a largura dos ombros, dedos apontados para fora. Incline o tronco para frente até quase paralelo ao chão e posicione a cinta de pescoço na cabeça.
Volte o tronco para uma posição quase perpendicular, segurando o peso com as duas mãos. Coloque as mãos nos joelhos. Esta é a posição inicial.
Abaixe o pescoço até o queixo tocar o peito, inspirando.
Volte o pescoço à posição inicial, expirando.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'resistencia de pescoco com cinta sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Return_Push_from_Stance')::uuid, 'Retorno de arremesso da posição', 'Ombros', 'Medicine ball', 'OUTRO', 'Você precisará de um parceiro para este exercício.
Comece em uma posição atlética de 2 ou 3 pontos de apoio.
Ao sinal, mova-se para uma posição para receber o passe do seu parceiro.
Agarre a medicine ball com as duas mãos e imediatamente arremesse-a de volta ao seu parceiro.
Você pode modificar este exercício correndo rotas diferentes.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'retorno de arremesso da posicao'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Hyperextension')::uuid, 'Reverse hyperextension', 'Posterior', 'Máquina', 'MAQUINA', 'Posicione os pés entre as almofadas após colocar o peso adequado. Deite-se na almofada superior, com os quadris para fora da borda, e segure as alças para se firmar.
Para iniciar o movimento, flexione os quadris, puxando as pernas para frente.
Inverta o movimento estendendo os quadris, empurrando as pernas para trás. É importante não hiperestender o quadril; pare antes do limite máximo da amplitude.
Retorne flexionando os quadris novamente, puxando o carrinho o mais para frente possível.
Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'reverse hyperextension'),
  (md5('catalogo-exercicio:fedb:' || 'Ab_Roller')::uuid, 'Roda abdominal', 'Abdômen', null, 'OUTRO', 'Segure a roda abdominal com as duas mãos e ajoelhe-se no chão.
Coloque a roda no chão à sua frente, ficando na posição de quatro apoios (como em uma flexão de joelhos). Esta é a posição inicial.
Role a roda lentamente para frente, esticando o corpo em uma posição reta. Dica: Desça o máximo possível sem tocar o chão com o corpo. Inspire durante esta parte do movimento.
Após uma pausa na posição esticada, puxe-se de volta à posição inicial enquanto expira. Dica: Vá devagar e mantenha os abdominais contraídos o tempo todo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'roda abdominal'),
  (md5('catalogo-exercicio:fedb:' || 'Alternate_Incline_Dumbbell_Curl')::uuid, 'Rosca alternada no banco inclinado', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado com um halter em cada mão, mantendo os braços estendidos. Dica: Mantenha os cotovelos próximos ao torso. Esta é a posição inicial.
Mantendo a parte superior do braço parada, flexione o halter direito para frente, contraindo o bíceps enquanto expira. Gire a mão para que a palma fique voltada para cima. Continue até o bíceps estar totalmente contraído e o halter na altura do ombro. Segure a posição contraída por um segundo, apertando o bíceps. Dica: Apenas os antebraços devem se mover.
Volte lentamente o halter à posição inicial enquanto inspira.
Repita o movimento com a mão esquerda. Isso equivale a uma repetição.
Continue alternando dessa forma pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca alternada no banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Dumbbell_Inner_Biceps_Curl')::uuid, 'Rosca alternada sentada com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se na ponta de um banco reto com um halter em cada mão, mantendo os braços estendidos. Os cotovelos devem ficar próximos ao torso.
Gire as palmas das mãos para que fiquem voltadas para dentro, em uma posição neutra. Esta será a posição inicial.
Mantendo a parte superior dos braços parada, flexione os halteres para fora e para cima, girando as palmas para fora durante o levantamento e mantendo os antebraços alinhados com os deltoides externos. Dica:
Apenas os antebraços devem se mover. Continue até que o bíceps esteja totalmente contraído e os halteres estejam na altura dos ombros. Segure a posição contraída por um segundo, apertando o bíceps.
Volte lentamente à posição inicial enquanto inspira. Lembre-se de girar os braços ao baixar os halteres para retornar à pegada neutra.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca alternada sentada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Machine_Bicep_Curl')::uuid, 'Rosca bíceps na máquina', 'Bíceps', 'Máquina', 'MAQUINA', 'Ajuste o banco à altura adequada e selecione o peso. Apoie os braços superiores nas almofadas e segure as alças. Esta será sua posição inicial.
Flexione os cotovelos, puxando os antebraços em direção aos braços superiores.
Faça uma pausa no topo do movimento e retorne lentamente o peso à posição inicial.
Evite retornar o peso completamente até o final do conjunto para manter a tensão nos músculos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca biceps na maquina'),
  (md5('catalogo-exercicio:fedb:' || 'High_Cable_Curls')::uuid, 'Rosca bíceps na polia alta', 'Bíceps', 'Polia', 'MAQUINA', 'Fique entre duas polias altas e segure uma alça em cada mão. Posicione os braços superiores paralelos ao chão, com as palmas voltadas para você. Esta é a posição inicial.
Flexione os braços trazendo as alças em direção às orelhas, contraindo os bíceps e expirando. Mantenha os braços superiores imóveis, movendo apenas os antebraços. Segure por um segundo na posição contraída.
Retorne lentamente os braços à posição inicial.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca biceps na polia alta'),
  (md5('catalogo-exercicio:fedb:' || 'Overhead_Cable_Curl')::uuid, 'Rosca bíceps na polia alta duplo bíceps', 'Bíceps', 'Polia', 'MAQUINA', 'Ajuste o peso nas polias laterais, garantindo que seja igual em ambos os lados, e posicione as polias acima da altura dos ombros.
Fique no centro, segure as alças com pegada supinada (palmas para cima), braços estendidos e paralelos ao chão, pés na largura dos ombros.
Expire e contraia os bíceps, trazendo os antebraços até tocarem os bíceps.
Inspire e retorne os antebraços à posição inicial, mantendo o corpo imóvel.
Repita as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca biceps na polia alta duplo biceps'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_One-Arm_Cable_Curl')::uuid, 'Rosca bíceps unilateral na polia', 'Bíceps', 'Polia', 'MAQUINA', 'Comece segurando uma alça única próximo à máquina de cabo baixo. Certifique-se de estar suficientemente distante da máquina para que o braço suporte o peso.
Mantenha o braço superior estacionário, perpendicular ao chão, com os cotovelos para dentro e as palmas voltadas para frente. A mão que não está levantando deve segurar a cintura para ajudar no equilíbrio.
Comece a flexionar a alça para cima lentamente, mantendo o braço superior imóvel, até o antebraço tocar o bíceps, enquanto expira. Dica: Apenas o antebraço deve se mover.
Segure a posição de contração ao apertar o bíceps e depois abaixe a alça de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.
Troque de braço ao executar este exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca biceps unilateral na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Curls_Lying_Against_An_Incline')::uuid, 'Rosca com barra no banco inclinado', 'Bíceps', 'Barra', 'LIVRE', 'Deite-se em um banco inclinado, com os braços segurando uma barra e pendurados em linha horizontal. Esta será sua posição inicial.
Mantendo os braços superiores parados, curve o peso o mais alto possível enquanto contrai o bíceps, expirando. Apenas os antebraços devem se mover.
Após uma contração, volte lentamente à posição inicial enquanto inspira, certificando-se de descer completamente.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca com barra no banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'EZ-Bar_Curl')::uuid, 'Rosca com barra W', 'Bíceps', 'Barra W', 'LIVRE', 'Fique em pé segurando uma barra W nas alças externas mais largas, com as palmas das mãos voltadas para frente e ligeiramente inclinadas para dentro devido ao formato da barra. Mantenha os cotovelos próximos ao torso. Esta será sua posição inicial.
Mantendo a parte superior dos braços parada, expire e faça a rosca para frente contraindo o bíceps, movendo apenas os antebraços.
Continue levantando o peso até o bíceps estar totalmente contraído e a barra estiver na altura dos ombros. Segure a posição contraída por um momento e aperte o bíceps.
Então, inspire e abaixe lentamente a barra de volta à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca com barra w'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_EZ_Bar_Curl')::uuid, 'Rosca com barra W pegada fechada', 'Bíceps', 'Barra', 'LIVRE', 'Fique em pé com o torso ereto, segurando uma barra W na pegada interna mais próxima. As palmas das mãos devem estar voltadas para a frente e ligeiramente inclinadas para dentro devido ao formato da barra. Os cotovelos devem ficar próximos ao torso. Esta será sua posição inicial.
Mantendo a parte superior dos braços parada, curve os pesos para a frente enquanto contrai os bíceps e expira. Dica: Apenas os antebraços devem se mover.
Continue o movimento até os bíceps estarem totalmente contraídos e a barra estiver na altura dos ombros. Segure a posição contraída por um segundo e contraia os bíceps com força.
Lentamente, comece a trazer a barra de volta à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca com barra w pegada fechada'),
  (md5('catalogo-exercicio:fedb:' || 'Concentration_Curls')::uuid, 'Rosca concentrada com halter', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco plano com um halter entre as pernas. As pernas devem estar afastadas, joelhos flexionados e pés no chão.
Com o braço direito, segure o halter. Apoie a parte de trás do braço direito na parte interna da coxa direita, com a palma da mão voltada para frente. O braço deve estar estendido e o halter acima do chão. Esta é a posição inicial.
Mantendo o braço superior parado, flexione o halter contraindo o bíceps enquanto expira. Apenas o antebraço deve se mover. Continue até o bíceps estar totalmente contraído e o halter na altura do ombro. Na parte alta, o dedo mínimo deve estar acima do polegar para uma boa contração. Segure a contração por um segundo.
Volte lentamente à posição inicial enquanto inspira. Evite balançar.
Repita as repetições recomendadas e depois faça com o braço esquerdo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca concentrada com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Concentration_Curl')::uuid, 'Rosca concentrada em pé com halter', 'Bíceps', 'Halteres', 'LIVRE', 'Segure um halter com a mão de trabalho e incline-se para frente. Deixe o braço pendendo perpendicular ao chão, com o cotovelo apontando para fora. Esta é a posição inicial.
Dobre o cotovelo para levantar o peso, mantendo a parte superior do braço imóvel. No topo, contraia o bíceps e faça uma pausa.
Abaixe o halter de volta à posição inicial.
Repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca concentrada em pe com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Close-Grip_Concentration_Barbell_Curl')::uuid, 'Rosca concentrada sentado com barra', 'Bíceps', 'Barra', 'LIVRE', 'Sente-se em um banco plano com uma barra entre as pernas. As pernas devem estar abertas, com joelhos flexionados e pés no chão.
Pegue a barra e apoie a parte de trás dos braços nas coxas (cerca de 9 cm dos joelhos). Use uma pegada supinada mais fechada que a largura dos ombros. O braço deve estar estendido e a barra acima do chão. Esta é a posição inicial.
Mantenha os braços imóveis e curve a barra para frente, contraindo o bíceps. Expire. Apenas os antebraços se movem.
Contraia totalmente o bíceps e segure por um segundo.
Retorne lentamente a barra à posição inicial enquanto inspira. Evite balançar.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca concentrada sentado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Finger_Curls')::uuid, 'Rosca de dedos', 'Antebraço', 'Barra', 'LIVRE', 'Segure uma barra com as duas mãos e as palmas voltadas para cima, mãos na largura dos ombros.
Mantenha os pés apoiados no chão, ligeiramente mais afastados que a largura dos ombros. Esta será sua posição inicial.
Abaixe a barra o máximo possível estendendo os dedos, deixando-a rolar até as pontas dos dedos.
Enrole a barra para cima fechando as mãos enquanto expira. Segure a contração no topo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca de dedos'),
  (md5('catalogo-exercicio:fedb:' || 'Wrist_Roller')::uuid, 'Rosca de punho no rolo', 'Antebraço', null, 'OUTRO', 'Para começar, fique em pé segurando um rolo de punho com pegada pronada (palmas para baixo). Os pés devem estar na largura dos ombros.
Levante os braços lentamente até ficarem totalmente estendidos e paralelos ao chão à sua frente. Nota: Certifique-se de que a corda não esteja enrolada no rolo. Todo o corpo deve ficar parado, exceto os antebraços. Esta é a posição inicial.
Gire um punho de cada vez para cima, enrolando a corda no rolo e levantando o peso até a barra.
Quando o peso chegar à barra, comece a baixá-lo lentamente girando o punho para baixo até voltar à posição inicial.
Repita para a quantidade prescrita de repetições no seu programa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca de punho no rolo'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Standing_Barbell_Curl')::uuid, 'Rosca direta com barra pegada aberta', 'Bíceps', 'Barra', 'LIVRE', 'Fique em pé com o tronco ereto, segurando uma barra com as mãos na pegada aberta. As palmas devem estar voltadas para frente e os cotovelos próximos ao corpo. Esta é a posição inicial.
Mantendo a parte superior dos braços parada, flexione os pesos para frente contraindo o bíceps enquanto expira. Dica: Apenas os antebraços devem se mover.
Continue o movimento até o bíceps estar totalmente contraído e a barra na altura dos ombros. Segure a posição contraída por um segundo e aperte o bíceps com força.
Lentamente, retorne a barra à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca direta com barra pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_Standing_Barbell_Curl')::uuid, 'Rosca direta com barra pegada fechada', 'Bíceps', 'Barra', 'LIVRE', 'Segure uma barra com as duas mãos, palmas para cima e a alguns centímetros de distância.
Fique em pé com o torso reto e a cabeça erguida. Os pés devem estar na largura dos ombros e os cotovelos próximos ao torso. Esta será sua posição inicial. Dica: Mantenha a parte superior dos braços e os cotovelos parados durante todo o movimento.
Curve a barra para cima em um movimento semicircular até os antebraços tocarem os bíceps. Expire ao executar esta parte e contraia os bíceps com força por um segundo no topo. Dica: Evite curvar as costas ou usar balanço; apenas os antebraços devem se mover.
Volte lentamente à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca direta com barra pegada fechada'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Bicep_Curl')::uuid, 'Rosca direta com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé, ereto, com um halter em cada mão e os braços estendidos. Mantenha os cotovelos próximos ao tronco e gire as palmas das mãos até ficarem voltadas para frente. Esta será a posição inicial.
Mantendo a parte superior dos braços parada, expire e faça a rosca dos pesos enquanto contrai os bíceps. Continue levantando até que os bíceps estejam totalmente contraídos e os halteres na altura dos ombros. Segure a posição contraída por um breve instante, apertando os bíceps.
Em seguida, inspire e comece a baixar os halteres lentamente de volta à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca direta com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Biceps_Cable_Curl')::uuid, 'Rosca direta na polia', 'Bíceps', 'Polia', 'MAQUINA', 'Fique em pé com o tronco ereto, segurando uma barra de rosca presa a uma polia baixa. Segure a barra na largura dos ombros e mantenha os cotovelos próximos ao torso, com as palmas viradas para cima (pegada supinada). Esta é a posição inicial.
Mantendo os braços superiores parados, flexione os pesos contraindo o bíceps enquanto expira. Apenas os antebraços devem se mover. Continue até que o bíceps esteja totalmente contraído e a barra esteja na altura dos ombros. Segure a contração por um segundo, apertando o músculo.
Comece a retornar a barra lentamente à posição inicial, inspirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca direta na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Drag_Curl')::uuid, 'Rosca drag', 'Bíceps', 'Barra', 'LIVRE', 'Segure uma barra com pegada supinada (palmas para frente), cotovelos próximos ao tronco e levemente para trás. Esta é a posição inicial.
Expire e flexione os braços, arrastando a barra para cima em contato com o torso, mantendo os cotovelos para trás e os ombros baixos.
Volte lentamente à posição inicial, mantendo a barra em contato com o torso.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca drag'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_EZ-Bar_Curl_with_Band')::uuid, 'Rosca fechada com barra W e elástico', 'Bíceps', 'Barra W', 'LIVRE', 'Prenda uma banda em cada ponta da barra. Segure a barra, colocando um pé no meio da banda. Fique em pé com uma pegada fechada e supinada na barra W. Os cotovelos devem ficar próximos ao torso. Esta será sua posição inicial.
Mantendo a parte superior dos braços parada, flexione os cotovelos para executar a rosca. Expire enquanto levanta o peso.
Continue o movimento até os bíceps estarem totalmente contraídos e a barra estiver na altura dos ombros. Segure a posição contraída por um segundo e contraia os bíceps com força.
Lentamente, comece a trazer a barra de volta à posição inicial enquanto inspira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca fechada com barra w e elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Close-Grip_Bar_Curl_On_High_Pulley')::uuid, 'Rosca fechada na polia alta deitado', 'Bíceps', 'Polia', 'MAQUINA', 'Coloque um banco plano em frente a uma polia alta ou máquina de pulley.
Segure a barra reta com uma pegada supinada (palmas para cima) na largura dos ombros.
Deite-se de costas com a cabeça além da extremidade do banco.
Estenda os braços retos acima dos ombros. O tronco e os braços devem formar um ângulo de 90 graus, com os cotovelos para dentro. Esta será a posição inicial.
Ao expirar, curve a barra em um movimento semicircular até tocar o queixo. Contraia o bíceps por um segundo no topo. Dica: Apenas os antebraços devem se mover; a parte superior dos braços permanece perpendicular.
Retorne à posição inicial lentamente.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca fechada na polia alta deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Prone_Incline_Curl')::uuid, 'Rosca inclinada com halteres deitado', 'Bíceps', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e deite-se de bruços em um banco inclinado, com os ombros próximos ao topo. Os joelhos podem apoiar no banco ou as pernas ficar abertas.
Deixe os braços estendidos e pendurados naturalmente à frente, perpendiculares ao chão.
Mantenha os cotovelos junto ao corpo e as palmas das mãos voltadas para frente. Esta é a posição inicial.
Expire e contraia o bíceps para levantar os halteres até os braços ficarem totalmente flexionados, movendo apenas os antebraços.
Inspire e abaixe os halteres até os braços ficarem totalmente estendidos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca inclinada com halteres deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Inner_Biceps_Curl')::uuid, 'Rosca inclinada para bíceps interno', 'Bíceps', 'Halteres', 'LIVRE', 'Segure um haltere em cada mão e deite-se em um banco inclinado.
Os halteres devem estar estendidos ao lado do corpo com as palmas voltadas para fora. Esta é a posição inicial.
Expire e curve os pesos para fora e para cima, mantendo os antebraços alinhados com os deltoides laterais. Continue até os halteres estarem na altura dos ombros e ao lado dos deltoides, como na pose de bíceps duplo.
Após uma contração no topo, inspire e abaixe os pesos lentamente pelo mesmo caminho.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca inclinada para biceps interno'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Barbell_Curl')::uuid, 'Rosca inversa com barra', 'Bíceps', 'Barra', 'LIVRE', 'Fique em pé com o tronco ereto, segurando uma barra na largura dos ombros, com os cotovelos próximos ao corpo e as palmas voltadas para baixo (pegada pronada). Esta é a posição inicial.
Mantendo a parte superior dos braços parada, flexione os pesos contraindo o bíceps enquanto expira. Apenas os antebraços devem se mover. Continue até o bíceps estar totalmente contraído e a barra na altura dos ombros. Segure a contração por um segundo.
Volte lentamente à posição inicial enquanto inspira.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca inversa com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Reverse_Curl')::uuid, 'Rosca inversa com halteres em pé', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé, segurando um halter em cada mão com pegada pronada (palmas para baixo). Braços totalmente estendidos e pés na largura dos ombros. Esta é a posição inicial.
Mantendo a parte superior dos braços imóvel, curve os pesos contraindo o bíceps ao expirar. Apenas os antebraços devem se mover. Continue até o bíceps estar totalmente contraído e os halteres na altura dos ombros. Segure a contração por um segundo.
Volte lentamente à posição inicial ao inspirar.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca inversa com halteres em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Cable_Curl')::uuid, 'Rosca inversa na polia', 'Bíceps', 'Polia', 'MAQUINA', 'Fique em pé com o tronco ereto, segurando uma barra presa a uma polia baixa, com pegada pronada na largura dos ombros e cotovelos próximos ao corpo. Esta é a posição inicial.
Mantendo a parte superior dos braços parada, flexione os pesos contraindo o bíceps enquanto expira. Apenas os antebraços devem se mover. Continue até o bíceps estar totalmente contraído e a barra na altura dos ombros. Segure a contração por um segundo.
Volte lentamente à posição inicial enquanto inspira.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca inversa na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Plate_Curls')::uuid, 'Rosca invertida com anilha', 'Bíceps', null, 'OUTRO', 'Fique em pé, segurando uma anilha com ambas as mãos e os braços totalmente estendidos. Use uma pegada pronada (palmas voltadas para baixo), com os dedos na parte áspera da anilha e o polegar na parte lisa. Dica: Para melhores resultados, segure a anilha nas posições de 11h e 1h.
Os pés devem estar afastados na largura dos ombros, e a anilha próxima à região da virilha. Esta é a posição inicial.
Levante lentamente a anilha mantendo os cotovelos fixos e os braços superiores imóveis, até o bíceps e o antebraço se tocarem, enquanto expira. A anilha deve ficar alinhada com o tronco.
Sinta a contração por um segundo e abaixe o peso de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca invertida com anilha'),
  (md5('catalogo-exercicio:fedb:' || 'Alternate_Hammer_Curl')::uuid, 'Rosca martelo alternada', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé com o tronco ereto e um halter em cada mão, mantidos ao longo do corpo. Os cotovelos devem ficar próximos ao torso.
As palmas das mãos devem estar voltadas para o torso. Esta é a posição inicial.
Mantendo o braço superior parado, curve o peso direito para frente enquanto contrai o bíceps e expira. Continue até o bíceps estar totalmente contraído e o halter na altura do ombro. Segure a posição contraída por um segundo, apertando o bíceps. Dica: Apenas os antebraços devem se mover.
Lentamente, retorne o halter à posição inicial enquanto inspira.
Repita o movimento com a mão esquerda. Isso equivale a uma repetição.
Continue alternando para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo alternada'),
  (md5('catalogo-exercicio:fedb:' || 'Hammer_Curls')::uuid, 'Rosca martelo com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé com o torso ereto e um halter em cada mão, mantidos ao longo do corpo. Os cotovelos devem ficar próximos ao torso.
As palmas das mãos devem estar voltadas para o torso. Esta será sua posição inicial.
Mantendo o braço superior parado, expire e curve o peso para cima, contraindo o bíceps. Continue levantando até que o bíceps esteja totalmente contraído e o halter esteja na altura do ombro. Segure a posição contraída por um momento, apertando o bíceps. Dica: Foque em manter o cotovelo parado e movimentar apenas o antebraço.
Após a pausa, inspire e comece a abaixar os halteres lentamente de volta à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Cross_Body_Hammer_Curl')::uuid, 'Rosca martelo cruzada com halter', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé com um halter em cada mão, braços estendidos ao lado do corpo e palmas voltadas para dentro.
Com as palmas ainda voltadas para dentro, flexione o halter direito em direção ao ombro esquerdo enquanto expira, sem torcer o braço. Toque o halter no ombro e segure a contração por um segundo.
Volte lentamente à posição inicial inspirando e repita com o braço esquerdo.
Continue alternando até completar as repetições para cada braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo cruzada com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Inner-Biceps_Curl')::uuid, 'Rosca martelo em pé', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé com um halter em cada mão ao lado do corpo, pés na largura dos ombros e palmas voltadas para dentro.
Mantendo os braços superiores imóveis, flexione os halteres para cima, girando os pulsos até as palmas ficarem voltadas para cima.
Contraia os bíceps totalmente e segure por um segundo.
Abaixe os halteres lentamente, girando os pulsos de volta à posição neutra.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Hammer_Curls_-_Rope_Attachment')::uuid, 'Rosca martelo na polia com corda', 'Bíceps', 'Polia', 'MAQUINA', 'Prenda uma corda na polia baixa e fique de frente para a máquina, a cerca de 30 cm de distância.
Segure a corda com pegada neutra (palmas voltadas uma para a outra) e mantenha a postura ereta.
Mantenha os cotovelos junto ao corpo, fixos. Esta é a posição inicial.
Puxe os braços com os bíceps até tocarem os antebraços, expirando.
Contraia os bíceps por um segundo e retorne lentamente à posição inicial.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo na polia com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Hammer_Curls')::uuid, 'Rosca martelo no banco inclinado', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado com um haltere em cada mão, costas firmes contra o encosto e pés juntos. Deixe os halteres pendurados ao lado do corpo com pegada neutra (palmas voltadas uma para a outra). Esta é a posição inicial.
Flexione os cotovelos, mantendo a parte superior dos braços parada.
Continue até o topo do movimento, pause e retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca martelo no banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Cable_Curl')::uuid, 'Rosca na polia deitado', 'Bíceps', 'Polia', 'MAQUINA', 'Segure uma barra reta ou barra W presa à polia baixa com as duas mãos, usando uma pegada supinada (palmas para cima) na largura dos ombros.
Deite-se de costas em um colchonete em frente à pilha de pesos, com os pés apoiados na estrutura da máquina e as pernas estendidas.
Com os braços estendidos e os cotovelos próximos ao corpo, dobre levemente os braços. Esta será a posição inicial.
Mantendo a parte superior dos braços parada e os cotovelos próximos ao corpo, curve a barra lentamente em direção ao peito enquanto expira e contrai o bíceps.
Após uma contração no topo, retorne lentamente à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca na polia deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Flexor_Incline_Dumbbell_Curls')::uuid, 'Rosca no banco inclinado 45º com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado a 45 graus segurando um halter em cada mão, com os braços estendidos ao lado do corpo e as palmas voltadas para frente.
Mantenha os pulsos neutros para evitar estresse. Esta é a posição inicial.
Faça a rosca simultaneamente com os dois halteres até a contração total do bíceps, expirando. Segure a contração por um segundo no topo.
Inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca no banco inclinado 45º com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Dumbbell_Curl')::uuid, 'Rosca no banco inclinado com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco inclinado com um haltere em cada mão, mantendo os braços estendidos ao lado do corpo. Mantenha os cotovelos próximos ao tronco e gire os punhos até as palmas das mãos ficarem voltadas para a frente. Esta é a posição inicial.
Mantendo a parte superior dos braços parada, flexione os cotovelos e levante os halteres contraindo o bíceps enquanto expira. Apenas os antebraços devem se mover. Continue até o bíceps estar totalmente contraído e os halteres na altura dos ombros. Segure a posição contraída por um segundo.
Volte lentamente à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca no banco inclinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Palm-Up_Barbell_Wrist_Curl')::uuid, 'Rosca punho com barra sentado', 'Antebraço', 'Barra', 'LIVRE', 'Segure uma barra com ambas as mãos, palmas para cima e mãos na largura dos ombros. Incline-se para frente e apoie os antebraços nas coxas, com os pulsos sobre os joelhos. Esta é a posição inicial.
Abaixe a barra o máximo possível, inspirando.
Curle a barra para cima o máximo possível, flexionando os antebraços e expirando. Segure a contração no topo por um segundo. Movimente apenas o punho.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho com barra sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Dumbbell_Palms-Up_Wrist_Curl')::uuid, 'Rosca punho com halteres sentado', 'Antebraço', 'Halteres', 'LIVRE', 'Comece colocando dois halteres no chão em frente a um banco reto.
Sente-se na borda do banco com as pernas afastadas na largura dos ombros. Mantenha os pés no chão.
Pegue os halteres com os braços e posicione-os de modo que os antebraços apoiem nas coxas, com as palmas das mãos voltadas para cima. Os pulsos devem ficar suspensos além da borda das coxas.
Inicie flexionando os pulsos para cima e expire.
Abaixe lentamente os pulsos de volta à posição inicial enquanto inspira. Certifique-se de inspirar nesta parte do exercício. Dica: Os antebraços devem ficar parados, pois apenas o pulso se move.
Repita para a quantidade recomendada de repetições.
Ao terminar, simplesmente abaixe os halteres no chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho com halteres sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Palms-Down_Barbell_Wrist_Curl')::uuid, 'Rosca punho inversa com barra sentado', 'Antebraço', 'Barra', 'LIVRE', 'Segure uma barra com as duas mãos e as palmas viradas para baixo; mãos afastadas na largura dos ombros.
Coloque os pés apoiados no chão, ligeiramente mais afastados que a largura dos ombros.
Incline-se para frente e apoie os antebraços sobre as coxas, com as palmas para baixo. Dica: Certifique-se de que as costas dos pulsos fiquem sobre os joelhos. Esta será a posição inicial.
Abaixe a barra o máximo possível enquanto inspira e mantém a pegada firme.
Enrole a barra para cima o mais alto possível, flexionando os antebraços e expirando. Segure a contração no topo por um segundo. Dica: Apenas os pulsos devem se mover.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho inversa com barra sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_One-Arm_Dumbbell_Palms-Down_Wrist_Curl')::uuid, 'Rosca punho inversa com halter sentado', 'Antebraço', 'Halteres', 'LIVRE', 'Sente-se em um banco com um halter na mão direita. Incline-se para frente e apoie o antebraço direito na coxa direita, com a palma da mão para baixo e o pulso sobre os joelhos. Esta é a posição inicial.
Abaixe o halter o máximo possível, inspirando.
Curle o halter para cima o máximo possível, contraindo os antebraços e expirando. Segure a contração por um segundo. Movimente apenas o punho.
Faça as repetições recomendadas, troque de braço e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho inversa com halter sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Dumbbell_Palms-Down_Wrist_Curl')::uuid, 'Rosca punho inversa com halteres sentado', 'Antebraço', 'Halteres', 'LIVRE', 'Comece colocando dois halteres no chão em frente a um banco reto.
Sente-se na borda do banco com as pernas afastadas na largura dos ombros. Mantenha os pés no chão.
Pegue os halteres com os braços e posicione-os de modo que os antebraços apoiem nas coxas, com as palmas das mãos voltadas para baixo. Os pulsos devem ficar suspensos além da borda das coxas.
Inicie flexionando os pulsos para cima e expire.
Abaixe lentamente os pulsos de volta à posição inicial enquanto inspira. Certifique-se de inspirar nesta parte do exercício. Dica: Os antebraços devem ficar parados, pois apenas o pulso se move.
Repita para a quantidade recomendada de repetições.
Ao terminar, simplesmente abaixe os halteres no chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho inversa com halteres sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Palms-Down_Wrist_Curl_Over_A_Bench')::uuid, 'Rosca punho inversa no banco com barra', 'Antebraço', 'Barra', 'LIVRE', 'Coloque uma barra de um lado de um banco plano.
Ajoelhe-se de frente para o banco.
Segure a barra com uma pegada pronada (palmas para baixo) e apoie os antebraços no banco, com os pulsos para fora da borda.
Enrole os punhos para cima, expirando.
Abaixe os punhos lentamente à posição inicial, inspirando.
Mantenha os antebraços imóveis, movendo apenas os punhos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho inversa no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench')::uuid, 'Rosca punho inversa no banco com halteres', 'Antebraço', 'Halteres', 'LIVRE', 'Coloque dois halteres de um lado de um banco plano.
Ajoelhe-se de frente para o banco.
Segure os halteres com uma pegada pronada (palmas para baixo) e apoie os antebraços no banco, com os pulsos para fora da borda.
Enrole os punhos para cima, expirando.
Abaixe os punhos lentamente à posição inicial, inspirando.
Mantenha os antebraços imóveis, movendo apenas os punhos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho inversa no banco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Wrist_Curl')::uuid, 'Rosca punho na polia', 'Antebraço', 'Polia', 'MAQUINA', 'Coloque um banco plano em frente a uma polia baixa com uma barra reta acoplada.
Segure a barra com uma pegada supinada (palmas para cima) e apoie os antebraços sobre as coxas, com os pulsos além dos joelhos. Esta é a posição inicial.
Flexione os punhos para cima enquanto expira, mantendo a contração por um segundo.
Abaixe os punhos lentamente à posição inicial enquanto inspira.
Mantenha os antebraços imóveis; apenas os punhos devem se mover.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl')::uuid, 'Rosca punho na polia baixa sentado', 'Antebraço', 'Polia', 'MAQUINA', 'Coloque um banco na frente de uma máquina de polia baixa com uma barra ou acessório de rosca EZ.
Afaste o banco o suficiente para que, ao trazer a alça para o topo das coxas, haja tensão no cabo devido ao peso ser levantado.
Segure a alça com as duas mãos, palmas para cima, usando uma pegada na largura dos ombros.
Dê um passo para trás e sente-se no banco com os pés afastados na largura dos ombros, firmes no chão.
Incline-se para frente e apoie os antebraços nas coxas, com as costas dos pulsos sobre os joelhos. Esta será a posição inicial.
Abaixe a barra o máximo possível, inspirando e mantendo a pegada firme.
Enrole a barra para cima o mais alto possível, contraindo os antebraços. Dica: Apenas os pulsos devem se mover; não os antebraços.
Após uma breve contração no topo, volte à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho na polia baixa sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench')::uuid, 'Rosca punho no banco com barra', 'Antebraço', 'Barra', 'LIVRE', 'Coloque uma barra de um lado de um banco plano.
Ajoelhe-se de frente para o banco.
Segure a barra com uma pegada supinada (palmas para cima) e apoie os antebraços no banco, com os pulsos para fora da borda.
Enrole os punhos para cima, expirando.
Abaixe os punhos lentamente à posição inicial, inspirando.
Mantenha os antebraços imóveis, movendo apenas os punhos.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench')::uuid, 'Rosca punho no banco com halteres', 'Antebraço', 'Halteres', 'LIVRE', 'Coloque dois halteres de um lado de um banco plano.
Ajoelhe-se com os dois joelhos, de frente para o banco.
Segure os halteres com as palmas para cima e apoie os antebraços no banco, com os pulsos para fora da borda.
Enrole os pulsos para cima, expirando.
Abaixe os pulsos lentamente à posição inicial, inspirando.
Mantenha os antebraços imóveis, movendo apenas os pulsos.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho no banco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl')::uuid, 'Rosca punho por trás com barra', 'Antebraço', 'Barra', 'LIVRE', 'Comece em pé segurando uma barra atrás dos glúteos com os braços estendidos, usando uma pegada pronada (palmas voltadas para trás, afastadas dos glúteos), com as mãos na largura dos ombros.
Olhe para frente e mantenha os pés na largura dos ombros. Esta é a posição inicial.
Enquanto expira, eleve lentamente a barra flexionando os punhos em um movimento semicircular em direção ao teto. Nota: Apenas os punhos devem se mover neste exercício.
Segure a contração por um segundo e abaixe a barra de volta à posição inicial enquanto inspira.
Repita para a quantidade recomendada de repetições.
Ao terminar, abaixe a barra no suporte ou no chão flexionando os joelhos. Dica: É mais fácil pegá-la de um suporte ou com a ajuda de um parceiro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho por tras com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl')::uuid, 'Rosca punho unilateral com halter sentado', 'Antebraço', 'Halteres', 'LIVRE', 'Sente-se em um banco com um halter na mão direita. Incline-se para frente e apoie o antebraço direito na coxa direita, com a palma da mão para cima e o pulso sobre os joelhos. Esta é a posição inicial.
Abaixe o halter o máximo possível, inspirando.
Curle o halter para cima o máximo possível, contraindo os antebraços e expirando. Segure a contração por um segundo. Movimente apenas o punho.
Faça as repetições recomendadas, troque de braço e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca punho unilateral com halter sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_High_Bench_Barbell_Curl')::uuid, 'Rosca Scott com barra deitado', 'Bíceps', 'Barra', 'LIVRE', 'Deite-se de bruços em um banco alto segurando uma barra com pegada supinada (palmas para cima). Dica: Se usar uma barra reta, segure-a com uma pegada na largura dos ombros; se usar uma barra W, segure nas alças internas. Posicione o torso de modo que o peito superior fique sobre a extremidade do banco e a barra pendurada à sua frente, com os braços estendidos e perpendiculares ao chão. Esta será sua posição inicial.
Mantendo os cotovelos fixos e a parte superior dos braços estacionária, curve o peso para cima em um movimento semicircular enquanto contrai o bíceps e expira. Segure no topo do movimento por um segundo.
Ao inspirar, retorne lentamente à posição inicial. Dica: Mantenha controle total do peso e evite balanços. Apenas os antebraços devem se mover.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott com barra deitado'),
  (md5('catalogo-exercicio:fedb:' || 'Preacher_Curl')::uuid, 'Rosca Scott com barra W', 'Bíceps', 'Barra', 'LIVRE', 'Use um banco Scott e uma barra W. Segure a barra na pegada interna próxima (peça para alguém entregar ou pegue do suporte). Palmas para frente, ligeiramente inclinadas para dentro devido ao formato da barra.
Com os braços superiores apoiados na almofada do banco e o peito contra ela, segure a barra na altura dos ombros. Esta é a posição inicial.
Inspire e abaixe a barra lentamente até o braço ficar estendido e o bíceps alongado.
Exale e use o bíceps para levantar o peso até a contração total, barra na altura dos ombros. Segure por um segundo.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott com barra w'),
  (md5('catalogo-exercicio:fedb:' || 'Two-Arm_Dumbbell_Preacher_Curl')::uuid, 'Rosca Scott com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e apoie os braços superiores no banco Scott ou em um banco inclinado. Os halteres devem estar na altura dos ombros. Esta é a posição inicial.
Inspire e abaixe lentamente os halteres até os braços estarem estendidos e o bíceps totalmente alongado.
Expire e use o bíceps para levantar os pesos até a contração total, com os halteres na altura dos ombros.
Contraia o bíceps fortemente por um segundo na posição contraída e repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Supine_Dumbbell_Curl')::uuid, 'Rosca Scott deitado com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Deite-se de costas em um banco plano, segurando um halter em cada mão sobre as coxas.
Leve os halteres para os lados com os braços estendidos e as palmas das mãos voltadas para as coxas (pegada neutra).
Mantendo os braços próximos ao torso e os cotovelos para dentro, abaixe lentamente os braços (estendidos com leve flexão nos cotovelos) o máximo possível em direção ao chão. Trave os braços superiores nessa posição; esta será sua posição inicial.
Expirando, comece a flexionar os pesos para cima enquanto gira os pulsos para que as palmas fiquem voltadas para cima. Continue até os bíceps estarem totalmente contraídos e segure por um segundo no topo. Dica: Apenas os antebraços devem se mover; braços superiores estacionários e cotovelos fixos.
Retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott deitado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Barbell_Preacher_Curls')::uuid, 'Rosca Scott inversa com barra', 'Bíceps', 'Barra W', 'LIVRE', 'Segure uma barra W na largura dos ombros com as palmas voltadas para baixo (pegada pronada).
Apoie a parte superior dos braços no banco Scott, com os braços estendidos. Esta é a posição inicial.
Ao expirar, use o bíceps para flexionar o peso até a contração total, com a barra na altura dos ombros. Contraia o bíceps firmemente por um segundo.
Ao inspirar, abaixe lentamente a barra até os braços estarem estendidos e o bíceps alongado.
Repita para as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott inversa com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Preacher_Hammer_Dumbbell_Curl')::uuid, 'Rosca Scott martelo com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Apoie a parte superior dos braços no banco Scott, segurando um halter em cada mão com as palmas voltadas uma para a outra (pegada neutra).
Inspire e abaixe os halteres lentamente até o braço ficar estendido e o bíceps alongado.
Exale e use o bíceps para levantar o peso até a contração total, halteres na altura dos ombros.
Mantenha a contração por um segundo e repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott martelo com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Machine_Preacher_Curls')::uuid, 'Rosca Scott na máquina', 'Bíceps', 'Máquina', 'MAQUINA', 'Sente-se na Máquina de Rosca Scott e selecione o peso.
Apoie a parte posterior dos braços superiores (tríceps) na almofada e segure as alças com pegada supinada (palmas para cima). Dica: Mantenha os cotovelos para dentro. Esta será sua posição inicial.
Levante as alças, expirando e contraindo os bíceps. Segure a contração por um segundo no topo. Dica: Apenas os antebraços devem se mover; braços superiores estacionários na almofada.
Abaixe as alças lentamente à posição inicial, inspirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott na maquina'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Preacher_Curl')::uuid, 'Rosca Scott na polia', 'Bíceps', 'Polia', 'MAQUINA', 'Posicione um banco Scott a cerca de 60 cm na frente de uma máquina de polia.
Conecte uma barra reta à polia baixa.
Sente-se no banco Scott, apoiando firmemente os cotovelos e a parte superior dos braços na almofada, e peça para alguém entregar a barra da polia.
Segure a barra com os braços totalmente estendidos sobre a almofada. Esta é a posição inicial.
Puxe o peso em direção aos ombros, contraindo o bíceps com força no topo. Expire durante o movimento e segure por um segundo no topo.
Abaixe lentamente o peso até a posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott na polia'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Dumbbell_Preacher_Curl')::uuid, 'Rosca Scott unilateral com halter', 'Bíceps', 'Halteres', 'LIVRE', 'Pegue um halter com a mão direita e apoie a parte superior do braço no banco Scott ou em um banco inclinado. O halter deve estar na altura do ombro. Esta é sua posição inicial.
Ao inspirar, abaixe lentamente o halter até o braço estar estendido e o bíceps totalmente alongado.
Ao expirar, use o bíceps para flexionar o peso até o bíceps estar totalmente contraído e o halter na altura do ombro. Para uma contração completa, traze o dedo mínimo mais alto que o polegar.
Contraia o bíceps fortemente por um segundo na posição contraída e repita pelo número recomendado de repetições.
Troque de braço e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench')::uuid, 'Rosca Scott unilateral no banco inclinado', 'Bíceps', 'Halteres', 'LIVRE', 'Fique atrás de um banco inclinado, como se fosse auxiliar alguém. Segure um halter com uma mão e apoie-o no banco inclinado com uma pegada supinada (palma para cima).
Posicione a mão que não está levantando no canto ou lateral do banco. O peito deve estar pressionado contra a parte superior do banco e os pés firmes no chão em uma postura ampla. Esta é a posição inicial.
Mantendo o braço superior estacionário, flexione o halter para cima enquanto contrai o bíceps e expira. Apenas os antebraços devem se mover. Continue até o bíceps estar totalmente contraído e o halter na altura do ombro. Segure a posição contraída por um segundo.
Comece a levar o halter de volta à posição inicial lentamente enquanto inspira.
Repita para a quantidade recomendada de repetições.
Troque de braço ao executar este exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca scott unilateral no banco inclinado'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Dumbbell_Curl')::uuid, 'Rosca sentada com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Sente-se em um banco reto com um halter em cada mão, mantendo os braços estendidos. Os cotovelos devem ficar próximos ao torso.
Gire as palmas das mãos para que fiquem voltadas para o torso. Esta será a posição inicial.
Mantendo a parte superior dos braços parada, flexione os pesos e comece a girar os pulsos quando os halteres passarem pelas coxas, de modo que as palmas fiquem voltadas para a frente no final do movimento. Contraia o bíceps ao expirar e certifique-se de que apenas os antebraços se movam. Continue até que o bíceps esteja totalmente contraído e os halteres estejam na altura dos ombros. Segure a posição contraída por um segundo, apertando o bíceps.
Volte lentamente à posição inicial enquanto inspira e gira os pulsos de volta para uma pegada neutra.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca sentada com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Spider_Curl')::uuid, 'Rosca spider', 'Bíceps', 'Barra W', 'LIVRE', 'Comece posicionando a barra na parte do banco Scott onde você normalmente se senta. Certifique-se de que a barra esteja alinhada e equilibrada.
Vá para a frente do banco Scott (onde os braços geralmente repousam) e posicione-se inclinado a 45 graus, com o torso e o estômago pressionados contra a frente do banco.
Certifique-se de que os pés (especialmente os dedos) estejam bem posicionados no chão e apoie a parte superior dos braços na almofada interna do banco Scott.
Segure a barra com uma pegada supinada (palmas para cima) na largura dos ombros ou ligeiramente mais próxima.
Comece a levantar a barra para cima lentamente e expire. Segure a posição contraída por um segundo, contraindo os bíceps.
Volte lentamente à posição inicial inspirando.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca spider'),
  (md5('catalogo-exercicio:fedb:' || 'Zottman_Curl')::uuid, 'Rosca Zottman com halteres', 'Bíceps', 'Halteres', 'LIVRE', 'Fique em pé com o tronco ereto, segurando um halter em cada mão com os braços estendidos ao lado do corpo. Mantenha os cotovelos próximos ao tronco.
As palmas das mãos devem estar voltadas uma para a outra. Esta é a posição inicial.
Mantendo a parte superior dos braços imóvel, flexione os pesos contraindo o bíceps enquanto expira. Apenas os antebraços devem se mover, com os pulsos girando para que as palmas fiquem para cima. Continue até que o bíceps esteja totalmente contraído e os halteres estejam na altura dos ombros.
Segure a posição contraída por um segundo, apertando o bíceps.
Na posição contraída, gire os pulsos até que as palmas fiquem voltadas para baixo, com o polegar mais alto que o mindinho.
Comece a baixar os halteres lentamente com as palmas para baixo.
Ao aproximar os halteres das coxas, gire os pulsos de volta para a posição neutra (palmas voltadas para o corpo).
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca zottman com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Zottman_Preacher_Curl')::uuid, 'Rosca Zottman no banco Scott', 'Bíceps', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e apoie a parte superior dos braços no banco Scott ou em um banco inclinado. Os halteres devem estar na altura dos ombros, com os cotovelos flexionados e as palmas das mãos voltadas para baixo. Esta é a posição inicial.
Inspire e abaixe os halteres lentamente, mantendo as palmas para baixo, até que os braços estejam estendidos e o bíceps totalmente alongado.
Gire os pulsos na parte mais baixa do movimento para que as palmas fiquem voltadas para cima.
Expire e use o bíceps para levantar os pesos até a contração total, com os halteres na altura dos ombros. Para uma contração completa, o mindinho deve ficar mais alto que o polegar.
Aperte o bíceps firmemente por um segundo na posição contraída e gire os pulsos para que as palmas voltem a ficar para baixo.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rosca zottman no banco scott'),
  (md5('catalogo-exercicio:fedb:' || 'Wrist_Rotations_with_Straight_Bar')::uuid, 'Rotação de punhos com barra reta', 'Antebraço', 'Barra', 'LIVRE', 'Segure uma barra com as duas mãos e as palmas voltadas para baixo; mãos na largura dos ombros. Esta é a posição inicial.
Alternando entre as mãos, estenda o punho como se estivesse enrolando um jornal. Continue alternando até a falha muscular.
Inverta o movimento flexionando o punho, girando na direção oposta. Continue alternando até a falha.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao de punhos com barra reta'),
  (md5('catalogo-exercicio:fedb:' || 'Torso_Rotation')::uuid, 'Rotação do tronco', 'Abdômen', 'Bola suíça', 'OUTRO', 'Fique em pé segurando uma bola de exercícios com as duas mãos. Estenda os braços para que a bola fique à sua frente. Esta é a posição inicial.
Gire o tronco para um lado, mantendo os olhos na bola. Em seguida, gire para o lado oposto. Repita por 10 a 20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao do tronco'),
  (md5('catalogo-exercicio:fedb:' || 'External_Rotation_with_Band')::uuid, 'Rotação externa com elástico', 'Ombros', 'Elástico', 'ELASTICO', 'Prenda uma banda elástica em um poste na altura do seu cotovelo. Fique de lado para a banda, a alguns passos de distância.
Segure a extremidade da banda com a mão direita e mantenha o cotovelo pressionado firmemente contra o lado do corpo. Use uma almofada para ajudar a manter a posição.
Com o braço superior fixo, o cotovelo deve estar flexionado a 90 graus e a mão cruzando a frente do tronco. Esta será sua posição inicial.
Execute o movimento girando o braço como em um backhand, mantendo o cotovelo no lugar.
Vá o mais longe possível, pause e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao externa com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'External_Rotation')::uuid, 'Rotação externa com halter', 'Ombros', 'Halteres', 'LIVRE', 'Deite-se de lado em um banco plano, segurando um halter com um braço e apoiando a cabeça na outra mão sobre o banco.
Flexione o cotovelo do braço que segura o halter em um ângulo de 90 graus entre o braço e o antebraço, mantendo-o paralelo ao tronco.
Mantenha o braço superior estacionário. O antebraço deve estar paralelo ao chão e perpendicular ao tronco. Esta será sua posição inicial.
Expire e gire o antebraço externamente em um movimento semicircular, elevando o halter até que o antebraço fique perpendicular ao chão. Segure a contração por um segundo.
Inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao externa com halter'),
  (md5('catalogo-exercicio:fedb:' || 'External_Rotation_with_Cable')::uuid, 'Rotação externa na polia', 'Ombros', 'Polia', 'MAQUINA', 'Ajuste o cabo na altura do seu cotovelo. Fique de lado para o aparelho, a alguns passos de distância.
Segure a alça com a mão direita e mantenha o cotovelo pressionado contra o lado do corpo. Use uma almofada para estabilizar.
Com o braço superior fixo, o cotovelo deve estar flexionado a 90 graus e a mão cruzando a frente do tronco. Esta será sua posição inicial.
Execute o movimento girando o braço como em um backhand, mantendo o cotovelo no lugar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao externa na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Internal_Rotation_with_Band')::uuid, 'Rotação interna com faixa', 'Ombros', 'Elástico', 'ELASTICO', 'Prenda a faixa em um poste, na altura do seu cotovelo. Fique com o lado direito voltado para a faixa, a alguns pés de distância.
Segure a ponta da faixa com a mão direita e mantenha o cotovelo pressionado firmemente contra o lado do corpo. Recomenda-se segurar uma almofada ou rolo de espuma no lugar para manter o cotovelo fixo.
Com o braço superior na posição, o cotovelo deve estar flexionado a 90 graus, com a mão afastada do torso. Esta será a posição inicial.
Execute o movimento girando o braço para a frente, mantendo o cotovelo no lugar.
Continue o máximo que puder, faça uma pausa e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao interna com faixa'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Internal_Rotation')::uuid, 'Rotação interna de ombro na polia', 'Ombros', 'Polia', 'MAQUINA', 'Sente-se ao lado de uma polia baixa, de lado, e segure a alça com a mão mais próxima da polia.
Posicione o cotovelo junto ao corpo, flexionado a 90°, apontando para a polia. Esta é a posição inicial.
Gire o ombro internamente puxando a alça até o antebraço cruzar o abdômen, formando um semicírculo.
Retorne lentamente à posição inicial.
Repita e depois faça com o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao interna de ombro na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Russian_Twists')::uuid, 'Rotação russa na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça padrão à polia na altura média.
Deite-se em uma bola suíça perpendicular à polia e segure a alça com uma mão. Fique a uma distância de um braço da polia, com tensão no cabo.
Segure a alça com as duas mãos e estenda os braços acima do peito, alinhados com a polia. Ajuste a altura se necessário.
Mantenha os quadris elevados e o abdômen contraído. Gire o torso para longe da polia em um quarto de rotação, mantendo o corpo reto da cabeça aos joelhos.
Faça uma pausa e retorne lentamente à posição inicial, mantendo tensão lateral.
Repita até a falha muscular.
Reposicione e repita do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'rotacao russa na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Russian_Twist')::uuid, 'Russian twist', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se no chão com os pés presos sob algo fixo ou seguros por um parceiro. Flexione os joelhos.
Eleve o tronco para formar um V imaginário com as coxas. Estique os braços à frente, perpendicular ao torso, com as mãos unidas. Esta é a posição inicial.
Gire o torso para o lado direito até os braços ficarem paralelos ao chão, expirando.
Segure a contração por um segundo e retorne à posição inicial, expirando. Repita para o lado esquerdo.
Execute as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'russian twist'),
  (md5('catalogo-exercicio:fedb:' || 'Stride_Jump_Crossover')::uuid, 'Salto com crossover em caixa', 'Quadríceps', null, 'OUTRO', 'Fique ao lado de uma caixa com o pé interno em cima, próximo à borda.
Balance os braços para cima e empurre com a perna na caixa, saltando o mais alto possível, tentando elevar o joelho oposto.
Aterrisse na posição oposta, com o pé que estava na caixa agora no chão e o pé oposto na caixa.
Repita o movimento, cruzando de volta para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto com crossover em caixa'),
  (md5('catalogo-exercicio:fedb:' || 'Knee_Tuck_Jump')::uuid, 'Salto com joelhos ao peito', 'Posterior', 'Peso corporal', 'PESO_CORPORAL', 'Comece em pé, com os joelhos levemente flexionados. Mantenha as mãos à frente, palmas para baixo e pontas dos dedos juntas na altura do peito. Esta é a posição inicial.
Abaixe rapidamente em um agachamento de um quarto e exploda para cima, levando os joelhos em direção ao peito, tentando tocá-los nas palmas das mãos.
Salte o mais alto possível, elevando os joelhos, e aterrisse com segurança, estendendo as pernas e flexionando os joelhos para absorver o impacto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto com joelhos ao peito'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Leg_Stride_Jump')::uuid, 'Salto com passada unilateral', 'Quadríceps', null, 'OUTRO', 'Fique ao lado de um caixote com o pé interno em cima dele, próximo à borda.
Comece balançando os braços para cima enquanto empurra com a perna de cima, saltando o mais alto possível. Tente elevar o joelho oposto.
Aterrisse na mesma posição inicial, usando a perna interna para amortecer o impacto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto com passada unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Alternate_Leg_Diagonal_Bound')::uuid, 'Salto diagonal alternado com as pernas', 'Quadríceps', null, 'OUTRO', 'Fique em uma posição confortável, com um pé ligeiramente à frente do outro.
Comece empurrando com a perna da frente, levando o joelho oposto para frente e o mais alto possível antes de aterrissar. Tente cobrir a maior distância possível para cada lado com cada salto.
Pode ajudar usar uma linha no chão para medir a distância lateral.
Repita a sequência com a outra perna.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto diagonal alternado com as pernas'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Jump')::uuid, 'Salto em afundo', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Assuma uma posição de afundo com um pé à frente e o joelho flexionado, e o joelho traseiro quase tocando o chão.
Certifique-se de que o joelho da frente esteja alinhado com o meio do pé.
Estenda ambas as pernas e salte o mais alto possível, balançando os braços para ganhar impulso.
Durante o salto, junte os pés e retorne-os às posições iniciais ao aterrissar.
Absorva o impacto voltando à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em afundo'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Long_Jump')::uuid, 'Salto em distância em pé', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Fique em uma superfície macia, como areia, em posição de agachamento parcial com pés na largura dos ombros.
Use um balanço vigoroso dos braços e um contramovimento das pernas para saltar o mais longe possível.
Tente aterrissar com os pés à frente, estendendo as pernas ao máximo.
Meça a distância do ponto de aterrissagem até o início e registre os resultados.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em distancia em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Standing_Long_Jump')::uuid, 'Salto em distância lateral', 'Quadríceps', null, 'OUTRO', 'Comece em pé com os pés na largura dos quadris, em posição atlética. A cabeça e o peito devem estar erguidos, joelhos e quadris levemente flexionados. Esta é a posição inicial.
Inclinando-se para a direita, estenda os quadris, joelhos e tornozelos para saltar no ar. Use os braços para bloquear e liderar o movimento, saltando o mais longe possível para a direita.
Aterre virado na mesma direção, com os pés na largura dos quadris, absorvendo o impacto com a parte inferior do corpo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em distancia lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Push-Up_Depth_Jump')::uuid, 'Salto em profundidade com flexão inclinada', 'Peito', null, 'OUTRO', 'Para este exercício, use uma caixa de cerca de 30 cm de altura e dois colchonetes ou steps de aeróbica.
Coloque os steps logo fora dos ombros e os pés em cima da caixa, ficando em posição de flexão inclinada, com as mãos dentro dos steps. Esta é a posição inicial.
Dobre os cotovelos para abaixar o corpo, revertendo rapidamente para empurrar-se do chão. Ao sair do chão, mova as mãos para os steps, dobrando os cotovelos para amortecer o impacto.
Repita o movimento para voltar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em profundidade com flexao inclinada'),
  (md5('catalogo-exercicio:fedb:' || 'Depth_Jump_Leap')::uuid, 'Salto em profundidade com salto', 'Quadríceps', null, 'OUTRO', 'Use duas caixas ou bancos: uma de 30 a 40 cm de altura e outra de 55 a 65 cm. Fique na primeira caixa, com pés juntos e braços ao lado, ligeiramente à frente da borda. Coloque a segunda caixa a 60 a 90 cm de distância, de frente.
Comece saltando da primeira caixa, aterrissando e imediatamente impulsionando com ambos os pés.
Rebata com força para cima e para frente, usando os braços e extensão total do corpo para pular na caixa mais alta. Absorva o impacto com as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em profundidade com salto'),
  (md5('catalogo-exercicio:fedb:' || 'Linear_Depth_Jump')::uuid, 'Salto em profundidade linear', 'Quadríceps', null, 'OUTRO', 'Você precisará de duas caixas ou bancos espaçados a alguns pés de distância. Comece em pé em uma caixa, de frente para a outra plataforma.
Para iniciar o movimento, desça suavemente para o chão entre as plataformas, permitindo que os joelhos e quadris flexionem.
Reverta o movimento explodindo, estendendo os quadris, joelhos e tornozelos para saltar para a outra plataforma.
Aterrisse suavemente, absorvendo o impacto pelas pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto em profundidade linear'),
  (md5('catalogo-exercicio:fedb:' || 'Rocket_Jump')::uuid, 'Salto foguete', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece em uma postura relaxada com os pés na largura dos ombros e os braços próximos ao corpo.
Para iniciar o movimento, agache até a metade e exploda para cima o mais alto possível.
Estenda completamente todo o corpo, alcançando acima da cabeça o máximo possível. Ao aterrissar, absorva o impacto com as pernas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto foguete'),
  (md5('catalogo-exercicio:fedb:' || 'Lateral_Bound')::uuid, 'Salto lateral', 'Adutores', 'Peso corporal', 'PESO_CORPORAL', 'Assuma uma posição de meio agachamento, virado 90 graus em relação à direção do movimento. Esta será sua posição inicial.
Permita que a perna da frente faça um contramovimento para dentro enquanto você transfere o peso para a perna externa.
Imediatamente, empurre e estenda, tentando saltar para o lado o mais longe possível.
Ao aterrissar, empurre imediatamente na direção oposta, retornando à sua posição inicial original.
Continue indo e voltando por várias repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Side_Hop-Sprint')::uuid, 'Salto lateral com sprint', 'Quadríceps', null, 'OUTRO', 'Fique ao lado de um cone ou obstáculo.
Comece o exercício saltando lateralmente sobre o obstáculo, usando o impulso da aterrissagem para saltar de volta ao ponto inicial.
Salte pelo número prescrito de repetições o mais rápido possível e finalize correndo uma curta distância após o último salto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto lateral com sprint'),
  (md5('catalogo-exercicio:fedb:' || 'Lateral_Box_Jump')::uuid, 'Salto lateral na caixa', 'Adutores', null, 'OUTRO', 'Assuma uma posição confortável em pé, com uma caixa baixa posicionada ao seu lado. Esta será sua posição inicial.
Rapidamente, faça um agachamento curto para iniciar o reflexo de alongamento e inverta imediatamente a direção para pular para cima e para o lado.
Levante os joelhos o suficiente para garantir que os pés tenham boa folga sobre a caixa.
Aterrisse no centro da caixa, usando as pernas para absorver o impacto.
Cuidadosamente, pule para o outro lado da caixa e continue indo e voltando por várias repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto lateral na caixa'),
  (md5('catalogo-exercicio:fedb:' || 'Single-Leg_Lateral_Hop')::uuid, 'Salto lateral unilateral', 'Quadríceps', null, 'OUTRO', 'Fique ao lado de um cone ou obstáculo, apoiado em uma perna com joelho levemente flexionado.
Execute um salto lateral sobre o cone.
Aterrisse na mesma perna e imediatamente salte de volta à posição inicial.
Continue saltando lateralmente para frente e para trás.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto lateral unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Quick_Leap')::uuid, 'Salto rápido', 'Quadríceps', null, 'OUTRO', 'Você precisará de um caixote para este exercício.
Comece de frente para o caixote, parado a 30-60 cm de sua borda.
Utilizando os quadris, salte sobre o caixote, aterrissando com ambas as pernas. Certifique-se de aterrissar com as pernas flexionadas e os pés totalmente apoiados.
Imediatamente após a aterrissagem, estenda completamente o corpo e balance os braços acima da cabeça para explodir para fora do caixote. Use as pernas para absorver o impacto da aterrissagem.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto rapido'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Jump')::uuid, 'Salto sobre o banco', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Comece com um banco ou caixa a 30-60 cm à sua frente. Fique em pé com os pés afastados na largura dos ombros. Esta será a posição inicial.
Faça um agachamento curto para preparar o salto; balance os braços para trás.
Impulsione-se dessa posição, estendendo os quadris, joelhos e tornozelos para saltar o mais alto possível. Balance os braços para a frente e para cima.
Salte sobre o banco, aterrissando com os joelhos flexionados para absorver o impacto.
Vire-se e enfrente a direção oposta, depois salte de volta sobre o banco.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto sobre o banco'),
  (md5('catalogo-exercicio:fedb:' || 'Scissors_Jump')::uuid, 'Salto tesoura', 'Quadríceps', 'Peso corporal', 'PESO_CORPORAL', 'Fique em posição de afundo, com um pé à frente e joelho flexionado, e o joelho de trás quase tocando o chão.
Certifique-se de que o joelho da frente não ultrapasse a linha dos pés. Estenda ambas as pernas para pular o mais alto possível, balançando os braços para impulsão.
Durante o salto, troque a posição das pernas, trazendo a perna da frente para trás e a de trás para frente.
Ao aterrissar, absorva o impacto flexionando os joelhos na posição de afundo e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto tesoura'),
  (md5('catalogo-exercicio:fedb:' || 'Box_Skip')::uuid, 'Salto unipodal na caixa', 'Posterior', null, 'OUTRO', 'Você precisará de várias caixas alinhadas a cerca de 2,5 metros de distância uma da outra.
Comece de frente para a primeira caixa, com uma perna ligeiramente atrás da outra.
Impulsione com a perna de trás, tentando ganhar o máximo de altura possível com os quadris.
Imediatamente ao aterrissar na caixa, impulsione a outra perna para frente e para cima para ganhar altura e distância, saltando da caixa. Aterre entre as duas primeiras caixas com a mesma perna que aterrissou na primeira caixa.
Em seguida, dê um passo para a próxima caixa e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'salto unipodal na caixa'),
  (md5('catalogo-exercicio:fedb:' || 'Frog_Hops')::uuid, 'Saltos de sapo', 'Quadríceps', null, 'OUTRO', 'Fique em pé com as mãos atrás da cabeça e agache, mantendo o tronco ereto e a cabeça levantada. Esta é a posição inicial.
Salte para a frente alguns pés, evitando saltar muito alto. Ao aterrissar, absorva o impacto com as pernas e salte novamente.
Repita de 5 a 10 vezes.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'saltos de sapo'),
  (md5('catalogo-exercicio:fedb:' || 'Front_Cone_Hops_or_hurdle_hops')::uuid, 'Saltos frontais sobre cones (ou obstáculos)', 'Quadríceps', null, 'OUTRO', 'Organize uma fileira de cones ou pequenos obstáculos com alguns pés de distância.
Fique em pé em frente ao primeiro cone, com pés na largura dos ombros. Esta é a posição inicial.
Salte com ambos os pés sobre o primeiro cone, balançando os braços.
Absorva o impacto flexionando os joelhos e salte imediatamente sobre o próximo cone.
Continue até saltar todos os cones.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'saltos frontais sobre cones (ou obstaculos)'),
  (md5('catalogo-exercicio:fedb:' || 'Lateral_Cone_Hops')::uuid, 'Saltos laterais com cones', 'Adutores', null, 'OUTRO', 'Posicione vários cones em fila, com alguns pés de distância entre eles.
Fique ao lado do final dos cones, virado 90 graus em relação à direção do movimento. Esta será sua posição inicial.
Inicie o salto flexionando os joelhos para ativar o reflexo de alongamento e inverta imediatamente a direção para empurrar o chão, pulando para cima e lateralmente sobre o cone.
Use as pernas para absorver o impacto ao aterrissar e rebata para o próximo salto, continuando ao longo da fila de cones.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'saltos laterais com cones'),
  (md5('catalogo-exercicio:fedb:' || 'Hurdle_Hops')::uuid, 'Saltos sobre barreiras', 'Posterior', null, 'OUTRO', 'Organize uma fileira de barreiras ou obstáculos pequenos, com alguns pés de distância entre eles.
Fique em frente à primeira barreira, com os pés na largura dos ombros. Esta é a posição inicial.
Salte com os dois pés sobre a primeira barreira, balançando os braços durante o salto.
Amortize o impacto dobrando os joelhos ao aterrissar e imediatamente salte sobre a próxima barreira. Continue até saltar todas as barreiras.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'saltos sobre barreiras'),
  (md5('catalogo-exercicio:fedb:' || 'Moving_Claw_Series')::uuid, 'Série de movimentos de corrida dinâmica', 'Posterior', null, 'OUTRO', 'Este exercício ajuda a preparar sua forma de corrida para melhorar no sprint. Ao correr, certifique-se de flexionar o joelho, mirando em chutar os glúteos conforme o quadril se estende.
Recarregue o quadríceps conforme a perna avança, atacando o chão no próximo passo.
Garanta que, ao correr, você bloqueie com os braços, executando um movimento rápido de 1-2.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'serie de movimentos de corrida dinamica'),
  (md5('catalogo-exercicio:fedb:' || 'Side_to_Side_Box_Shuffle')::uuid, 'Shuffle lateral na caixa', 'Quadríceps', null, 'OUTRO', 'Fique ao lado da caixa com o pé esquerdo apoiado no centro.
Pule para o outro lado da caixa, aterrissando com o pé direito em cima da caixa e o esquerdo no chão. Use os braços para auxiliar o movimento.
Continue alternando os lados, movendo-se rapidamente de um lado para o outro.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'shuffle lateral na caixa'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch_from_Blocks')::uuid, 'Snatch a partir de blocos', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com uma barra carregada sobre blocos ou suportes na altura desejada. Segure a barra com uma pegada larga. Os pés devem estar diretamente abaixo dos quadris, com os pés virados para fora conforme necessário. Abaixe os quadris, com o peito erguido e a cabeça voltada para a frente. Os ombros devem estar ligeiramente à frente da barra, com os cotovelos apontados para fora. Esta será a posição inicial.
Inicie a primeira puxada empurrando pelos calcanhares, levantando a barra dos blocos.
Transição para a segunda puxada estendendo os quadris, joelhos e tornozelos, impulsionando a barra para cima o mais rápido possível. Mantenha a barra próxima ao corpo. No pico da extensão, encolha os ombros e flexione os cotovelos para os lados.
Ao mover os pés para a posição de recepção, puxe-se com força para baixo da barra enquanto a eleva sobre a cabeça. Os pés devem se mover para fora dos quadris, virados para fora conforme necessário. Receba a barra com o corpo o mais baixo possível e os braços totalmente estendidos acima da cabeça.
Mantendo a barra alinhada sobre os calcanhares, com a cabeça e o peito erguidos, empurre pelos calcanhares para levantar-se. Retorne o peso com cuidado aos blocos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch a partir de blocos'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch_Balance')::uuid, 'Snatch balance', 'Quadríceps', 'Barra', 'LIVRE', 'Comece com os pés na posição de puxada, a barra apoiada nas costas dos ombros e as mãos em pegada larga de arranco.
Faça um movimento rápido de agachamento e impulsione o corpo sob a barra, movendo os pés para a posição de recepção.
Receba a barra com os braços travados sobre a cabeça, próximo ao fundo do agachamento. Mantenha o tronco vertical e os quadris baixos entre as pernas.
Continue descendo até a profundidade total e retorne à posição em pé. Abaixe o peso com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch balance'),
  (md5('catalogo-exercicio:fedb:' || 'Heaving_Snatch_Balance')::uuid, 'Snatch balance com impulso', 'Quadríceps', 'Barra', 'LIVRE', 'Este exercício ajuda a aprender o movimento do arranco. Comece segurando uma carga leve atrás dos ombros, com os pés ligeiramente mais afastados que a largura dos quadris e virados para fora, na mesma posição de um agachamento.
Faça um pequeno agachamento com os joelhos e impulsione para cima para aliviar brevemente a barra. Em seguida, projete-se para baixo, elevando a barra sobre a cabeça enquanto desce em um agachamento completo.
Retorne à posição em pé.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch balance com impulso'),
  (md5('catalogo-exercicio:fedb:' || 'Snatch')::uuid, 'Snatch com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Posicione os pés na largura dos ombros, com a barra no chão próxima aos dedos dos pés.
Com as palmas para baixo, agache-se segurando a barra com uma pegada mais larga que os ombros. Mantenha as costas retas e os quadris baixos, como se fosse sentar. Esta é a posição inicial.
Empurre o chão com os pés e comece a levantar a barra, mantendo-a próxima às pernas.
Quando a barra chegar à metade das coxas, empurre o chão com força e estenda o corpo completamente em um movimento explosivo.
Encolha os ombros para trás, elevando os cotovelos para os lados e mantendo-os acima da barra.
Rapidamente, agache-se sob a barra quando ela estiver alta o suficiente, travando os braços e segurando a barra sobre a cabeça na posição de agachamento.
Finalize levantando-se do agachamento, com os pés alinhados e os braços totalmente estendidos segurando a barra.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Kettlebell_Snatch')::uuid, 'Snatch com duas kettlebells', 'Ombros', 'Kettlebell', 'LIVRE', 'Posicione duas kettlebells atrás dos pés. Flexione os joelhos e sente-se para trás para pegá-las.
Balance as kettlebells entre as pernas com força e reverta a direção.
Impulsione com os quadris e estenda os braços, levando as kettlebells sobre a cabeça em um movimento contínuo.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch com duas kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Split_Snatch')::uuid, 'Snatch em afundo', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra carregada no chão. A barra deve estar próxima ou tocando as canelas, com uma pegada larga. Os pés devem estar diretamente abaixo dos quadris, virados para fora conforme necessário. Abaixe os quadris, com o peito erguido e a cabeça voltada para a frente. Os ombros devem estar ligeiramente à frente da barra. Esta é a posição inicial.
Inicie a primeira puxada empurrando pelos calcanhares, levantando a barra do chão. Mantenha o ângulo das costas até a barra passar os joelhos.
Transicione para a segunda puxada estendendo quadris, joelhos e tornozelos, elevando a barra rapidamente. Mantenha a barra próxima ao corpo. No pico da extensão, encolha os ombros e flexione os cotovelos para os lados.
Ao mover os pés para a posição de recepção, puxe-se vigorosamente sob a barra enquanto a eleva acima da cabeça. Os pés devem se mover para uma posição de afundo, um à frente e outro atrás. Receba a barra com o corpo o mais baixo possível e os braços totalmente estendidos.
Mantendo a barra alinhada sobre os calcanhares, com a cabeça e o peito erguidos, empurre pelos calcanhares para levantar-se, juntando os pés.
Retorne o peso ao chão com cuidado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch em afundo'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Split_Snatch')::uuid, 'Snatch em afundo com kettlebell de um braço', 'Ombros', 'Kettlebell', 'LIVRE', 'Segure um kettlebell pela alça com uma mão.
Agache em direção ao chão e, em seguida, inverta o movimento, estendendo quadris, joelhos e tornozelos para levantar o kettlebell acima da cabeça.
Após estender o corpo completamente, desça para uma posição de afundo para receber o peso acima da cabeça, com uma perna à frente e a outra atrás. Certifique-se de impulsione com os quadris e trave o kettlebell acima da cabeça em um movimento contínuo.
Retorne à posição em pé, segurando o peso acima da cabeça, e junte os pés. Abaixe o peso para retornar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch em afundo com kettlebell de um braco'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Snatch')::uuid, 'Snatch unilateral com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Coloque um kettlebell entre os pés. Flexione os joelhos e empurre o quadril para trás para assumir a posição inicial.
Olhe para frente e balance o kettlebell para trás entre as pernas.
Imediatamente inverta a direção e impulsione com os quadris e joelhos, acelerando o kettlebell para cima. Quando o kettlebell subir até a altura do ombro, gire a mão e empurre para cima, usando o momento para receber o peso com o braço estendido acima da cabeça.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'snatch unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Wind_Sprints')::uuid, 'Sprints suspensos', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Pendure-se em uma barra de pull-up com pegada pronada. Braços e pernas devem estar estendidos. Esta é a posição inicial.
Comece levantando rapidamente um joelho o mais alto possível, sem balançar o corpo ou as pernas.
Imediatamente, reverta o movimento, retornando essa perna à posição inicial e, ao mesmo tempo, levantando o joelho oposto o mais alto possível.
Continue alternando as pernas até completar a série.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'sprints suspensos'),
  (md5('catalogo-exercicio:fedb:' || 'Step_Mill')::uuid, 'Step mill', 'Cardio', 'Máquina', 'CARDIO', 'Para começar, suba no stepmill e selecione a opção desejada no menu. Você pode escolher uma configuração manual ou um programa. Normalmente, é possível inserir idade e peso para estimar as calorias queimadas. Tome cuidado para não tropeçar ao subir as escadas. É recomendável segurar as alças para não cair.
O Step Mill oferece conveniência, benefícios cardiovasculares e geralmente tem menos impacto do que correr ao ar livre, com uma taxa similar de calorias queimadas. É tipicamente mais intenso que outros equipamentos cardiovasculares. Uma pessoa de 68 kg queima cerca de 300 calorias em 30 minutos, comparado a 175 calorias ao caminhar.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'step mill'),
  (md5('catalogo-exercicio:fedb:' || 'Wide_Stance_Stiff_Legs')::uuid, 'Stiff com base aberta', 'Posterior', 'Barra', 'LIVRE', 'Comece com uma barra no chão. Adote uma base larga e incline-se nos quadris para segurar a barra. Mantenha os quadris para trás, as pernas quase estendidas, as costas retas e o peito erguido. Esta é a posição inicial.
Inicie o movimento acionando os quadris, levando-os para frente enquanto os braços ficam estendidos. Continue até ficar em pé e, então, retorne lentamente o peso à posição inicial. Para repetições sucessivas, o peso não precisa tocar o chão.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'stiff com base aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Stiff-Legged_Dumbbell_Deadlift')::uuid, 'Stiff com halteres', 'Posterior', 'Halteres', 'LIVRE', 'Segure um par de halteres ao lado do corpo com os braços estendidos.
Fique em pé com o tronco reto e as pernas afastadas na largura dos ombros ou menos, com os joelhos levemente flexionados. Esta é a posição inicial.
Mantendo os joelhos fixos, incline o tronco para a frente, mantendo as costas retas, e abaixe os halteres em direção aos pés até sentir um alongamento nos isquiotibiais. Expire durante esse movimento.
Retorne o tronco à posição inicial estendendo os quadris e a cintura. Inspire durante esse movimento.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'stiff com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Stiff-Legged_Deadlift')::uuid, 'Stiff no smith', 'Posterior', 'Máquina', 'MAQUINA', 'Ajuste a barra na máquina Smith para a altura das coxas. Com a barra carregada, segure-a com as palmas para frente e as mãos na largura dos ombros. Use straps se necessário.
Levante a barra estendendo os braços, mantendo as costas retas. Fique em pé com as pernas na largura dos ombros ou mais estreitas e joelhos levemente flexionados. Esta é a posição inicial.
Mantendo os joelhos imóveis, abaixe a barra em direção aos pés dobrando a cintura, com as costas retas. Desça até sentir o alongamento nos isquiotibiais. Expire durante esse movimento.
Volte o tronco à posição ereta estendendo os quadris e a cintura. Inspire durante esse movimento.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'stiff no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_One-Legged_Deadlift')::uuid, 'Stiff unilateral com kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', 'Segure um kettlebell pelo cabo com uma mão. Fique em uma perna, do mesmo lado que segura o kettlebell.
Com o joelho levemente flexionado, faça um stiff-legged, dobrando o quadril e estendendo a perna livre para trás para equilíbrio.
Continue abaixando o kettlebell até ficar paralelo ao chão e retorne à posição ereta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'stiff unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Step_Ups')::uuid, 'Subida no banco com barra', 'Quadríceps', 'Barra', 'LIVRE', 'Fique em pé, segurando uma barra apoiada nas costas dos ombros (ligeiramente abaixo do pescoço), e posicione-se atrás de uma plataforma elevada (como um step). Esta é a posição inicial.
Coloque o pé direito na plataforma. Suba na plataforma estendendo o quadril e o joelho da perna direita. Use principalmente o calcanhar para levantar o corpo e coloque o pé esquerdo na plataforma também. Expire enquanto executa o movimento de subida.
Desça com a perna esquerda, flexionando o quadril e o joelho da perna direita, enquanto inspira. Retorne à posição inicial colocando o pé direito ao lado do esquerdo.
Repita com a perna direita para a quantidade recomendada de repetições e depois faça com a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'subida no banco com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Step-up_with_Knee_Raise')::uuid, 'Subida no banco com elevação de joelho', 'Glúteos', 'Peso corporal', 'PESO_CORPORAL', 'Fique de frente para uma caixa ou banco de altura adequada, com os pés juntos. Esta é a posição inicial.
Comece o movimento subindo, colocando o pé esquerdo no topo do banco. Estenda o quadril e o joelho da perna da frente para ficar em pé na caixa. Ao ficar em pé na caixa com a perna esquerda, flexione o joelho e quadril direito, elevando o joelho o mais alto que puder.
Reverta o movimento para descer da caixa e repita a sequência na perna oposta.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'subida no banco com elevacao de joelho'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Step_Ups')::uuid, 'Subida no banco com halteres', 'Quadríceps', 'Halteres', 'LIVRE', 'Fique em pé segurando um halter em cada mão (palmas voltadas para as pernas).
Coloque o pé direito em uma plataforma elevada. Suba estendendo o quadril e o joelho da perna direita, usando principalmente o calcanhar. Expire ao subir e coloque o pé esquerdo na plataforma.
Desça com a perna esquerda, flexionando o quadril e joelho da perna direita, inspirando. Retorne à posição inicial.
Repita com a perna direita para o número de repetições prescrito e depois faça com a perna esquerda.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'subida no banco com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Superman')::uuid, 'Super-homem', 'Costas', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de bruços no chão ou no colchonete, com os braços totalmente estendidos à frente. Esta é a posição inicial.
Simultaneamente, levante os braços, pernas e peito do chão e mantenha a contração por 2 segundos. Dica: Contraia a lombar para melhores resultados e expire durante o movimento. Na posição contraída, você deve parecer o Super-Homem voando.
Lentamente, abaixe os braços, pernas e peito de volta à posição inicial enquanto inspira.
Repita conforme o número de repetições indicado no seu programa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'super-homem'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Lying_Supination')::uuid, 'Supinação com halter deitado lateral', 'Antebraço', 'Halteres', 'LIVRE', 'Deite-se de lado em um banco plano, segurando um halter com um braço e apoiando a cabeça na outra mão sobre o banco.
Flexione o cotovelo do braço que segura o halter em um ângulo de 90 graus entre o braço e o antebraço.
Eleve o braço para que o antebraço fique paralelo ao chão e perpendicular ao torso, com o braço estacionário junto ao torso. Esta é a posição inicial.
Expire e gire o antebraço externamente, levantando o halter em um movimento semicircular até o antebraço ficar perpendicular ao chão, apontando para o teto. Segure a contração por um segundo.
Inspire e retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supinacao com halter deitado lateral'),
  (md5('catalogo-exercicio:fedb:' || 'Alternating_Floor_Press')::uuid, 'Supino alternado no chão', 'Peito', 'Kettlebell', 'LIVRE', 'Deite-se no chão com dois kettlebells próximos aos ombros.
Posicione um no peito e depois o outro, segurando os kettlebells pelas alças com as palmas voltadas para frente.
Estenda ambos os braços, mantendo os kettlebells acima do peito. Abaixe um kettlebell, trazendo-o ao peito e gire o pulso na direção do braço estendido.
Levante o kettlebell e repita do lado oposto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino alternado no chao'),
  (md5('catalogo-exercicio:fedb:' || 'Chain_Press')::uuid, 'Supino com correntes', 'Peito', null, 'OUTRO', 'Comece conectando as correntes às alças de cabo. Posicione-se no banco reto na mesma postura do supino com halteres. Os punhos devem estar pronados e os braços perpendiculares ao chão. Esta será a posição inicial.
Abaixe as correntes flexionando os cotovelos, descarregando parte da corrente no chão.
Continue até que o cotovelo forme um ângulo de 90 graus e, em seguida, inverta o movimento estendendo o cotovelo até a trava.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Press_-_With_Bands')::uuid, 'Supino com elástico', 'Peito', 'Elástico', 'ELASTICO', 'Em um banco plano, prenda um elástico sob a perna do banco mais próxima da sua cabeça.
Com o elástico seguro, segure as alças e deite-se no banco.
Estenda os braços, segurando as alças do elástico à frente na largura dos ombros.
Gire os pulsos para a frente, com as palmas das mãos voltadas para longe de você. Esta será a posição inicial.
Abaixe as alças lentamente até que os cotovelos formem um ângulo de 90 graus. Mantenha o controle total.
Ao expirar, levante as alças usando os músculos peitorais. Trave os braços na posição contraída, aperte o peito, segure por um segundo e depois desça lentamente. Dica: A descida deve levar pelo menos o dobro do tempo da subida.
Repita o movimento para a quantidade prescrita de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Band_Bench_Press')::uuid, 'Supino com elásticos invertidas', 'Tríceps', 'Barra', 'LIVRE', 'Posicione um banco dentro de um power rack, com a barra na altura correta. Comece ancorando faixas elásticas nos pinos de faixa ou no topo do rack. Certifique-se de que você estará posicionado corretamente sob as faixas. Prenda a outra extremidade à barra.
Deite-se no banco, coloque os pés sob o corpo e arqueie as costas. Usando a barra para ajudar a suportar seu peso, levante os ombros do banco e retraia-os, apertando as escápulas. Use os pés para empurrar os trapézios para o banco. Mantenha esta posição corporal firme durante todo o movimento. Seja qual for a largura da sua pegada, ela deve cobrir a marcação na barra.
Puxe a barra para fora do rack sem protrair os ombros. Foque em apertar a barra e tentar separá-la. Abaixe a barra até o peito inferior ou estômago superior. A barra, o pulso e o cotovelo devem permanecer alinhados o tempo todo.
Faça uma pausa quando a barra tocar seu torso e então empurre a barra para cima com a maior força possível. Os cotovelos devem ficar próximos ao corpo até a extensão completa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino com elasticos invertidas'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Bench_Press_with_Neutral_Grip')::uuid, 'Supino com halteres pegada neutra', 'Peito', 'Halteres', 'LIVRE', 'Segure um halter em cada mão e deite-se em um banco plano. Os pés devem estar apoiados no chão e as escápulas retraídas.
Mantendo uma pegada neutra (palmas voltadas uma para a outra), comece com os braços estendidos diretamente acima de você, perpendicular ao chão. Esta será a posição inicial.
Inicie o movimento flexionando os cotovelos, baixando os braços superiores para os lados. Desça até os halteres chegarem perto do torso.
Faça uma pausa e, em seguida, estenda os cotovelos para voltar à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino com halteres pegada neutra'),
  (md5('catalogo-exercicio:fedb:' || 'Board_Press')::uuid, 'Supino com tábuas', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se no banco com a cabeça além da barra. Use uma a cinco tábuas (2x6) seguras por um parceiro ou bandas.
Arqueie as costas, pés apoiados, e retraia as escápulas. Mantenha a posição firme.
Segure a barra com pegada padrão ou mais estreita para tríceps. Tire a barra do suporte sem protrair os ombros. Alinhe barra, punho e cotovelo.
Abaixe a barra até as tábuas e empurre para cima com força, mantendo os cotovelos próximos até a extensão completa.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino com tabuas'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Barbell_Bench_Press')::uuid, 'Supino declinado com barra', 'Peito', 'Barra', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se lentamente.
Com uma pegada média (que forme um ângulo de 90 graus no meio do movimento), levante a barra do rack e segure-a acima de você com os braços travados e perpendiculares ao chão. Esta é a posição inicial. Dica: Para proteger o manguito rotador, peça ajuda a um parceiro para retirar a barra.
Inspire e desça a barra lentamente até sentir no peito inferior.
Após uma pausa breve, retorne à posição inicial expirando e usando os músculos peitorais. Trave os braços e contraia o peito no topo, segure por um segundo e desça novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita o movimento pelo número de repetições prescrito.
Ao terminar, recoloque a barra no rack.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino declinado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Decline_Barbell_Bench_Press')::uuid, 'Supino declinado com barra pegada aberta', 'Peito', 'Barra', 'LIVRE', 'Deite-se em um banco declinado com os pés firmemente travados. Segure a barra com uma pegada pronada e larga (cerca de 3 polegadas além da largura dos ombros), levantando-a do suporte e mantendo os braços travados acima do peito. Esta é a posição inicial.
Inspire e desça a barra lentamente até tocar a parte inferior do peito.
Após uma pausa de um segundo, empurre a barra de volta à posição inicial, expirando e contraindo o peito. Trave os braços e segure a contração por um segundo antes de descer novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita o movimento para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino declinado com barra pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Dumbbell_Bench_Press')::uuid, 'Supino declinado com halteres', 'Peito', 'Halteres', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se com um halter em cada mão sobre as coxas, palmas voltadas uma para a outra.
Ao deitar, posicione os halteres à frente na largura dos ombros.
Gire os pulsos para frente, com as palmas voltadas para longe de você. Esta é a posição inicial.
Desça os pesos lentamente para os lados, expirando e mantendo o controle. Dica: Os antebraços devem permanecer perpendiculares ao chão.
Expire e empurre os halteres para cima usando os peitorais. Trave os braços, contraia o peito, segure por um segundo e desça lentamente. Dica: A descida deve ser mais lenta que a subida.
Repita pelo número de repetições do seu treino.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino declinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Decline_Chest_Press')::uuid, 'Supino declinado na máquina articulada', 'Peito', 'Máquina', 'MAQUINA', 'Ajuste o peso e o banco declinado para que as alças fiquem na parte inferior do peito. Mantenha o peito erguido e as escápulas retraídas. Esta é a posição inicial.
Empurre as alças para frente, estendendo os cotovelos.
Após uma breve pausa no topo, retorne o peso logo acima da posição inicial, mantendo a tensão muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino declinado na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Decline_Press')::uuid, 'Supino declinado no smith', 'Peito', 'Máquina', 'MAQUINA', 'Posicione um banco declinado no rack para que a barra fique acima do peito. Carregue o peso adequado e deite-se no banco.
Gire a barra para desengatá-la e estenda totalmente os braços. Mantenha as costas levemente arqueadas e as escápulas retraídas. Esta é a posição inicial.
Inicie o movimento flexionando os braços, abaixando a barra até o peito.
Faça uma pausa breve e estenda os braços para empurrar o peso de volta à posição inicial.
Após completar as repetições desejadas, gire a barra para engatar o peso.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino declinado no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Cable_Chest_Press')::uuid, 'Supino em pé na polia', 'Peito', 'Polia', 'MAQUINA', 'Ajuste duas polias na altura do peito e selecione um peso adequado. Fique a um ou dois pés das polias, segurando uma em cada mão. Você pode posicionar os pés em escalonado para maior estabilidade.
Posicione os braços superiores em um ângulo de 90 graus, com as escápulas juntas. Esta é a posição inicial.
Mantendo o resto do corpo parado, estenda os cotovelos para pressionar as alças para frente, aproximando-as na sua frente.
Faça uma pausa no topo do movimento e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino em pe na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_Barbell_Bench_Press')::uuid, 'Supino fechado com barra', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se de costas em um banco reto. Usando uma pegada fechada (aproximadamente na largura dos ombros), levante a barra do suporte e segure-a reta acima de você com os braços travados. Esta será sua posição inicial.
Enquanto inspira, desça lentamente até sentir a barra no meio do peito. Dica: Ao contrário do supino reto comum, mantenha os cotovelos próximos ao torso o tempo todo para maximizar o envolvimento do tríceps.
Após uma pausa de um segundo, traga a barra de volta à posição inicial enquanto expira e empurra a barra usando os músculos do tríceps. Trave os braços na posição contraída, segure por um segundo e então comece a descer lentamente novamente. Dica: Deve levar pelo menos o dobro do tempo para descer do que para subir.
Repita o movimento pelo número prescrito de repetições.
Ao terminar, coloque a barra de volta no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino fechado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_EZ-Bar_Press')::uuid, 'Supino fechado com barra W', 'Tríceps', 'Barra W', 'LIVRE', 'Deite-se em um banco reto com uma barra W carregada com o peso apropriado.
Usando uma pegada fechada, levante a barra e segure-a reta acima do torso, com os cotovelos para dentro. Os braços devem ficar perpendiculares ao chão. Esta será sua posição inicial.
Agora, baixe a barra em direção ao peito inferior enquanto inspira. Mantenha os cotovelos para dentro durante o movimento.
Usando o tríceps para empurrar a barra para cima, pressione-a de volta à posição inicial estendendo os cotovelos enquanto expira.
Repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino fechado com barra w'),
  (md5('catalogo-exercicio:fedb:' || 'Close-Grip_Dumbbell_Press')::uuid, 'Supino fechado com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Coloque um halter em pé em um banco reto.
Garantindo que o halter fique seguro no topo do banco, deite-se perpendicular ao banco com apenas os ombros apoiados na superfície. Os quadris devem ficar abaixo do banco e as pernas flexionadas, com os pés firmes no chão.
Segure o halter com as duas mãos e segure-o reto acima do peito, com os braços estendidos. Ambas as palmas devem pressionar a parte inferior dos lados do halter. Esta será sua posição inicial.
Inicie o movimento baixando o halter em direção ao peito.
Retorne à posição inicial estendendo os cotovelos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino fechado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Close-Grip_Bench_To_Skull_Crusher')::uuid, 'Supino fechado conjugado com tríceps testa', 'Tríceps', 'Barra', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se lentamente.
Com uma pegada fechada (ligeiramente mais estreita que a largura dos ombros), levante a barra do rack e segure-a acima de você com os braços travados e cotovelos para dentro, perpendiculares ao chão. Esta é a posição inicial. Dica: Peça ajuda para retirar a barra.
Desça a barra em direção ao peito inferior, inspirando e mantendo os cotovelos próximos ao corpo.
Use o tríceps para empurrar a barra de volta à posição inicial, expirando.
Inspire e, mantendo os braços superiores imóveis, desça a barra lentamente em um movimento semicircular até tocar levemente a testa.
Contraia o tríceps para levantar a barra à posição inicial, expirando.
Repita os passos de descida e elevação até completar as repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino fechado conjugado com triceps testa'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Close-Grip_Bench_Press')::uuid, 'Supino fechado no smith', 'Tríceps', 'Máquina', 'MAQUINA', 'Posicione um banco plano sob o Smith Machine. Ajuste a barra para uma altura que você alcance deitado com os braços quase totalmente estendidos. Com o peso selecionado, deite-se no banco. Use uma pegada fechada e pronada (palmas para frente) na largura dos ombros, desengate a barra e segure-a reta acima de você com os braços travados. Esta é a posição inicial.
Inspire e desça lentamente até a barra tocar o meio do peito. Dica: Mantenha os cotovelos próximos ao torso para maximizar o trabalho do tríceps.
Após uma pausa de um segundo, retorne a barra à posição inicial enquanto expira, empurrando com os tríceps. Trave os braços na posição contraída, segure por um segundo e desça novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita o movimento pelo número prescrito de repetições.
Ao terminar, engate a barra de volta no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino fechado no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Guillotine_Bench_Press')::uuid, 'Supino guilhotina com barra', 'Peito', 'Barra', 'LIVRE', 'Com uma pegada média, levante a barra do rack e segure-a reta acima do pescoço com os braços travados. Esta será sua posição inicial.
Inspire e desça a barra lentamente até cerca de 2,5 cm do pescoço.
Após uma pausa, traga a barra de volta à posição inicial expirando e empurrando com os músculos do peito. Trave os braços e contraia o peito, segure por um segundo e desça novamente lentamente.
Repita pelo número prescrito de repetições.
Ao terminar, recoloque a barra no rack.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino guilhotina com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Barbell_Incline_Bench_Press_-_Medium_Grip')::uuid, 'Supino inclinado com barra', 'Peito', 'Barra', 'LIVRE', 'Deite-se em um banco inclinado. Com uma pegada média (que forme um ângulo de 90 graus no meio do movimento), levante a barra do suporte e segure-a acima de você com os braços travados. Esta é a posição inicial.
Inspire e desça a barra lentamente até tocar o peito superior.
Após uma pausa de um segundo, retorne à posição inicial expirando e usando os músculos do peito. Trave os braços, contraia o peito, segure por um segundo e desça novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita pelo número recomendado de repetições.
Ao terminar, recoloca a barra no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Hammer_Grip_Incline_DB_Bench_Press')::uuid, 'Supino inclinado com halteres pegada martelo', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco inclinado com um halter em cada mão apoiado sobre as coxas. As palmas das mãos devem estar voltadas uma para a outra.
Use as coxas para ajudar a levantar os halteres, limpando-os um de cada vez até segurá-los na largura dos ombros.
Com os halteres na altura dos ombros, mantenha as palmas com uma pegada neutra (voltadas uma para a outra). Mantenha os cotovelos abertos, com os braços superiores alinhados com os ombros (perpendiculares ao torso) e os cotovelos dobrados em um ângulo de 90 graus. Esta será sua posição inicial.
Abaixe os pesos lentamente para os lados enquanto inspira. Mantenha o controle total dos halteres o tempo todo.
Ao expirar, empurre os halteres para cima usando os músculos peitorais. Trave os braços na posição contraída, segure por um segundo e depois comece a descer lentamente. Dica: Leve pelo menos o dobro do tempo para descer do que para subir.
Repita o movimento para a quantidade prescrita de repetições.
Ao terminar, coloque os halteres de volta sobre as coxas e depois no chão. Esta é a maneira mais segura de descartar os halteres.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado com halteres pegada martelo'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Dumbbell_Bench_With_Palms_Facing_In')::uuid, 'Supino inclinado com halteres pegada neutra', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco inclinado com um halter em cada mão sobre as coxas. As palmas devem estar voltadas uma para a outra.
Use as coxas para ajudar a levantar os halteres até a altura dos ombros, com as mãos na largura dos ombros.
Mantenha as palmas neutras (voltadas para dentro), cotovelos abertos e braços superiores perpendiculares ao tronco, formando um ângulo de 90 graus no cotovelo. Esta será a posição inicial.
Abaixe os pesos lentamente para os lados enquanto inspira. Mantenha o controle total.
Ao expirar, empurre os halteres para cima usando os músculos peitorais. Trave os braços na posição contraída, segure por um segundo e desça lentamente. Dica: Leve o dobro do tempo para descer.
Repita para a quantidade recomendada de repetições.
Ao terminar, coloque os halteres de volta nas coxas e depois no chão para segurança.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado com halteres pegada neutra'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Incline_Chest_Press')::uuid, 'Supino inclinado na máquina articulada', 'Peito', 'Máquina', 'MAQUINA', 'Ajuste o peso e o banco inclinado para que as alças fiquem na parte superior do peito. Mantenha o peito erguido e as escápulas retraídas. Esta é a posição inicial.
Empurre as alças para frente, estendendo os cotovelos.
Após uma breve pausa no topo, retorne o peso logo acima da posição inicial, mantendo a tensão muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Cable_Chest_Press')::uuid, 'Supino inclinado na polia', 'Peito', 'Polia', 'MAQUINA', 'Ajuste o peso e sente-se, segurando as alças. Os braços superiores devem estar a cerca de 45 graus do corpo, com a cabeça e o peito erguidos. Os cotovelos devem estar flexionados a 90 graus. Esta será a posição inicial.
Estenda os cotovelos, pressionando as alças para frente e juntas. Mantenha as escápulas retraídas.
Após uma pausa na extensão total, retorne à posição inicial, mantendo tensão nos cabos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Incline_Bench_Press')::uuid, 'Supino inclinado no smith', 'Peito', 'Máquina', 'MAQUINA', 'Posicione um banco inclinado sob o Smith Machine. Ajuste a barra para uma altura que você alcance deitado com os braços quase totalmente estendidos. Com o peso selecionado, deite-se no banco inclinado, alinhando a parte superior do peito com a barra. Use uma pegada pronada (palmas para frente) mais larga que os ombros, desengate a barra e segure-a reta acima de você com os braços travados. Esta é a posição inicial.
Inspire e desça lentamente até a barra tocar a parte superior do peito.
Após uma pausa de um segundo, retorne a barra à posição inicial enquanto expira, empurrando com os músculos do peito. Trave os braços na posição contraída, segure por um segundo e desça novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita o movimento pelo número prescrito de repetições.
Ao terminar, coloque a barra de volta no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino inclinado no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Triceps_Bench_Press')::uuid, 'Supino invertido para tríceps', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se de costas em um banco reto. Com uma pegada fechada e supinada (largura dos ombros), levante a barra do suporte e segure-a estendida à sua frente, com os braços travados e perpendiculares ao chão. Esta é a posição inicial.
Enquanto inspira, desça a barra lentamente até sentir no meio do peito. Dica: Ao contrário do supino tradicional, mantenha os cotovelos próximos ao tronco para maximizar o trabalho do tríceps.
Após uma pausa de um segundo, retorne a barra à posição inicial enquanto expira e empurra com os tríceps. Trave os braços na posição contraída, segure por um segundo e desça lentamente. Dica: A descida deve levar pelo menos o dobro do tempo da subida.
Repita o movimento para a quantidade prescrita de repetições.
Ao terminar, recoloque a barra no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino invertido para triceps'),
  (md5('catalogo-exercicio:fedb:' || 'Leverage_Chest_Press')::uuid, 'Supino na máquina articulada', 'Peito', 'Máquina', 'MAQUINA', 'Ajuste o peso nos pinos e o banco para que as alças fiquem na altura do peito. Mantenha o peito erguido e as escápulas retraídas. Esta é a posição inicial.
Empurre as alças para frente, estendendo os cotovelos.
Após uma breve pausa no topo, retorne o peso logo acima da posição inicial, mantendo a tensão muscular.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino na maquina articulada'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Chest_Press')::uuid, 'Supino na polia em pé', 'Peito', 'Polia', 'MAQUINA', 'Ajuste o peso para uma quantidade apropriada e sente-se, segurando as alças. Os braços superiores devem estar a cerca de 45 graus do corpo, com a cabeça e o peito erguidos. Os cotovelos devem estar dobrados a cerca de 90 graus. Esta é a posição inicial.
Comece estendendo os cotovelos, pressionando as alças juntas diretamente à sua frente. Mantenha as escápulas retraídas durante o movimento.
Após uma pausa na extensão total, retorne à posição inicial, mantendo a tensão nos cabos.
Você também pode executar este movimento com as costas fora do encosto, em inclinação ou declinação, ou alternando as mãos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino na polia em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Floor_Press')::uuid, 'Supino no chão com barra', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se no chão com a cabeça próxima a um rack de potência e retire a barra dos ganchos, mantendo as escápulas retraídas.
Abaixe a barra em direção ao peito ou estômago, mantendo os cotovelos próximos ao corpo, até o braço tocar o chão. Faça uma pausa.
Empurre a barra para cima rapidamente, mantendo o alinhamento da barra, pulsos e cotovelos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Floor_Press_with_Chains')::uuid, 'Supino no chão com correntes', 'Tríceps', 'Barra', 'LIVRE', 'Posicione as correntes sobre as extremidades da barra em um rack. Deite-se no chão e retire a barra, mantendo as escápulas retraídas.
Abaixe a barra em direção ao peito ou estômago, com os cotovelos próximos ao corpo, até o braço tocar o chão. Faça uma pausa.
Empurre a barra para cima rapidamente, mantendo o alinhamento adequado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao com correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Floor_Press')::uuid, 'Supino no chão com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se no chão segurando halteres nas mãos. Os joelhos podem estar flexionados. Comece com os pesos totalmente estendidos acima de você.
Abaixe os pesos até a parte superior dos braços tocar o chão. Você pode manter os cotovelos junto ao corpo para enfatizar o tríceps, ou afastá-los para focar no peito.
Faça uma pausa no ponto mais baixo e, em seguida, traga os pesos juntos no topo estendendo os cotovelos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Leg-Over_Floor_Press')::uuid, 'Supino no chão com perna cruzada', 'Peito', 'Kettlebell', 'LIVRE', 'Deite-se no chão com um kettlebell posicionado no peito, segurando-o pela alça. Estenda a perna do lado de trabalho sobre a perna do lado oposto. Seu braço livre pode estar estendido para o lado para apoio.
Pressione o kettlebell até a posição de bloqueio.
Abaixe o peso até o cotovelo tocar o chão, mantendo o kettlebell acima do cotovelo. Repita para o número desejado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao com perna cruzada'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Floor_Press')::uuid, 'Supino no chão unilateral com halter', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se de costas no chão ou em um colchonete, com os joelhos flexionados.
Peça a um parceiro para entregar a barra em uma mão. Na posição inicial, o braço deve estar quase totalmente estendido, com pegada neutra (palmas voltadas para o torso).
Coloque a mão não utilizada ao lado do corpo.
Comece abaixando a barra até o cotovelo tocar o chão, inspirando.
Em seguida, levante a barra de volta à posição inicial, expirando.
Repita até completar as repetições recomendadas.
Troque de braço e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Floor_Press')::uuid, 'Supino no chão unilateral com kettlebell', 'Peito', 'Kettlebell', 'LIVRE', 'Deite-se no chão segurando um kettlebell com uma mão, com o braço apoiado no chão e a palma virada para dentro.
Pressione o kettlebell reto para cima em direção ao teto, girando o pulso.
Abaixe o kettlebell de volta à posição inicial e repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no chao unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Smith_Press')::uuid, 'Supino no smith em banco declinado', 'Peito', 'Máquina', 'MAQUINA', 'Posicione um banco declinado sob o Smith machine. Ajuste a barra para que você alcance com os braços quase estendidos ao deitar. Use uma pegada pronada mais larga que os ombros, destrave a barra e segure-a reta acima. Esta é a posição inicial.
Inspire e abaixe a barra com controle, flexionando os cotovelos até tocar levemente o torso.
Após uma pausa breve, retorne a barra à posição inicial estendendo os cotovelos, expirando.
Repita o movimento para as repetições prescritas.
Ao terminar, trave a barra de volta no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino no smith em banco declinado'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Press_with_Chains')::uuid, 'Supino reto com barra e correntes', 'Tríceps', 'Barra', 'LIVRE', 'Ajuste a corrente líder, encurtando-a ao comprimento desejado. Coloque as correntes nas extremidades da barra.
Deitado no banco, posicione a cabeça além da barra, se possível. Apoie os pés no chão e arqueie as costas. Use a barra para ajudar a suportar o peso, levante os ombros do banco e retraia-os, apertando as escápulas. Use os pés para pressionar os trapézios no banco. Mantenha essa posição corporal firme. A pegada deve cobrir a marcação do anel na barra.
Tire a barra do suporte sem protrair os ombros. Foque em apertar a barra e tentar separá-la. Abaixe a barra até o peito inferior ou estômago superior. A barra, pulsos e cotovelos devem permanecer alinhados.
Faça uma pausa quando a barra tocar o torso e, então, empurre a barra para cima com a máxima força. Mantenha os cotovelos próximos ao corpo até a extensão total.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto com barra e correntes'),
  (md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Barbell_Bench_Press')::uuid, 'Supino reto com barra pegada aberta', 'Peito', 'Barra', 'LIVRE', 'Deite-se em um banco plano com os pés firmes no chão. Segure a barra com uma pegada pronada e larga (cerca de 3 polegadas além da largura dos ombros), levantando-a do suporte e mantendo os braços travados acima do peito. Esta é a posição inicial.
Inspire e desça a barra lentamente até tocar o meio do peito.
Após uma pausa de um segundo, empurre a barra de volta à posição inicial, expirando e contraindo o peito. Trave os braços e segure a contração por um segundo antes de descer novamente. Dica: A descida deve ser pelo menos duas vezes mais lenta que a subida.
Repita o movimento para o número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto com barra pegada aberta'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Bench_Press')::uuid, 'Supino reto com halteres', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco plano com um halter em cada mão apoiado sobre as coxas. As palmas das mãos devem estar voltadas uma para a outra.
Use as coxas para ajudar a levantar os halteres, erguendo-os um de cada vez até segurá-los na frente de você na largura dos ombros.
Na largura dos ombros, gire os pulsos para frente, de modo que as palmas fiquem voltadas para longe de você. Os halteres devem ficar ao lado do peito, com o braço superior e o antebraço formando um ângulo de 90 graus. Mantenha o controle total dos halteres. Esta será a posição inicial.
Ao expirar, use o peito para empurrar os halteres para cima. Trave os braços no topo do movimento e contraia o peito, segure por um segundo e depois desça lentamente. Dica: Idealmente, baixar o peso deve levar o dobro do tempo que levantá-lo.
Repita o movimento pelo número de repetições prescrito no seu programa de treino.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Smith_Machine_Bench_Press')::uuid, 'Supino reto no smith', 'Peito', 'Máquina', 'MAQUINA', 'Posicione um banco reto sob o Smith machine. Ajuste a barra a uma altura que você possa alcançar deitado, com os braços quase totalmente estendidos. Após selecionar o peso, deite-se no banco reto. Com uma pegada pronada mais larga que os ombros, solte a barra do suporte e segure-a reta acima de você, com os braços travados. Esta é a posição inicial.
Ao inspirar, desça a barra lentamente até sentir que ela toca o meio do peito.
Após uma pausa de um segundo, retorne a barra à posição inicial ao expirar, empurrando com os músculos do peito. Trave os braços na posição contraída, segure por um segundo e comece a descer lentamente novamente. Dica: O movimento de descida deve levar pelo menos o dobro do tempo da subida.
Repita o movimento pelo número de repetições prescrito.
Ao terminar, trave a barra de volta no suporte.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto no smith'),
  (md5('catalogo-exercicio:fedb:' || 'Bench_Press_-_Powerlifting')::uuid, 'Supino reto powerlifting com barra', 'Tríceps', 'Barra', 'LIVRE', 'Deite-se no banco, posicionando a cabeça além da barra, se possível. Apoie os pés no chão e arqueie as costas. Use a barra para ajudar a suportar o peso, levante os ombros do banco e retraia-os, apertando as escápulas. Use os pés para pressionar os trapézios no banco. Mantenha essa posição corporal firme durante todo o movimento.
A pegada deve cobrir a marcação do anel na barra. Tire a barra do suporte sem protrair os ombros. Foque em apertar a barra e tentar separá-la.
Abaixe a barra até o peito inferior ou estômago superior. A barra, pulsos e cotovelos devem permanecer alinhados.
Faça uma pausa quando a barra tocar o torso e, então, empurre a barra para cima com a máxima força. Mantenha os cotovelos próximos ao corpo até a extensão total.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto powerlifting com barra'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Dumbbell_Bench_Press')::uuid, 'Supino reto unilateral com halter', 'Peito', 'Halteres', 'LIVRE', 'Deite-se em um banco plano com um halter em uma mão, apoiado na sua coxa.
Use a coxa para ajudar a levantar o halter até a frente, na altura do ombro. Use a outra mão para auxiliar no posicionamento.
Com o halter na largura do ombro, gire o pulso para frente, com a palma da mão voltada para longe de você. Esta é sua posição inicial.
Abaixe o peso lentamente para o lado enquanto inspira. Mantenha o controle total do halter. Dica: Use a mão livre para ajudar no equilíbrio, se necessário.
Ao expirar, empurre o halter para cima usando os músculos peitorais. Trave os braços na posição contraída, contraia o peito, segure por um segundo e depois desça lentamente. Dica: A descida deve levar pelo menos o dobro do tempo da subida.
Repita o movimento pelo número recomendado de repetições.
Troque de braço e repita o movimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'supino reto unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'One_Handed_Hang')::uuid, 'Suspensão unilateral', 'Costas', null, 'OUTRO', 'Segure uma barra de pull-up com uma mão, usando pegada pronada. Mantenha os pés no chão ou em um step.
Deixe a maior parte do peso do corpo pendurada na mão, com os pés apoiados.
Segure por 10 a 20 segundos e troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'suspensao unilateral'),
  (md5('catalogo-exercicio:fedb:' || 'Svend_Press')::uuid, 'Svend press com anilha', 'Peito', null, 'OUTRO', 'Fique em pé.
Pressione duas anilhas leves juntas com as mãos, mantendo-as próximas ao peito para criar uma contração isométrica nos músculos peitorais. Os dedos devem estar apontados para frente. Esta é a posição inicial.
Aperte as anilhas entre as palmas e estenda os braços à frente em um movimento controlado.
Faça uma pausa no topo do movimento e, em seguida, retorne lentamente à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'svend press com anilha'),
  (md5('catalogo-exercicio:fedb:' || 'One-Arm_Kettlebell_Swings')::uuid, 'Swing unilateral com kettlebell', 'Posterior', 'Kettlebell', 'LIVRE', null, 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'swing unilateral com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Vertical_Swing')::uuid, 'Swing vertical com halter', 'Posterior', 'Halteres', 'LIVRE', 'Deixe o halter pendurado entre as pernas, segurando com as duas mãos. Mantenha as costas retas e a cabeça erguida.
Balance o halter entre as pernas, flexionando os quadris e os joelhos levemente.
Reverta o movimento com força, estendendo quadris, joelhos e tornozelos para impulsionar o corpo para cima, balançando o halter sobre a cabeça.
Ao aterrissar, absorva o impacto com as pernas e traga o halter de volta ao torso antes da próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'swing vertical com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Tate_Press')::uuid, 'Tate press com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se em um banco plano com um halter em cada mão sobre as coxas. As palmas devem estar voltadas uma para a outra.
Use as coxas para ajudar a levantar os halteres, posicionando-os à frente na largura dos ombros. Certifique-se de que os braços estejam mais afastados que a largura dos ombros, com pegada pronada (palmas para frente) e cotovelos apontados para fora. Esta é a posição inicial.
Mantendo a parte superior dos braços imóvel, mova os halteres para baixo e para dentro em um movimento semicircular até tocarem o peito, inspirando. Mantenha o controle total e não mova a parte superior dos braços nem apoie os halteres no peito.
Ao expirar, mova os halteres para cima usando os tríceps e o mesmo movimento semicircular reverso. Tente mantê-los juntos. Trave os braços na posição contraída, segure por um segundo e depois desça lentamente. Dica: a descida deve levar pelo menos o dobro do tempo da subida.
Repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'tate press com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Linear_3-Part_Start_Technique')::uuid, 'Técnica de partida linear em 3 partes', 'Posterior', null, 'OUTRO', 'Este exercício ajuda a acelerar rapidamente em uma corrida a partir de uma parada. Use uma linha para começar. Inicie com os dois pés na linha. Coloque o pé esquerdo com o dedo próximo ao tornozelo direito. Posicione o pé direito 10-15 cm atrás do esquerdo.
Apoie a mão direita na linha e aproxime o nariz do joelho esquerdo.
Agache-se inclinando para frente, com a cabeça mais baixa que os quadris e o peso carregado na perna esquerda. Esta será a posição inicial.
Levante a mão esquerda até ficar paralela ao chão, apontando para trás, e exploda para fora quando estiver pronto.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'tecnica de partida linear em 3 partes'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Thruster')::uuid, 'Thruster com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Leve dois kettlebells aos ombros com um clean.
Faça um agachamento, descendo o máximo que puder com as costas retas.
Estenda os joelhos e quadris para subir, usando o impulso para pressionar os kettlebells acima da cabeça.
Retorne os pesos aos ombros para a próxima repetição.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'thruster com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Toe_Touchers')::uuid, 'Toque nos dedos dos pés', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Deite-se de costas no chão ou em um colchonete, com os braços ao lado do corpo e as palmas voltadas para baixo.
Mantenha as pernas juntas e eleve-as até ficarem quase perpendiculares ao chão, com os joelhos levemente flexionados. Os pés devem ficar paralelos ao chão.
Estenda os braços em um ângulo de 45 graus em relação ao chão. Esta é a posição inicial.
Mantendo a região lombar pressionada contra o chão, levante o tronco e use as mãos para tentar tocar os dedos dos pés, expirando.
Abaixe lentamente o tronco e os braços de volta à posição inicial, inspirando. Mantenha os braços estendidos em direção aos pés.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'toque nos dedos dos pes'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Toe_Touches')::uuid, 'Toque nos pés em pé', 'Posterior', null, 'OUTRO', 'Fique em pé com espaço à frente e atrás de você.
Incline-se na cintura, mantendo as pernas retas, até relaxar e deixar a parte superior do corpo pendurada. Deixe os braços e mãos pendurados naturalmente. Segure por 10 a 20 segundos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'toque nos pes em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Barbell_Twist')::uuid, 'Torção com barra sentado', 'Abdômen', 'Barra', 'LIVRE', 'Sente-se na ponta de um banco plano com uma barra apoiada sobre as coxas. Os pés devem estar na largura dos ombros.
Segure a barra com as palmas voltadas para baixo e as mãos mais afastadas que a largura dos ombros. Levante a barra sobre a cabeça até os braços ficarem totalmente estendidos.
Abaixe a barra atrás da cabeça até que ela repouse na base do pescoço. Esta é a posição inicial.
Mantenha os pés e a cabeça imóveis e mova a cintura de um lado para o outro para contrair os oblíquos. Vá apenas até onde a cintura permitir, sem exagerar para evitar lesões. Use um movimento lento e controlado.
Expire ao torcer o corpo para o lado e inspire ao voltar à posição inicial.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'torcao com barra sentado'),
  (md5('catalogo-exercicio:fedb:' || 'Medicine_Ball_Full_Twist')::uuid, 'Torção completa com medicine ball', 'Abdômen', 'Medicine ball', 'OUTRO', 'Para este exercício, você precisará de uma medicine ball e um parceiro. Fique de costas para seu parceiro, com uma distância de 60 a 90 cm entre vocês. Esta será sua posição inicial.
Segure a bola na frente do tronco. Abra os quadris e gire os ombros ao mesmo tempo que seu parceiro.
Para uma rotação completa, você e seu parceiro devem torcer na mesma direção, por exemplo, anti-horária.
Passe a bola para seu parceiro, e ambos podem agora torcer na direção oposta para repetir o procedimento.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'torcao completa com medicine ball'),
  (md5('catalogo-exercicio:fedb:' || 'Ankle_On_The_Knee')::uuid, 'Tornozelo no joelho', 'Glúteos', null, 'OUTRO', 'Deite-se de costas, dobre os joelhos e mantenha os pés no chão.
Coloque o tornozelo de um pé sobre o joelho oposto.
Segure a coxa ou o joelho da perna de baixo e puxe ambas as pernas em direção ao peito. Relaxe o pescoço e os ombros. Mantenha por 10-20 segundos e depois troque de lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'tornozelo no joelho'),
  (md5('catalogo-exercicio:fedb:' || 'Tricep_Dumbbell_Kickback')::uuid, 'Tríceps coice com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Segure um halter em cada mão com as palmas voltadas para o corpo. Mantenha as costas retas, joelhos levemente flexionados e incline o tronco para frente, quase paralelo ao chão. Certifique-se de manter a cabeça erguida. Os braços superiores devem ficar próximos ao tronco e paralelos ao chão, com os antebraços apontando para baixo, formando um ângulo de 90 graus com os braços. Esta é a posição inicial.
Mantendo os braços superiores imóveis, expire e use o tríceps para levantar os pesos até os braços estarem totalmente estendidos, focando no movimento do antebraço.
Após uma breve pausa no topo, inspire e abaixe lentamente os halteres de volta à posição inicial.
Repita o movimento pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps coice com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension')::uuid, 'Tríceps coice com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Com um halter em cada mão e as palmas viradas para o torso, flexione levemente os joelhos e incline o tronco para frente, mantendo as costas retas até ficar quase paralelo ao chão. Mantenha a cabeça erguida. Os braços superiores devem ficar próximos ao torso e paralelos ao chão, enquanto os antebraços apontam para baixo, segurando os pesos. Dica: Deve haver um ângulo de 90 graus entre os antebraços e os braços superiores. Esta é a posição inicial.
Mantendo os braços superiores parados, use o tríceps para levantar os pesos, expirando, até que os antebraços fiquem paralelos ao chão e os braços estejam totalmente estendidos. Apenas os antebraços se movem.
Após uma contração no topo, abaixe lentamente os halteres à posição inicial, inspirando.
Repita o movimento pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps coice com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension')::uuid, 'Tríceps coice sentado com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Sente-se na ponta de um banco plano com um halter em uma mão, usando uma pegada neutra (palma voltada para você).
Dobre levemente os joelhos e incline o torso para frente, mantendo as costas retas até quase paralelo ao chão. Mantenha a cabeça erguida.
O braço com o halter deve ficar próximo ao torso e alinhado a ele (elevado até ficar paralelo ao chão, com o antebraço apontando para baixo). Deve haver um ângulo de 90 graus entre o antebraço e o braço. Esta é a posição inicial.
Mantenha o braço imóvel e use o tríceps para levantar o peso até o antebraço ficar paralelo ao chão e o braço estendido. Expire durante o movimento.
Contraia por um segundo no topo e depois abaixe o halter lentamente à posição inicial enquanto inspira.
Repita pelo número prescrito de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps coice sentado com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension')::uuid, 'Tríceps coice sentado com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Sente-se na ponta de um banco plano com um halter em cada mão, usando uma pegada neutra (palmas voltadas para você).
Dobre levemente os joelhos e incline o torso para frente, mantendo as costas retas até quase paralelo ao chão. Mantenha a cabeça erguida.
Os braços com os halteres devem ficar próximos ao torso e alinhados a ele (elevados até ficarem paralelos ao chão, com os antebraços apontando para baixo). Deve haver um ângulo de 90 graus entre os antebraços e os braços. Esta é a posição inicial.
Mantenha os braços imóveis e use o tríceps para levantar os pesos até os antebraços ficarem paralelos ao chão e os braços estendidos. Expire durante o movimento.
Contraia por um segundo no topo e depois abaixe os halteres lentamente à posição inicial enquanto inspira.
Repita pelo número prescrito de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps coice sentado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension')::uuid, 'Tríceps coice unilateral com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Com um halter em uma mão e a palma virada para o torso, flexione levemente os joelhos e incline o tronco para frente, mantendo as costas retas até ficar quase paralelo ao chão. Mantenha a cabeça erguida.
O braço superior deve ficar próximo ao torso e paralelo ao chão, enquanto o antebraço aponta para baixo, segurando o peso. Dica: Deve haver um ângulo de 90 graus entre o antebraço e o braço superior. Esta é a posição inicial.
Mantendo o braço superior parado, use o tríceps para levantar o peso, expirando, até que o antebraço fique paralelo ao chão e o braço esteja totalmente estendido. Apenas o antebraço se move.
Após uma contração no topo, abaixe lentamente o halter à posição inicial, inspirando.
Repita o movimento pelo número recomendado de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps coice unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Triceps_Overhead_Extension_with_Rope')::uuid, 'Tríceps extensão com corda na polia', 'Tríceps', 'Polia', 'MAQUINA', 'Prenda uma corda em uma polia baixa. Após selecionar o peso, segure a corda com as duas mãos e fique de costas para o cabo.
Posicione as mãos atrás da cabeça com os cotovelos apontando para cima. Os cotovelos devem começar flexionados; você pode afastar os pés e inclinar-se levemente para trás para maior estabilidade. Esta é a posição inicial.
Para executar o movimento, estenda os cotovelos mantendo os braços superiores fixos, elevando as mãos acima da cabeça.
Contraia o tríceps no topo do movimento e abaixe lentamente o peso de volta à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps extensao com corda na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Overhead_Barbell_Triceps_Extension')::uuid, 'Tríceps francês com barra em pé', 'Tríceps', 'Barra', 'LIVRE', 'Para começar, fique em pé segurando uma barra ou barra W com uma pegada pronada (palmas voltadas para frente), com as mãos mais próximas que a largura dos ombros. Os pés devem estar na largura dos ombros.
Eleve a barra acima da cabeça até os braços estarem totalmente estendidos. Mantenha os cotovelos para dentro. Esta é a posição inicial.
Mantendo os braços superiores próximos à cabeça e os cotovelos para dentro, perpendiculares ao chão, abaixe a resistência em um movimento semicircular atrás da cabeça até os antebraços tocarem os bíceps. Dica: Os braços superiores devem permanecer imóveis e apenas os antebraços devem se mover. Inspire ao executar este passo.
Volte à posição inicial usando o tríceps para levantar a barra. Expire ao executar este passo.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances com barra em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Dumbbell_Triceps_Extension')::uuid, 'Tríceps francês com halteres em pé', 'Tríceps', 'Halteres', 'LIVRE', 'Em pé, segure um halter com as duas mãos. Pés na largura dos ombros. Levante o halter acima da cabeça até os braços ficarem totalmente estendidos.
O peso deve repousar nas palmas das mãos, com os polegares ao redor, palmas para cima. Esta é a posição inicial.
Mantendo a parte superior dos braços próxima à cabeça, cotovelos para dentro e perpendiculares ao chão, abaixe o peso em movimento semicircular atrás da cabeça até os antebraços tocarem o bíceps. Inspire ao fazer isso.
Retorne à posição inicial usando o tríceps para levantar o halter. Expire ao fazer isso.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances com halteres em pe'),
  (md5('catalogo-exercicio:fedb:' || 'Body_Tricep_Press')::uuid, 'Tríceps francês com peso corporal', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL', 'Posicione uma barra em um suporte na altura do peito.
Em pé, segure a barra com as mãos na largura dos ombros e afaste-se um pouco, com os pés juntos e braços estendidos, inclinando-se sobre a barra. Esta é a posição inicial.
Flexione os cotovelos para baixar o corpo em direção à barra.
Faça uma pausa e, em seguida, estenda os cotovelos para retornar à posição inicial.
Para progredir, adicione peso usando correntes sobre os ombros.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances com peso corporal'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Incline_Triceps_Extension')::uuid, 'Tríceps francês inclinado na polia', 'Tríceps', 'Polia', 'MAQUINA', 'Deite-se em um banco inclinado de costas para uma polia alta com barra reta.
Segure a barra com pegada pronada estreita (palmas para baixo) e cotovelos junto ao corpo, formando um ângulo de 25° com o chão. Esta é a posição inicial.
Mantenha os braços superiores parados e estenda os braços contraindo o tríceps, expirando e segurando a contração por um segundo.
Retorne lentamente à posição inicial.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances inclinado na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Rope_Overhead_Triceps_Extension')::uuid, 'Tríceps francês na polia com corda', 'Tríceps', 'Polia', 'MAQUINA', 'Conecte uma corda à polia baixa.
Segure a corda com as duas mãos acima da cabeça, usando uma pegada neutra (palmas viradas uma para a outra). Os cotovelos devem ficar próximos à cabeça e os braços perpendiculares ao chão. Esta é a posição inicial.
Abaixe a corda lentamente atrás da cabeça, mantendo a parte superior dos braços imóvel. Inspire e pause quando o tríceps estiver totalmente alongado.
Retorne à posição inicial contraindo o tríceps e expirando.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances na polia com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Seated_Triceps_Press')::uuid, 'Tríceps francês sentado com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Sente-se em um banco com apoio para as costas e segure um halter com as duas mãos acima da cabeça, com os braços estendidos. Dica: É melhor que alguém lhe entregue o halter, especialmente se for muito pesado. A resistência deve repousar nas palmas das mãos, com os polegares ao redor. As palmas devem estar viradas para dentro. Esta será a posição inicial.
Mantendo os braços superiores próximos à cabeça (cotovelos para dentro) e perpendiculares ao chão, abaixe a resistência em um movimento semicircular atrás da cabeça até os antebraços tocarem os bíceps. Dica: Os braços superiores devem permanecer imóveis e apenas os antebraços devem se mover. Inspire ao executar este passo.
Volte à posição inicial usando o tríceps para levantar o halter. Expire ao executar este passo.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances sentado com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_One-Arm_Triceps_Extension')::uuid, 'Tríceps francês unilateral com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Segure um halter e sente-se em um banco militar ou em um banco com encosto, ou fique em pé, com o halter apoiado na coxa.
Levante o halter sobre a cabeça até o braço ficar perpendicular ao chão, ao lado da cabeça. A outra mão pode apoiar o braço ou ficar ao lado.
Gire o pulso para que a palma da mão fique voltada para frente e o mindinho para cima. Esta é a posição inicial.
Inspire e abaixe o halter atrás da cabeça, mantendo o braço superior estacionário, até o tríceps ficar alongado.
Expire e retorne à posição inicial flexionando o tríceps, movendo apenas o antebraço.
Repita para a quantidade recomendada de repetições e depois troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances unilateral com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_One-Arm_Dumbbell_Triceps_Extension')::uuid, 'Tríceps francês unilateral em pé com halter', 'Tríceps', 'Halteres', 'LIVRE', 'Para começar, fique em pé segurando um halter com uma mão. Os pés devem estar na largura dos ombros. Estenda totalmente o braço com o halter acima da cabeça. Dica: O dedo mínimo deve estar voltado para o teto e a palma da mão para frente. O halter deve estar acima da cabeça.
Esta é a posição inicial.
Mantendo o braço superior próximo à cabeça (cotovelos para dentro) e perpendicular ao chão, abaixe a resistência em um movimento semicircular atrás da cabeça até o antebraço tocar o bíceps. Dica: O braço superior deve permanecer imóvel e apenas o antebraço deve se mover. Inspire ao executar este passo.
Volte à posição inicial usando o tríceps para levantar o halter. Expire ao executar este passo.
Repita para a quantidade recomendada de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances unilateral em pe com halter'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Low-Pulley_One-Arm_Triceps_Extension')::uuid, 'Tríceps francês unilateral na polia baixa', 'Tríceps', 'Polia', 'MAQUINA', 'Segure uma alça única com o braço esquerdo próximo à máquina de pulley baixo. Vire-se de costas para a máquina, mantendo a alça ao lado do corpo com o braço totalmente estendido. Use as duas mãos para elevar a alça diretamente acima da cabeça, com a palma voltada para frente. Mantenha o braço superior completamente vertical (perpendicular ao chão) e coloque a mão direita no cotovelo esquerdo para ajudar a mantê-lo firme. Esta é a posição inicial.
Mantendo os braços superiores próximos à cabeça (cotovelos para dentro) e perpendiculares ao chão, abaixe a resistência em um movimento semicircular atrás da cabeça até os antebraços tocarem os bíceps. Dica: Os braços superiores devem permanecer imóveis e apenas os antebraços devem se mover. Inspire ao executar este passo.
Volte à posição inicial usando o tríceps para levantar a alça. Expire ao executar este passo.
Repita para a quantidade recomendada de repetições.
Troque de braço e repita o exercício.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances unilateral na polia baixa'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Pronated_Dumbbell_Triceps_Extension')::uuid, 'Tríceps francês unilateral pronado', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se de costas em um banco, segurando um halter com o braço estendido perpendicular ao corpo. A palma da mão deve estar virada para os pés (pegada pronada).
Use a outra mão para apoiar o bíceps do braço que está trabalhando.
Inspire e abaixe lentamente o halter em direção à cabeça.
Contraia o tríceps e levante o halter de volta à posição inicial, expirando durante o movimento.
Repita até completar as repetições desejadas e troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances unilateral pronado'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Supinated_Dumbbell_Triceps_Extension')::uuid, 'Tríceps francês unilateral supinado', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se de costas em um banco, segurando um halter com o braço estendido perpendicular ao corpo. A palma da mão deve estar virada para o rosto (pegada supinada).
Use a outra mão para apoiar o bíceps do braço que está trabalhando.
Inspire e abaixe lentamente o halter em direção à cabeça.
Contraia o tríceps e levante o halter de volta à posição inicial, expirando durante o movimento.
Repita até completar as repetições desejadas e troque de braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps frances unilateral supinado'),
  (md5('catalogo-exercicio:fedb:' || 'Machine_Triceps_Extension')::uuid, 'Tríceps na máquina', 'Tríceps', 'Máquina', 'MAQUINA', 'Ajuste o banco à altura adequada e selecione o peso. Apoie os braços superiores nas almofadas e segure as alças. Esta será sua posição inicial.
Estenda os cotovelos, afastando os antebraços dos braços superiores.
Faça uma pausa no final do movimento e retorne lentamente o peso à posição inicial.
Evite retornar o peso completamente até o final do conjunto para manter a tensão nos músculos.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na maquina'),
  (md5('catalogo-exercicio:fedb:' || 'Kneeling_Cable_Triceps_Extension')::uuid, 'Tríceps na polia ajoelhado', 'Tríceps', 'Polia', 'MAQUINA', 'Coloque um banco de lado em frente a uma máquina de polia alta.
Segure uma barra reta acima da cabeça com as mãos a cerca de 15 cm de distância, palmas para baixo.
Fique de costas para a máquina e ajoelhe-se.
Apoie a cabeça e a parte de trás dos braços no banco. Os cotovelos devem estar flexionados, com os antebraços apontando para a polia. Esta é a posição inicial.
Mantenha os braços próximos à cabeça e os cotovelos para dentro, estenda a barra em um movimento semicircular até os cotovelos travarem e os braços ficarem paralelos ao chão. Contraia o tríceps e mantenha por um segundo. Expire ao executar.
Retorne lentamente à posição inicial enquanto inspira.
Repita para o número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na polia ajoelhado'),
  (md5('catalogo-exercicio:fedb:' || 'Triceps_Pushdown_-_V-Bar_Attachment')::uuid, 'Tríceps na polia com barra V', 'Tríceps', 'Polia', 'MAQUINA', 'Prenda uma barra V em uma polia alta e segure com pegada pronada (palmas para baixo) na largura dos ombros, com os polegares mais altos que os mindinhos.
Fique em pé com o tronco reto e leve uma pequena inclinação para frente. Mantenha os braços superiores próximos ao corpo e perpendiculares ao chão, com os antebraços apontando para a polia. Esta é a posição inicial.
Use o tríceps para levar a barra para baixo até tocar a frente das coxas, com os braços totalmente estendidos. Os braços superiores devem permanecer imóveis; apenas os antebraços se movem. Expire ao fazer este movimento.
Após uma pausa de um segundo na posição contraída, levante a barra V lentamente à posição inicial. Inspire ao fazer este passo.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na polia com barra v'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Incline_Pushdown')::uuid, 'Tríceps na polia inclinado com corda', 'Costas', 'Polia', 'MAQUINA', 'Deite-se em um banco inclinado de costas para uma polia alta com barra reta.
Segure a barra com pegada pronada (palmas para baixo) na largura dos ombros e estenda os braços à frente, perto das coxas. Esta é a posição inicial.
Mantenha os braços superiores parados e levante-os em um semicírculo até a barra ficar acima da cabeça, inspirando.
Retorne à posição inicial usando os dorsais, expirando e contraindo.
Repita pelo número de repetições recomendado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na polia inclinado com corda'),
  (md5('catalogo-exercicio:fedb:' || 'Reverse_Grip_Triceps_Pushdown')::uuid, 'Tríceps na polia pegada invertida', 'Tríceps', 'Polia', 'MAQUINA', 'Ajuste uma barra (reta ou EZ) em uma máquina de pulley alto.
De frente para a barra, segure-a com as palmas voltadas para cima (pegada supinada) na largura dos ombros. Baixe a barra usando as costas até os braços ficarem totalmente estendidos ao lado do corpo. Dica: Os cotovelos devem ficar próximos ao corpo e os pés afastados na largura dos ombros. Esta é a posição inicial.
Eleve lentamente a barra para cima enquanto inspira, alinhando-a com o peito. Apenas os antebraços devem se mover; cotovelos e braços superiores ficam imóveis ao lado do corpo.
Em seguida, comece a baixar a barra de volta à posição inicial enquanto expira e contrai o tríceps com força.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na polia pegada invertida'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_One_Arm_Tricep_Extension')::uuid, 'Tríceps na polia unilateral supinado', 'Tríceps', 'Polia', 'MAQUINA', 'Com a mão direita, segure uma alça única na polia alta com uma pegada supinada (palmas para cima). Fique de frente para a pilha de pesos.
Puxe a alça para baixo, travando o braço e o cotovelo junto ao corpo. O braço e o antebraço devem formar um ângulo agudo. Para equilíbrio, mantenha o outro braço na cintura e posicione uma perna à frente.
Contraia o tríceps para estender o braço, movendo a alça para baixo até o braço ficar reto. Expire durante o movimento. Dica: Apenas o antebraço deve se mover; mantenha a parte superior do braço imóvel.
Contraia o tríceps e segure por um segundo na posição contraída.
Retorne lentamente a alça à posição inicial.
Repita pelo número recomendado de repetições e faça o mesmo com o outro braço.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps na polia unilateral supinado');

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, instrucoes, fonte, nome_busca) values
  (md5('catalogo-exercicio:fedb:' || 'Speed_Band_Overhead_Triceps')::uuid, 'Tríceps overhead com elástico de velocidade', 'Tríceps', 'Elástico', 'ELASTICO', 'Para este exercício, ancore uma banda no chão. Usamos um banco inclinado e ancoramos a banda na base, ficando sobre o banco. Alternativamente, pode ser feito pisando na banda.
Para começar, puxe a banda atrás da cabeça, segurando-a com uma pegada pronada e os cotovelos elevados. Esta será a posição inicial.
Para executar o movimento, estenda os cotovelos para endireitar os braços, mantendo a parte superior dos braços fixa.
Faça uma pausa e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps overhead com elastico de velocidade'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Triceps_Press')::uuid, 'Tríceps testa com barra', 'Tríceps', 'Barra W', 'LIVRE', 'Deite-se em um banco plano com uma barra W ou reta no chão atrás da cabeça e os pés no chão.
Segure a barra atrás de você com uma pegada média pronada e levante-a à sua frente com os braços estendidos. Dica: Braços perpendiculares ao torso e ao chão, cotovelos recolhidos. Esta é a posição inicial.
Inspirando, abaixe o peso lentamente até a barra tocar levemente a testa, mantendo os braços superiores e cotovelos estacionários.
Use os tríceps para levantar o peso de volta à posição inicial, expirando.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head')::uuid, 'Tríceps testa com barra pegada fechada', 'Tríceps', 'Barra', 'LIVRE', 'Segure uma barra reta ou barra W com pegada pronada (palmas para frente) e deite-se de costas em um banco plano, com a cabeça próxima à extremidade. Dica: Para barra reta, use pegada na largura dos ombros; para barra W, segure nas alças internas.
Estenda os braços à frente e leve a barra para trás em um movimento semicircular até a posição sobre a cabeça, com os braços paralelos ao chão. Esta será a posição inicial. Dica: Mantenha os cotovelos para dentro.
Ao inspirar, abaixe a barra flexionando os cotovelos, mantendo a parte superior dos braços parada, até os antebraços ficarem perpendiculares ao chão.
Ao expirar, retorne a barra à posição inicial em movimento semicircular, até os antebraços ficarem paralelos ao chão. Contraia o tríceps fortemente no topo por um segundo. Dica: Apenas os antebraços se movem.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com barra pegada fechada'),
  (md5('catalogo-exercicio:fedb:' || 'EZ-Bar_Skullcrusher')::uuid, 'Tríceps testa com barra W', 'Tríceps', 'Barra W', 'LIVRE', 'Deitado em um banco, segure a barra W com uma pegada fechada, mantendo os cotovelos apontados para cima e os braços perpendiculares ao chão. Esta será sua posição inicial.
Mantendo a parte superior dos braços parada, flexione os cotovelos para baixar a barra em direção à testa. Inspire durante essa parte do movimento.
Estenda os cotovelos para levantar a barra de volta à posição inicial, expirando.
Repita.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com barra w'),
  (md5('catalogo-exercicio:fedb:' || 'Band_Skull_Crusher')::uuid, 'Tríceps testa com elástico', 'Tríceps', 'Elástico', 'ELASTICO', 'Prenda uma banda na base de um rack ou no banco. Deite-se no banco de forma que a banda fique alinhada com sua cabeça.
Segure a banda, elevando os cotovelos para que o braço superior fique perpendicular ao chão. Com o cotovelo flexionado, a banda deve estar acima da sua cabeça. Esta será sua posição inicial.
Estenda o cotovelo para endireitar o braço, mantendo o braço superior no lugar. Faça uma pausa no topo do movimento e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com elastico'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Dumbbell_Tricep_Extension')::uuid, 'Tríceps testa com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se em um banco plano segurando dois halteres diretamente à sua frente. Os braços devem estar totalmente estendidos em um ângulo de 90 graus com o torso e o chão. As palmas devem estar voltadas para dentro e os cotovelos próximos ao corpo. Esta é a posição inicial.
Ao inspirar e mantendo a parte superior dos braços estacionária com os cotovelos fixos, abaixe lentamente o peso até os halteres ficarem próximos às orelhas.
Nesse ponto, mantendo os cotovelos fixos e a parte superior dos braços estacionária, use o tríceps para levantar o peso de volta à posição inicial enquanto expira.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Dumbbell_Tricep_Extension_-Pronated_Grip')::uuid, 'Tríceps testa com halteres pegada pronada', 'Tríceps', 'Halteres', 'LIVRE', 'Deite-se em um banco plano segurando dois halteres diretamente acima dos ombros, com os braços totalmente estendidos e formando um ângulo de 90 graus com o torso.
As palmas das mãos devem estar voltadas para frente e os cotovelos próximos ao corpo. Esta é sua posição inicial.
Inspire e abaixe os halteres lentamente até próximo às orelhas, mantendo a parte superior dos braços imóvel.
Expire e use o tríceps para retornar os pesos à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa com halteres pegada pronada'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_EZ_Bar_Triceps_Extension')::uuid, 'Tríceps testa declinado com barra W', 'Tríceps', 'Barra', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se lentamente.
Com uma pegada fechada (ligeiramente menor que a largura dos ombros), levante a barra W do suporte e segure-a reta acima de você, com os braços travados e cotovelos para dentro. Os braços devem estar perpendiculares ao chão. Esta é a posição inicial. Dica: Para proteger o manguito rotador, é melhor ter um ajudante para levantar a barra.
Inspire e, mantendo a parte superior dos braços parada, abaixe a barra lentamente em um movimento semicircular até tocar levemente a testa. Inspire durante essa fase.
Levante a barra de volta à posição inicial contraindo o tríceps e expirando.
Repita até completar as repetições recomendadas.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa declinado com barra w'),
  (md5('catalogo-exercicio:fedb:' || 'Decline_Dumbbell_Triceps_Extension')::uuid, 'Tríceps testa declinado com halteres', 'Tríceps', 'Halteres', 'LIVRE', 'Prenda as pernas na extremidade do banco declinado e deite-se com um halter em cada mão sobre as coxas, palmas voltadas uma para a outra.
Ao deitar, posicione os halteres à frente na largura dos ombros, com os braços estendidos e perpendiculares ao chão. Esta é a posição inicial.
Inspire e, mantendo os braços superiores imóveis e cotovelos para dentro, desça os halteres em um movimento semicircular até os polegares ficarem próximos às orelhas.
Contraia o tríceps para levantar os halteres à posição inicial, expirando.
Repita pelo número de repetições prescrito.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa declinado com halteres'),
  (md5('catalogo-exercicio:fedb:' || 'Lying_Close-Grip_Barbell_Triceps_Press_To_Chin')::uuid, 'Tríceps testa fechado com barra ao queixo', 'Tríceps', 'Barra W', 'LIVRE', 'Segure uma barra reta ou barra W com pegada pronada (palmas para frente) e deite-se de costas em um banco plano, com a cabeça além da extremidade. Dica: Para barra reta, use pegada na largura dos ombros; para barra W, segure nas alças internas.
Estenda os braços à frente, segurando a barra sobre o peito, com os braços perpendiculares ao tronco. Esta será a posição inicial.
Ao inspirar, abaixe a barra em movimento semicircular flexionando os cotovelos, mantendo a parte superior dos braços parada e os cotovelos para dentro, até tocar levemente o queixo.
Ao expirar, retorne a barra à posição inicial em movimento semicircular. Contraia o tríceps fortemente no topo por um segundo. Dica: Apenas os antebraços se movem.
Repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa fechado com barra ao queixo'),
  (md5('catalogo-exercicio:fedb:' || 'Cable_Lying_Triceps_Extension')::uuid, 'Tríceps testa na polia', 'Tríceps', 'Polia', 'MAQUINA', 'Deite-se em um banco plano e segure a barra reta da polia baixa com uma pegada fechada e pronada (palmas para baixo). Dica: A maneira mais fácil é pedir para alguém entregar a barra enquanto você se deita.
Com os braços estendidos, posicione a barra sobre o torso. Seus braços e torso devem formar um ângulo de 90 graus. Esta será a posição inicial.
Abaixe a barra flexionando os cotovelos, mantendo a parte superior dos braços imóvel e os cotovelos para dentro. Desça até a barra tocar levemente a testa. Inspire durante essa fase.
Contraia o tríceps para levantar a barra de volta à posição inicial. Expire durante essa fase.
Segure por um segundo na posição contraída e repita pelo número recomendado de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Low_Cable_Triceps_Extension')::uuid, 'Tríceps testa na polia baixa', 'Tríceps', 'Polia', 'MAQUINA', 'Selecione o peso desejado e deite-se de barriga para cima no banco de uma máquina de remada sentada com uma corda presa. Sua cabeça deve apontar para a fixação.
Segure as extremidades externas da corda com as palmas voltadas uma para a outra (pegada neutra).
Posicione os cotovelos em um ângulo de 90 graus, com os braços superiores perpendiculares ao torso. Dica: Mantenha os cotovelos para dentro e certifique-se de que os braços superiores apontem para o teto enquanto os antebraços apontam para a polia acima da cabeça. Esta será a posição inicial.
Ao expirar, estenda os antebraços até ficarem retos e verticais. Os braços superiores e cotovelos permanecem imóveis. Apenas os antebraços devem se mover. Contraia os tríceps fortemente por um segundo.
Ao inspirar, retorne lentamente à posição inicial.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa na polia baixa'),
  (md5('catalogo-exercicio:fedb:' || 'Incline_Barbell_Triceps_Extension')::uuid, 'Tríceps testa no banco inclinado com barra', 'Tríceps', 'Barra', 'LIVRE', 'Segure uma barra com pegada pronada (palmas para baixo) um pouco mais próxima que a largura dos ombros.
Deite-se em um banco inclinado ajustado entre 45-75 graus.
Leve a barra acima da cabeça com os braços estendidos e cotovelos para dentro. Os braços devem estar alinhados com o tronco. Esta será a posição inicial.
Abaixe a barra em um movimento semicircular atrás da cabeça até os antebraços tocarem os bíceps. Inspire ao fazer isso. Dica: Mantenha os braços superiores parados e próximos à cabeça; apenas os antebraços se movem.
Retorne à posição inicial enquanto expira e contrai o tríceps. Segure a contração por um segundo.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'triceps testa no banco inclinado com barra'),
  (md5('catalogo-exercicio:fedb:' || 'Jogging_Treadmill')::uuid, 'Trote na esteira', 'Cardio', 'Máquina', 'CARDIO', 'Pise na esteira e selecione a opção desejada no menu. A maioria tem modo manual ou programas. Você pode inserir idade e peso para estimar calorias queimadas. A inclinação ajusta a intensidade.
Esteiras oferecem conveniência, benefícios cardiovasculares e menos impacto que correr ao ar livre. Uma pessoa de 68 kg queima cerca de 250 calorias em 30 minutos de trote. Mantenha postura correta e segure os apoios apenas quando necessário, como para descer ou verificar a frequência cardíaca.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'trote na esteira'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Turkish_Get-Up_Lunge_style')::uuid, 'Turkish get-up com kettlebell', 'Ombros', 'Kettlebell', 'LIVRE', 'Deite de costas no chão, pressione um kettlebell acima com o braço estendido e dobre o joelho do mesmo lado.
Mantendo o kettlebell travado, gire para o lado oposto e use o braço livre para ajudar a chegar à posição de afundo, passando por sentado e ajoelhado.
Levante-se lentamente olhando para o kettlebell e retorne ao início.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'turkish get-up com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Turkish_Get-Up_Squat_style')::uuid, 'Turkish get-up estilo agachamento', 'Ombros', 'Kettlebell', 'LIVRE', 'Deite de costas no chão, pressione um kettlebell acima com o braço estendido e dobre o joelho do mesmo lado.
Mantendo o kettlebell travado, gire para o lado oposto e use o braço livre para ajudar a chegar em pé, passando por sentado.
Levante-se lentamente olhando para o kettlebell e retorne ao início.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'turkish get-up estilo agachamento'),
  (md5('catalogo-exercicio:fedb:' || 'One_Arm_Against_Wall')::uuid, 'Um braço contra a parede', 'Costas', null, 'OUTRO', 'De pé, coloque um braço flexionado contra uma parede ou batente de porta.
Incline-se lentamente em direção ao braço até sentir um alongamento nos dorsais.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'um braco contra a parede'),
  (md5('catalogo-exercicio:fedb:' || 'Stomach_Vacuum')::uuid, 'Vacuum abdominal', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL', 'Fique em pé com os pés na largura dos ombros e as mãos nos quadris. Esta é a posição inicial.
Inspire profundamente e, ao expirar, contraia o abdômen o máximo possível, como se o umbigo fosse tocar a coluna, e segure essa contração.
Mantenha a contração por cerca de 20 segundos, respirando normalmente. Depois, inspire e relaxe o abdômen, voltando à posição inicial.
Com a prática, aumente o tempo de contração para 40-60 segundos.
Repita para a quantidade recomendada de séries.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'vacuum abdominal'),
  (md5('catalogo-exercicio:fedb:' || 'Butterfly')::uuid, 'Voador peitoral (peck deck)', 'Peito', 'Máquina', 'MAQUINA', 'Sente-se na máquina com as costas retas no encosto.
Segure as alças. Dica: os braços superiores devem estar paralelos ao chão; ajuste a máquina conforme necessário. Esta é a posição inicial.
Empurre as alças juntas lentamente enquanto contrai o peito no meio. Expire durante esta parte do movimento e segure a contração por um segundo.
Volte à posição inicial lentamente enquanto inspira, até que os músculos do peito estejam totalmente alongados.
Repita para a quantidade recomendada de repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'voador peitoral (peck deck)'),
  (md5('catalogo-exercicio:fedb:' || 'Windmills')::uuid, 'Windmill', 'Abdutores', null, 'OUTRO', 'Deite-se de costas com os braços estendidos para os lados e as pernas retas. Esta é a posição inicial.
Levante uma perna e cruze-a rapidamente sobre o corpo, tentando tocar o chão perto da mão oposta.
Volte à posição inicial e repita com a perna oposta. Continue alternando por 10 a 20 repetições.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'windmill'),
  (md5('catalogo-exercicio:fedb:' || 'Advanced_Kettlebell_Windmill')::uuid, 'Windmill avançado com kettlebell', 'Abdômen', 'Kettlebell', 'LIVRE', 'Faça um clean e press com um kettlebell acima da cabeça com um braço.
Mantendo o kettlebell travado, empurre o glúteo na direção do kettlebell. Mantenha o braço não trabalhado atrás das costas e gire os pés a 45 graus do braço com o kettlebell.
Abaixe-se o máximo possível.
Pause por um segundo e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'windmill avancado com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Double_Kettlebell_Windmill')::uuid, 'Windmill com duas kettlebells', 'Abdômen', 'Kettlebell', 'LIVRE', 'Coloque uma kettlebell na frente do pé e faça um clean e press com a kettlebell oposta sobre a cabeça, com a palma para frente.
Mantendo o braço estendido, empine o bumbum na direção da kettlebell elevada, com os pés virados a 45 graus.
Incline-se para o lado, flexionando o quadril e mantendo os olhos na kettlebell sobre a cabeça, até pegar a kettlebell do chão.
Segure por um segundo e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'windmill com duas kettlebells'),
  (md5('catalogo-exercicio:fedb:' || 'Kettlebell_Windmill')::uuid, 'Windmill com kettlebell', 'Abdômen', 'Kettlebell', 'LIVRE', 'Pressione um kettlebell acima da cabeça com um braço, mantendo-o travado.
Com os pés em ângulo de 45 graus, empurre o quadril para o lado do kettlebell e incline-se até tocar o chão com a mão livre, mantendo os olhos no peso.
Segure por um segundo e retorne à posição inicial.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'windmill com kettlebell'),
  (md5('catalogo-exercicio:fedb:' || 'Standing_Cable_Wood_Chop')::uuid, 'Woodchopper na polia', 'Abdômen', 'Polia', 'MAQUINA', 'Conecte uma alça padrão à torre e ajuste o cabo na posição mais alta da polia.
Fique de lado para o cabo, segure a alça com uma mão e afaste-se da torre, mantendo a tensão do peso. Seu braço estendido deve estar alinhado com o cabo.
Com os pés na largura dos ombros, use a outra mão para segurar a alça com ambas as mãos, mantendo os braços estendidos.
Em um movimento contínuo, puxe a alça para baixo e através do corpo em direção ao joelho da frente, girando o tronco.
Mantenha as costas e braços retos, o core contraído, gire o pé de trás e dobre os joelhos para um movimento completo.
Conserve a postura e braços retos. Retorne à posição inicial de forma lenta e controlada.
Repita até a falha muscular.
Reposicione e repita a série do outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'woodchopper na polia'),
  (md5('catalogo-exercicio:fedb:' || 'Worlds_Greatest_Stretch')::uuid, 'World''s greatest stretch', 'Posterior', null, 'OUTRO', 'Este é um alongamento em três partes. Comece dando um passo à frente em afundo, com o pé da frente apoiado no chão e o de trás na ponta dos pés. Agache até o joelho da frente quase tocar o chão, mantendo o tronco ereto. Segure por 10 a 20 segundos.
Agora, coloque a mão do mesmo lado da perna da frente no chão, com o cotovelo próximo ao pé. A outra mão deve apoiar no chão, paralela à perna da frente, para auxiliar.
Após 10 a 20 segundos, coloque as mãos de cada lado do pé da frente. Levante os dedos do pé da frente e estique a perna, ajustando a perna de trás se necessário. Segure por 10 a 20 segundos e repita toda a sequência para o outro lado.', 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)', 'world''s greatest stretch');

alter table catalogo_exercicio alter column nome_busca set not null;
create index ix_catalogo_exercicio_nome_busca on catalogo_exercicio (nome_busca);
